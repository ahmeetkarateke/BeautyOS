import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Bu dosya veritabani ve Redis gerektirmez: db, kuyruk, Turnstile ve SMS sahtelenir.
const dbMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  service: { findFirst: vi.fn() },
  staffProfile: { findFirst: vi.fn() },
  appointment: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  customer: { findFirst: vi.fn(), upsert: vi.fn() },
  phoneVerification: { findFirst: vi.fn() },
}))
const queueMock = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }))
const turnstileMock = vi.hoisted(() => ({ verifyTurnstile: vi.fn(), isTurnstileUnavailable: vi.fn() }))

vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: queueMock }))
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
  dbMock.customer.upsert.mockReset().mockResolvedValue({ id: 'cust-1' })
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
    expect(dbMock.customer.upsert).not.toHaveBeenCalled()
    expect(dbMock.customer.findFirst).not.toHaveBeenCalled()
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
    expect(dbMock.customer.findFirst).not.toHaveBeenCalled()
    expect(dbMock.customer.upsert).not.toHaveBeenCalled()
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

  it('S2 Kritik 1: telefon tavanina takilan istek basarili istekle ayni durum kodu ve ayni govde bicimini alir, kayit olusmaz', async () => {
    const ok = await book(makeApp())
    dbMock.appointment.create.mockClear()
    counts.phonePending = 1
    const capped = await book(makeApp())
    expect(capped.status).toBe(ok.status)
    expect(Object.keys(capped.body).sort()).toEqual(Object.keys(ok.body).sort())
    for (const key of ['status', 'approvalRequired', 'phoneVerified']) expect(capped.body[key]).toBe(ok.body[key])
    expect(capped.body.id).not.toBe(ok.body.id)
    expect(dbMock.appointment.create).not.toHaveBeenCalled()
    expect(queueMock.add).toHaveBeenCalledTimes(1) // yalniz ilk basarili talebin sure dolumu isi
  })

  it('K2 tavan: bekleyen talep sorgusu kiraci ve tum telefon bicimleriyle (musteri telefonu ya da talep telefonu) sinirlidir', async () => {
    await book(makeApp())
    const phoneCall = dbMock.appointment.count.mock.calls.map((c) => c[0].where).find((w) => w.OR && !w.status.in)!
    expect(phoneCall).toMatchObject({ tenantId: 't1', bookingChannel: 'web', status: 'pending', isDeleted: false })
    const requested = phoneCall.OR.find((c: Record<string, unknown>) => 'requestedPhone' in c)
    expect(requested.requestedPhone.in).toEqual(expect.arrayContaining(['+905551112233', '05551112233', '5551112233']))
    const linked = phoneCall.OR.find((c: Record<string, unknown>) => 'customer' in c)
    expect(linked.customer.phone.in).toEqual(expect.arrayContaining(['+905551112233']))
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

  it('S2 Kritik 1: aktif randevu siniri (telefon basina 2) da ayni ayirt edilemez yaniti verir, kayit olusmaz', async () => {
    const ok = await book(makeApp())
    dbMock.appointment.create.mockClear()
    counts.active = 2
    const capped = await book(makeApp())
    expect(capped.status).toBe(201)
    expect(Object.keys(capped.body).sort()).toEqual(Object.keys(ok.body).sort())
    expect(capped.body.status).toBe('pending')
    expect(dbMock.appointment.create).not.toHaveBeenCalled()
  })

  it('S2 Kritik 1: telefon tavani gecerli servis/personel gerektirir (gecersiz servis 404, telefon durumu sizmaz)', async () => {
    counts.phonePending = 1
    dbMock.service.findFirst.mockResolvedValue(null)
    const res = await book(makeApp())
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('S2 Kritik 1: dolu slotta tavan sorgusu yapilmaz (409 SLOT_TAKEN)', async () => {
    counts.phonePending = 1
    dbMock.appointment.findFirst.mockResolvedValue({ id: 'other' })
    const res = await book(makeApp())
    expect(res.status).toBe(409)
    expect(dbMock.appointment.count).not.toHaveBeenCalled()
  })

  it('S2 Kritik 1: tavana takilan istekler de IP kotasini tuketir (4. istek 429 RATE_LIMIT)', async () => {
    counts.phonePending = 1
    const app = makeApp()
    for (let i = 0; i < 3; i++) expect((await book(app)).status).toBe(201)
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
    dbMock.customer.findFirst.mockResolvedValue({ id: 'cust-old', phone: '05551112233' })
    await book(makeApp())
    expect(dbMock.customer.upsert).not.toHaveBeenCalled()
    const data = dbMock.appointment.create.mock.calls[0][0].data
    expect(data.customerId).toBe('cust-old')
    expect(data.requestedPhone).toBeNull()
    const arg = dbMock.customer.findFirst.mock.calls[0][0]
    expect(arg.where.tenantId).toBe('t1')
    expect(arg.where.phone.in).toEqual(expect.arrayContaining(['+905551112233', '05551112233']))
    expect(arg.orderBy).toEqual({ createdAt: 'asc' })
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
    expect(dbMock.customer.upsert.mock.calls[0][0].create.phoneVerifiedAt).toBeInstanceOf(Date)
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
