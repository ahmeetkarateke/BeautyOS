import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Bu dosya veritabani ve Redis gerektirmez: db, kuyruk, Turnstile ve SMS sahtelenir.
const dbMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  service: { findFirst: vi.fn(), findMany: vi.fn() },
  staffProfile: { findFirst: vi.fn() },
  appointment: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  customer: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  phoneVerification: { findFirst: vi.fn() },
}))
const queueMock = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }))
const turnstileMock = vi.hoisted(() => ({ verifyTurnstile: vi.fn(), isTurnstileUnavailable: vi.fn() }))

vi.mock('../lib/db', () => ({ db: dbMock }))
// scheduleReminders gercek kuyruk modulunde tanimli; burada ayni is adlariyla queueMock.add'e yazar (kuyruk adlari K5'te sinanir).
vi.mock('../lib/queue', () => ({
  remindersQueue: queueMock,
  scheduleReminders: async (i: { appointmentId: string; tenantId: string; startAt: Date; now?: Date }) => {
    const nowMs = (i.now ?? new Date()).getTime()
    for (const [kind, hours] of [['24h', 24], ['2h', 2]] as const) {
      const delay = i.startAt.getTime() - hours * 3_600_000 - nowMs
      if (delay > 0) await queueMock.add(`reminder-${kind}`, { appointmentId: i.appointmentId, tenantId: i.tenantId }, { delay })
    }
  },
}))
const slotsMock = vi.hoisted(() => ({ getSlots: vi.fn() }))
vi.mock('../lib/slots', () => slotsMock)
vi.mock('../lib/turnstile', () => turnstileMock)
vi.mock('../lib/sms', async () => {
  const actual = await vi.importActual<typeof import('../lib/sms/types')>('../lib/sms/types')
  return {
    normalizePhoneTR: actual.normalizePhoneTR,
    sendSms: vi.fn().mockResolvedValue({ result: { success: true } }),
    getSmsProvider: () => ({ send: vi.fn().mockResolvedValue({ success: true }) }),
  }
})

import { createPublicRouter } from '../routes/public.route'

const H = 60 * 60 * 1000
const SERVICE_ID = '11111111-1111-4111-8111-111111111111'
const STAFF_ID = '22222222-2222-4222-8222-222222222222'

function isoNoMs(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function makeApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json())
  app.use('/api/v1/tenants/:slug/public', createPublicRouter())
  return app
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    serviceId: SERVICE_ID,
    staffId: STAFF_ID,
    startAt: isoNoMs(new Date(Date.now() + 72 * H)),
    customerName: 'Ayşe Yılmaz',
    customerPhone: '0555 111 22 33',
    captchaToken: 'tok',
    ...overrides,
  }
}

let counts = { active: 0, phonePending: 0, tenantPending: 0 }

function setTenant(settings: Record<string, unknown> = {}, businessType = 'beauty_center') {
  dbMock.tenant.findUnique.mockResolvedValue({
    id: 't1',
    name: 'Salon',
    isActive: true,
    businessType,
    settings: { publicBookingEnabled: true, ...settings },
  })
}

const ENV_KEYS = ['NETGSM_USERCODE', 'NODE_ENV'] as const
let savedEnv: Record<string, string | undefined>

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  delete process.env.NETGSM_USERCODE
  counts = { active: 0, phonePending: 0, tenantPending: 0 }
  setTenant()
  dbMock.service.findFirst.mockReset().mockResolvedValue({ id: SERVICE_ID, durationMinutes: 60, bufferMinutes: 0, price: 150 })
  dbMock.staffProfile.findFirst.mockReset().mockResolvedValue({ id: STAFF_ID })
  dbMock.appointment.findFirst.mockReset().mockResolvedValue(null)
  dbMock.appointment.count.mockReset().mockImplementation(async (args: { where: Record<string, any> }) => {
    if (args.where.OR && args.where.status?.in) return counts.active
    if (args.where.OR) return counts.phonePending
    return counts.tenantPending
  })
  dbMock.appointment.create.mockReset().mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: 'appt-1',
    referenceCode: args.data.referenceCode,
    startAt: args.data.startAt,
  }))
  dbMock.customer.findFirst.mockReset().mockResolvedValue(null)
  dbMock.customer.findMany.mockReset().mockResolvedValue([])
  dbMock.customer.create.mockReset().mockResolvedValue({ id: 'cust-1' })
  dbMock.customer.update.mockReset().mockResolvedValue({ id: 'cust-1' })
  dbMock.phoneVerification.findFirst.mockReset().mockResolvedValue(null)
  queueMock.add.mockReset().mockResolvedValue({})
  queueMock.remove.mockReset().mockResolvedValue(1)
  turnstileMock.verifyTurnstile.mockReset().mockResolvedValue(true)
  turnstileMock.isTurnstileUnavailable.mockReset().mockReturnValue(false)
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
})

const book = (app: express.Express, body: object = validBody()) =>
  request(app).post('/api/v1/tenants/salon/public/book').send(body)

describe('S2 none modu: dogrulamasiz online talep', () => {
  it('K1: kodsuz talep pending ve phoneVerified=false duser, telefon dogrulamasi sorgulanmaz', async () => {
    const res = await book(makeApp())
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id: 'appt-1', status: 'pending', approvalRequired: true, phoneVerified: false })
    const data = dbMock.appointment.create.mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'pending', phoneVerified: false, bookingChannel: 'web', tenantId: 't1' })
    expect(dbMock.phoneVerification.findFirst).not.toHaveBeenCalled()
  })

  it('S2 Kritik 2: dogrulanmamis talep musteri olusturmaz; ad ve normalize telefon talepte tutulur (customerId null)', async () => {
    await book(makeApp())
    expect(dbMock.customer.create).not.toHaveBeenCalled()
    expect(dbMock.customer.findMany).not.toHaveBeenCalled()
    const data = dbMock.appointment.create.mock.calls[0][0].data
    expect(data).toMatchObject({ customerId: null, requestedName: 'Ayşe Yılmaz', requestedPhone: '+905551112233', phoneVerified: false })
  })

  it('K1: salon otomatik onay (T3) ayarini acmis olsa da talep pending duser', async () => {
    setTenant({ onlineBookingApproval: 'auto' })
    const res = await book(makeApp())
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
    expect(dbMock.appointment.create.mock.calls[0][0].data.status).toBe('pending')
  })

  it('S2 Kritik 2: var olan musterinin telefonuyla gelen talep o karta baglanmaz (musteri aranmaz, guncellenmez, baglanmaz)', async () => {
    dbMock.customer.findFirst.mockResolvedValue({ id: 'cust-old', phone: '05551112233' })
    const res = await book(makeApp())
    expect(res.status).toBe(201)
    expect(dbMock.customer.findMany).not.toHaveBeenCalled()
    expect(dbMock.customer.create).not.toHaveBeenCalled()
    expect(dbMock.appointment.create.mock.calls[0][0].data.customerId).toBeNull()
  })

  it('K3: talep icin online-expire-<id> is kimligiyle sure dolumu kurulur (24 saat ya da randevudan 2 saat once)', async () => {
    await book(makeApp())
    const call = queueMock.add.mock.calls.find((c) => c[0] === 'online-expire')
    expect(call).toBeDefined()
    expect(call![1]).toEqual({ type: 'online_expire', appointmentId: 'appt-1' })
    expect(call![2].jobId).toBe('online-expire-appt-1')
    expect(call![2].delay).toBeGreaterThan(24 * H - 10_000)
    expect(call![2].delay).toBeLessThanOrEqual(24 * H)
  })

  it('K3: randevu yakinsa sure dolumu randevudan 2 saat once olur', async () => {
    await book(makeApp(), validBody({ startAt: isoNoMs(new Date(Date.now() + 5 * H)) }))
    const call = queueMock.add.mock.calls.find((c) => c[0] === 'online-expire')!
    expect(call[2].delay).toBeGreaterThan(3 * H - 10_000)
    expect(call[2].delay).toBeLessThanOrEqual(3 * H)
  })

  it('K3: dolum suresi kisa kalan randevu (2,5 saatten yakin) kabul edilmez: 400 TOO_SOON_FOR_APPROVAL, kayit olusmaz', async () => {
    const res = await book(makeApp(), validBody({ startAt: isoNoMs(new Date(Date.now() + 2 * H)) }))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('TOO_SOON_FOR_APPROVAL')
    expect(dbMock.appointment.create).not.toHaveBeenCalled()
  })

  it('none modunda hatirlatma SMS isleri kurulmaz (SMS kapali)', async () => {
    await book(makeApp())
    const names = queueMock.add.mock.calls.map((c) => c[0])
    expect(names).not.toContain('reminder-24h')
    expect(names).not.toContain('reminder-2h')
  })

  it('S2 Kritik 1: dogrulamasiz modda yanit telefona gore degismez (bekleyen/aktif talebi olan ve olmayan telefon ayni durum, gövde bicimi ve kayit davranisi)', async () => {
    const clean = await book(makeApp(), validBody({ customerPhone: '0555 111 22 33' }))
    counts.phonePending = 5
    counts.active = 5
    const busy = await book(makeApp(), validBody({ customerPhone: '0555 999 88 77' }))
    expect(busy.status).toBe(clean.status)
    expect(Object.keys(busy.body).sort()).toEqual(Object.keys(clean.body).sort())
    for (const key of ['status', 'approvalRequired', 'phoneVerified']) expect(busy.body[key]).toBe(clean.body[key])
    // ikisi de gercekten olusur ve sure dolumu isi kurulur: slot ve zamanlama telefondan bagimsiz
    expect(dbMock.appointment.create).toHaveBeenCalledTimes(2)
    expect(queueMock.add.mock.calls.filter((c) => c[0] === 'online-expire')).toHaveLength(2)
  })

  it('S2 Kritik 1: dogrulamasiz modda telefona ozgu hicbir sayim sorgusu yapilmaz (yalniz kiraci gunluk tavani sayilir)', async () => {
    await book(makeApp())
    const wheres = dbMock.appointment.count.mock.calls.map((c) => c[0].where)
    expect(wheres).toHaveLength(1)
    expect(wheres[0].OR).toBeUndefined()
    expect(wheres[0]).toMatchObject({ tenantId: 't1', bookingChannel: 'web', status: 'pending', isDeleted: false })
  })

  it('K2 tavan: kiracida 24 saatte 20 bekleyen talep varsa 429 TENANT_DAILY_LIMIT ve durust metin', async () => {
    counts.tenantPending = 20
    const res = await book(makeApp())
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('TENANT_DAILY_LIMIT')
    expect(res.body.error.message).toBe('Online randevu şu an alınamıyor, lütfen salonu arayın.')
    expect(dbMock.appointment.create).not.toHaveBeenCalled()
  })

  it('K2 tavan: 19 bekleyen talepte (sinirin hemen alti) talep kabul edilir', async () => {
    counts.tenantPending = 19
    expect((await book(makeApp())).status).toBe(201)
  })




  it('S2 Kritik 1: kiracı gunluk tavanina takilan 429 yanitlari da IP kotasini tuketir (4. istek RATE_LIMIT)', async () => {
    counts.tenantPending = 20
    const app = makeApp()
    for (let i = 0; i < 3; i++) expect((await book(app)).body.error.code).toBe('TENANT_DAILY_LIMIT')
    const res = await book(app)
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMIT')
  })

  it('K2 tavan: ayni IP saatte 3 talep alir, 4. talep 429 RATE_LIMIT', async () => {
    const app = makeApp()
    for (let i = 0; i < 3; i++) expect((await book(app)).status).toBe(201)
    const res = await book(app)
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMIT')
  })

  it('K2 tavan: basarisiz denemeler (captcha) IP sayacini tuketmez; sonraki 3 gecerli talep yine kabul edilir', async () => {
    const app = makeApp()
    turnstileMock.verifyTurnstile.mockResolvedValue(false)
    for (let i = 0; i < 4; i++) expect((await book(app)).status).toBe(400)
    turnstileMock.verifyTurnstile.mockResolvedValue(true)
    for (let i = 0; i < 3; i++) expect((await book(app)).status).toBe(201)
  })

  it('K4: Turnstile basarisizsa 400 CAPTCHA_FAILED, kayit olusmaz', async () => {
    turnstileMock.verifyTurnstile.mockResolvedValue(false)
    const res = await book(makeApp())
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('CAPTCHA_FAILED')
    expect(dbMock.appointment.create).not.toHaveBeenCalled()
  })

  it('K4: Turnstile yapilandirilmamissa (uretimde gizli anahtar yok) 503 CAPTCHA_UNAVAILABLE, kayit olusmaz', async () => {
    turnstileMock.isTurnstileUnavailable.mockReturnValue(true)
    const res = await book(makeApp())
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('CAPTCHA_UNAVAILABLE')
    expect(dbMock.appointment.create).not.toHaveBeenCalled()
    expect(turnstileMock.verifyTurnstile).not.toHaveBeenCalled()
  })

  it('slot doluysa 409 SLOT_TAKEN', async () => {
    dbMock.appointment.findFirst.mockResolvedValue({ id: 'other' })
    const res = await book(makeApp())
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SLOT_TAKEN')
  })

  it('S3-K2: on kontrolden sonra veritabani cakisma kisiti (23P01) tetiklenirse de 409 SLOT_TAKEN', async () => {
    dbMock.appointment.create.mockRejectedValueOnce(new Error('conflicting key value violates exclusion constraint "appointments_staff_no_overlap" (code: 23P01)'))
    const res = await book(makeApp())
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SLOT_TAKEN')
    expect(queueMock.add).not.toHaveBeenCalled()
  })

  it('S3-K2: cakisma disindaki veritabani hatasi 409 olmaz (500)', async () => {
    dbMock.appointment.create.mockRejectedValueOnce(new Error('connection refused'))
    expect((await book(makeApp())).status).toBe(500)
  })

  it('GET /tenant bookingMode=approval_required doner', async () => {
    const res = await request(makeApp()).get('/api/v1/tenants/salon/public/tenant')
    expect(res.status).toBe(200)
    expect(res.body.bookingMode).toBe('approval_required')
  })
})

describe('S2: none modunda yakin saatler slot listesinde kapali', () => {
  it('2,5 saatten yakin slot available=false, uzak slot acik; sms modunda hepsi acik', async () => {
    const near = new Date(Date.now() + 2 * H).toISOString().replace(/\.\d{3}Z$/, 'Z')
    const far = new Date(Date.now() + 6 * H).toISOString().replace(/\.\d{3}Z$/, 'Z')
    slotsMock.getSlots.mockResolvedValue([
      { id: near, label: '10:00', available: true },
      { id: far, label: '14:00', available: true },
    ])
    const url = `/api/v1/tenants/salon/public/slots?serviceId=${SERVICE_ID}&staffId=${STAFF_ID}&date=2030-01-01`
    const none = await request(makeApp()).get(url)
    expect(none.body.slots.map((x: { available: boolean }) => x.available)).toEqual([false, true])
    process.env.NETGSM_USERCODE = 'kullanici'
    const sms = await request(makeApp()).get(url)
    expect(sms.body.slots.map((x: { available: boolean }) => x.available)).toEqual([true, true])
  })
})

describe('S2 sms modu: dogrulama ve T3 devrede', () => {
  beforeEach(() => {
    process.env.NETGSM_USERCODE = 'kullanici'
    dbMock.phoneVerification.findFirst.mockResolvedValue({ id: 'pv1', consumedAt: new Date() })
  })

  it('S2 Kritik 1: sms modunda tavan sorgusu dogrulamadan sonra yapilir; dogrulanmamis telefon tavan durumunu ogrenemez (403)', async () => {
    dbMock.phoneVerification.findFirst.mockResolvedValue(null)
    counts.active = 2
    const res = await book(makeApp())
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('PHONE_NOT_VERIFIED')
  })

  it('S2: sms modunda dogrulanmis telefon aktif randevu sinirina takilirsa durust 429 TOO_MANY_BOOKINGS alir', async () => {
    counts.active = 2
    const res = await book(makeApp())
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('TOO_MANY_BOOKINGS')
    expect(dbMock.appointment.create).not.toHaveBeenCalled()
  })

  it('S2: sms modunda kayitli musteri farkli telefon bicimiyle bulunur (en eski kayit) ve baglanir', async () => {
    dbMock.customer.findMany.mockResolvedValue([{ id: 'cust-old' }])
    await book(makeApp())
    expect(dbMock.customer.create).not.toHaveBeenCalled()
    const data = dbMock.appointment.create.mock.calls[0][0].data
    expect(data.customerId).toBe('cust-old')
    expect(data.requestedPhone).toBeNull()
    const arg = dbMock.customer.findMany.mock.calls[0][0]
    expect(arg.where.tenantId).toBe('t1')
    expect(arg.where.phone.in).toEqual(expect.arrayContaining(['+905551112233', '05551112233']))
    expect(arg.orderBy).toEqual({ createdAt: 'asc' })
    expect(dbMock.customer.update.mock.calls[0][0].data.phoneVerifiedAt).toBeInstanceOf(Date)
  })

  it('ADR-0038 sms none: telefon kayitli degilse musteri olusturulur ve talep ona baglanir', async () => {
    setTenant({ onlineBookingApproval: 'auto' })
    const res = await book(makeApp())
    expect(res.status).toBe(201)
    expect(dbMock.customer.create).toHaveBeenCalledTimes(1)
    expect(dbMock.appointment.create.mock.calls[0][0].data).toMatchObject({ customerId: 'cust-1', requestedPhone: null, status: 'confirmed' })
  })

  it('ADR-0038 sms multiple: ayni telefonda birden cok kart varsa talep HICBIRINE baglanmaz; requested* dolu, pending, hatirlatma yok', async () => {
    setTenant({ onlineBookingApproval: 'auto' })
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])
    const res = await book(makeApp())
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ status: 'pending', approvalRequired: true, phoneVerified: true })
    const data = dbMock.appointment.create.mock.calls[0][0].data
    expect(data).toMatchObject({ customerId: null, requestedName: 'Ayşe Yılmaz', requestedPhone: '+905551112233', status: 'pending', phoneVerified: true })
    expect(dbMock.customer.create).not.toHaveBeenCalled()
    expect(dbMock.customer.update).not.toHaveBeenCalled()
    const jobs = queueMock.add.mock.calls.map((c) => c[0])
    expect(jobs).toContain('online-expire')
    expect(jobs).not.toContain('reminder-24h')
  })

  it('K5: telefon dogrulanmamissa 403 PHONE_NOT_VERIFIED, kayit olusmaz', async () => {
    dbMock.phoneVerification.findFirst.mockResolvedValue(null)
    const res = await book(makeApp())
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('PHONE_NOT_VERIFIED')
    expect(dbMock.appointment.create).not.toHaveBeenCalled()
  })

  it('K5: dogrulanmis telefon + salon otomatik onayi -> confirmed, phoneVerified=true, sure dolumu kurulmaz', async () => {
    setTenant({ onlineBookingApproval: 'auto' })
    const res = await book(makeApp())
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ status: 'confirmed', approvalRequired: false, phoneVerified: true })
    expect(dbMock.appointment.create.mock.calls[0][0].data).toMatchObject({ status: 'confirmed', phoneVerified: true })
    expect(dbMock.customer.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', phone: '+905551112233', phoneVerifiedAt: expect.any(Date) })
    expect(queueMock.add.mock.calls.map((c) => c[0])).not.toContain('online-expire')
  })

  it('K5: dogrulanmis telefon + "ben onaylayayim" -> pending ama phoneVerified=true ve sure dolumu kurulur', async () => {
    setTenant({ onlineBookingApproval: 'manual' })
    const res = await book(makeApp())
    expect(res.body).toMatchObject({ status: 'pending', approvalRequired: true, phoneVerified: true })
    expect(queueMock.add.mock.calls.map((c) => c[0])).toContain('online-expire')
  })

  it('K5: ayar yoksa salon turu otomatik, klinik turu (dentist) elle onay varsayilir', async () => {
    setTenant({}, 'beauty_center')
    expect((await book(makeApp())).body.status).toBe('confirmed')
    setTenant({}, 'dentist')
    expect((await book(makeApp())).body.status).toBe('pending')
  })

  it('K5: tavanlar sms modunda da gecerli (kiracida gunluk 20 bekleyen talep -> 429)', async () => {
    counts.tenantPending = 20
    const res = await book(makeApp())
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('TENANT_DAILY_LIMIT')
  })

  it('K5: sms modunda hatirlatma isleri kurulur (onceki davranis korunur)', async () => {
    setTenant({ onlineBookingApproval: 'auto' })
    await book(makeApp())
    const names = queueMock.add.mock.calls.map((c) => c[0])
    expect(names).toEqual(expect.arrayContaining(['reminder-24h', 'reminder-2h']))
  })

  it('GET /tenant bookingMode=verified doner', async () => {
    const res = await request(makeApp()).get('/api/v1/tenants/salon/public/tenant')
    expect(res.body.bookingMode).toBe('verified')
  })
})

describe('A7 (ADR-0043): online fiyat ve musteri baglantisi', () => {
  const svcRow = { id: SERVICE_ID, name: 'Sac', durationMinutes: 60, category: null, price: 150 }
  const services = (app: express.Express) => request(app).get('/api/v1/tenants/salon/public/services')

  beforeEach(() => {
    dbMock.service.findMany.mockReset().mockResolvedValue([svcRow])
  })

  it('klinik olmayan tur varsayilan: /public/services fiyat dondurur', async () => {
    const res = await services(makeApp())
    expect(res.status).toBe(200)
    expect(res.body.data[0].price).toBe(150)
  })

  it('klinik turu (dentist) varsayilan: fiyat anahtari hic yok (null da degil)', async () => {
    setTenant({}, 'dentist')
    const res = await services(makeApp())
    expect(res.body.data[0]).not.toHaveProperty('price')
  })

  it('klinik ayari showPricesOnline:true acarsa fiyat gorunur; klinik olmayan tur ayarla kapatabilir', async () => {
    setTenant({ showPricesOnline: true }, 'dentist')
    expect((await services(makeApp())).body.data[0].price).toBe(150)
    setTenant({ showPricesOnline: false }, 'beauty_center')
    expect((await services(makeApp())).body.data[0]).not.toHaveProperty('price')
  })

  it('veritabanindan fiyat yalniz gosterilecekse secilir', async () => {
    setTenant({}, 'dentist')
    await services(makeApp())
    expect(dbMock.service.findMany.mock.calls[0][0].select).not.toHaveProperty('price')
  })

  it('/book: yanitta manageLink (FRONTEND_URL/book/manage#token) doner, veritabanina yalniz sha-256 ozeti yazilir', async () => {
    process.env.FRONTEND_URL = 'https://app.example.com'
    const res = await book(makeApp())
    expect(res.status).toBe(201)
    expect(res.body.manageLink.startsWith('https://app.example.com/book/manage#')).toBe(true)
    const token = res.body.manageLink.split('#')[1]
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const data = dbMock.appointment.create.mock.calls[0][0].data
    expect(data.manageTokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(data)).not.toContain(token)
  })

  it('/book yanitinda fiyat: klinik olmayan turde var, klinikte anahtar yok', async () => {
    expect((await book(makeApp())).body.price).toBe(150)
    setTenant({}, 'dentist')
    expect(await book(makeApp()).then((r) => r.body)).not.toHaveProperty('price')
  })
})
