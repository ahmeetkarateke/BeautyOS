import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createHash } from 'node:crypto'

// A7 / ADR-0043 + ADR-0046: musterinin randevu baglantisi (token govdede). db ve kuyruk sahte; DB/Redis gerekmez.
const m = vi.hoisted(() => ({
  db: {
    appointment: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    staffProfile: { findFirst: vi.fn() },
  },
  scheduleReminders: vi.fn(),
  cancelReminders: vi.fn(),
  scheduleOnlineExpiry: vi.fn(),
  removeExpiryJob: vi.fn(),
}))

vi.mock('../lib/db', () => ({ db: m.db }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() }, scheduleReminders: m.scheduleReminders, cancelReminders: m.cancelReminders }))
vi.mock('../lib/online-booking', () => ({
  scheduleOnlineExpiry: m.scheduleOnlineExpiry,
  removeExpiryJob: m.removeExpiryJob,
  computeExpiryAt: () => new Date(Date.now() + 3_600_000),
}))

import { createBookingManageRouter } from '../routes/bookings-public.route'

const app = express().use(express.json()).use('/api/v1/public/bookings', createBookingManageRouter({ limitMax: 10_000 }))
const TOKEN = 'M'.repeat(43)
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const H = 3_600_000
// findFirst iki sorguya hizmet eder: token ile randevu aramasi ve cakisma aramasi (token yok).
let conflictResult: unknown = null
const setBooking = (b: unknown) =>
  m.db.appointment.findFirst.mockImplementation(async ({ where }: { where: { manageTokenHash?: string } }) => (where.manageTokenHash ? b : conflictResult))
const post = (path: string, body: object = { token: TOKEN }) => request(app).post(`/api/v1/public/bookings/${path}`).send(body)

function booking(over: Record<string, unknown> = {}) {
  const startAt = new Date(Date.now() + 48 * H)
  return {
    id: 'a1', tenantId: 't1', status: 'confirmed', referenceCode: 'RDV-1', customerId: 'c1', staffId: 's1', serviceId: 'sv1',
    startAt, endAt: new Date(startAt.getTime() + H), priceCharged: 250,
    service: { name: 'Sac Boyama', durationMinutes: 60, bufferMinutes: 0 },
    staff: { user: { fullName: 'Uzman Ali' } },
    tenant: { name: 'Salon X', slug: 'salon-x', businessType: 'hair_salon', settings: { phone: '05320000000', address: 'Moda Cd. 5' } },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  conflictResult = null
  setBooking(booking())
  m.db.appointment.updateMany.mockResolvedValue({ count: 1 })
  m.db.appointment.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'a1', ...data }))
  m.db.staffProfile.findFirst.mockResolvedValue({ id: 's1' })
  for (const f of [m.scheduleReminders, m.cancelReminders, m.scheduleOnlineExpiry, m.removeExpiryJob]) f.mockResolvedValue(undefined)
})

describe('POST /public/bookings/lookup', () => {
  it('gecerli token: randevu ozeti, canModify ve modifyDeadline (baslangic - 2 saat) doner; sorgu ozet olarak yapilir', async () => {
    const res = await post('lookup')
    expect(res.status).toBe(200)
    expect(res.body.tenant).toEqual({ name: 'Salon X', slug: 'salon-x', phone: '05320000000', address: 'Moda Cd. 5' })
    expect(res.body.appointment).toMatchObject({ referenceCode: 'RDV-1', status: 'confirmed', serviceName: 'Sac Boyama', staffName: 'Uzman Ali' })
    expect(res.body.canModify).toBe(true)
    const start = new Date(res.body.appointment.startAt).getTime()
    expect(new Date(res.body.modifyDeadline).getTime()).toBe(start - 2 * H)
    const where = m.db.appointment.findFirst.mock.calls[0][0].where
    expect(where.manageTokenHash).toBe(sha256(TOKEN))
    expect(where.isDeleted).toBe(false)
    expect(where.startAt.gt).toBeInstanceOf(Date)
  })

  it('yanitta musteri adi/telefonu yok; token hicbir yanitta geri donmez', async () => {
    const res = await post('lookup')
    expect(JSON.stringify(res.body)).not.toContain(TOKEN)
    expect(JSON.stringify(res.body)).not.toMatch(/customerName|customerPhone|requestedPhone|manageTokenHash/)
  })

  it('bilinmeyen / suresi dolmus token tek yanit: 404 BOOKING_NOT_FOUND', async () => {
    setBooking(null)
    const res = await post('lookup', { token: 'X'.repeat(43) })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('BOOKING_NOT_FOUND')
  })

  it('2 saatten az kalmis randevu: canModify false', async () => {
    setBooking(booking({ startAt: new Date(Date.now() + 1 * H), endAt: new Date(Date.now() + 2 * H) }))
    expect((await post('lookup')).body.canModify).toBe(false)
  })

  it('iptal edilmis randevu: canModify false', async () => {
    setBooking(booking({ status: 'cancelled' }))
    expect((await post('lookup')).body.canModify).toBe(false)
  })

  it('fiyat: klinik turunde (dentist) varsayilan kapali, `price` anahtari hic yok', async () => {
    setBooking(booking({ tenant: { name: 'K', slug: 'k', businessType: 'dentist', settings: {} } }))
    const res = await post('lookup')
    expect(res.body.appointment).not.toHaveProperty('price')
  })

  it('fiyat: klinik ayari acarsa gorunur; klinik olmayan tur varsayilan acik; ayar kapatirsa yok', async () => {
    setBooking(booking({ tenant: { name: 'K', slug: 'k', businessType: 'dentist', settings: { showPricesOnline: true } } }))
    expect((await post('lookup')).body.appointment.price).toBe(250)
    setBooking(booking())
    expect((await post('lookup')).body.appointment.price).toBe(250)
    setBooking(booking({ tenant: { name: 'S', slug: 's', businessType: 'hair_salon', settings: { showPricesOnline: false } } }))
    const hidden = await post('lookup')
    expect(hidden.body.appointment).not.toHaveProperty('price')
  })
})

describe('ADR-0046: token yalniz govdede', () => {
  it('URL yolunda token (GET ve POST) calismaz: 404, veritabani sorgulanmaz', async () => {
    expect((await request(app).get(`/api/v1/public/bookings/${TOKEN}`)).status).toBe(404)
    expect((await request(app).post(`/api/v1/public/bookings/${TOKEN}/cancel`).send({})).status).toBe(404)
    expect(m.db.appointment.findFirst).not.toHaveBeenCalled()
  })

  it.each(['lookup', 'cancel', 'calendar'])('%s: token eksik/kisa 400 VALIDATION_ERROR ve sorgu dizgisindeki token yok sayilir', async (path) => {
    const missing = await post(path, {})
    expect(missing.status).toBe(400)
    expect(missing.body.error.code).toBe('VALIDATION_ERROR')
    const query = await request(app).post(`/api/v1/public/bookings/${path}?token=${TOKEN}`).send({})
    expect(query.status).toBe(400)
    expect(JSON.stringify(missing.body)).not.toContain(TOKEN)
  })

  it('reschedule: startAt eksikse 400', async () => {
    expect((await post('reschedule', { token: TOKEN })).status).toBe(400)
  })
})

describe('POST /public/bookings/cancel', () => {
  it('mutlu yol: kosullu guncelleme (ozet, durum, 2 saat), iptal nedeni cancelled_by_customer, isler silinir', async () => {
    const res = await post('cancel')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'cancelled' })
    const call = m.db.appointment.updateMany.mock.calls[0][0]
    expect(call.where).toMatchObject({ manageTokenHash: sha256(TOKEN), isDeleted: false, status: { in: ['pending', 'confirmed'] } })
    expect(call.where.startAt.gt).toBeInstanceOf(Date)
    expect(call.data).toMatchObject({ status: 'cancelled', cancelReason: 'cancelled_by_customer' })
    expect(m.cancelReminders).toHaveBeenCalledWith('a1')
    expect(m.removeExpiryJob).toHaveBeenCalledWith('a1')
  })

  it('2 saatten az kalmis: 409 MODIFY_WINDOW_CLOSED, iptal yazilmaz', async () => {
    setBooking(booking({ startAt: new Date(Date.now() + 1 * H), endAt: new Date(Date.now() + 2 * H) }))
    const res = await post('cancel')
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('MODIFY_WINDOW_CLOSED')
    expect(m.db.appointment.updateMany).not.toHaveBeenCalled()
  })

  it('2 saat sinirinin 1 dakika oncesi gecer, 1 dakika sonrasi kapali', async () => {
    const before = new Date(Date.now() + 2 * H + 60_000)
    setBooking(booking({ startAt: before, endAt: new Date(before.getTime() + H) }))
    expect((await post('cancel')).status).toBe(200)
    const after = new Date(Date.now() + 2 * H - 60_000)
    setBooking(booking({ startAt: after, endAt: new Date(after.getTime() + H) }))
    expect((await post('cancel')).status).toBe(409)
  })

  it.each(['completed', 'cancelled', 'no_show', 'in_progress'])('%s durumundaki randevu: 409 BOOKING_NOT_MODIFIABLE', async (status) => {
    setBooking(booking({ status }))
    const res = await post('cancel')
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('BOOKING_NOT_MODIFIABLE')
    expect(m.db.appointment.updateMany).not.toHaveBeenCalled()
  })

  it('gecersiz token 404 BOOKING_NOT_FOUND', async () => {
    setBooking(null)
    const res = await post('cancel')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('BOOKING_NOT_FOUND')
  })

  it('yaris: guncelleme count 0 ise iptal basarili sayilmaz (409 BOOKING_NOT_MODIFIABLE), isler silinmez', async () => {
    m.db.appointment.updateMany.mockResolvedValue({ count: 0 })
    const res = await post('cancel')
    expect(res.status).toBe(409)
    expect(m.cancelReminders).not.toHaveBeenCalled()
  })
})

describe('POST /public/bookings/reschedule', () => {
  const newStart = () => new Date(Date.now() + 96 * H)

  it('mutlu yol (otomatik onay modunda musterili randevu): saat degisir, token ayni kalir, durum confirmed, isler yeniden kurulur', async () => {
    const start = newStart()
    const res = await post('reschedule', { token: TOKEN, startAt: start.toISOString() })
    expect(res.status).toBe(200)
    const data = m.db.appointment.update.mock.calls[0][0].data
    expect(data.startAt.getTime()).toBe(start.getTime())
    expect(data.endAt.getTime()).toBe(start.getTime() + H)
    expect(data).not.toHaveProperty('manageTokenHash')
    expect(data.status).toBe('confirmed')
    expect(m.cancelReminders).toHaveBeenCalledWith('a1')
    expect(m.scheduleReminders).toHaveBeenCalledTimes(1)
    expect(m.scheduleReminders.mock.calls[0][0]).toMatchObject({ appointmentId: 'a1', tenantId: 't1' })
  })

  it('elle onay modunda (klinik varsayilani) yeniden pending olur, onay suresi dolumu kurulur, hatirlatma kurulmaz', async () => {
    setBooking(booking({ tenant: { name: 'K', slug: 'k', businessType: 'dentist', settings: {} } }))
    const res = await post('reschedule', { token: TOKEN, startAt: newStart().toISOString() })
    expect(res.status).toBe(200)
    expect(m.db.appointment.update.mock.calls[0][0].data.status).toBe('pending')
    expect(m.scheduleOnlineExpiry).toHaveBeenCalledTimes(1)
    expect(m.scheduleReminders).not.toHaveBeenCalled()
  })

  it('musterisiz (dogrulanmamis) talep her zaman pending kalir', async () => {
    setBooking(booking({ customerId: null, status: 'pending' }))
    await post('reschedule', { token: TOKEN, startAt: newStart().toISOString() })
    expect(m.db.appointment.update.mock.calls[0][0].data.status).toBe('pending')
  })

  it('cakisma (ayni personelde dolu saat): 409 SLOT_TAKEN, yazilmaz', async () => {
    conflictResult = { id: 'baska' }
    const res = await post('reschedule', { token: TOKEN, startAt: newStart().toISOString() })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SLOT_TAKEN')
    expect(m.db.appointment.update).not.toHaveBeenCalled()
  })

  it('cakisma sorgusu kendi randevusunu haric tutar ve kiraciya baglidir', async () => {
    await post('reschedule', { token: TOKEN, startAt: newStart().toISOString() })
    const conflictWhere = m.db.appointment.findFirst.mock.calls[1][0].where
    expect(conflictWhere).toMatchObject({ tenantId: 't1', staffId: 's1', id: { not: 'a1' } })
  })

  it('2 saatten az kalmis randevu: 409 MODIFY_WINDOW_CLOSED', async () => {
    setBooking(booking({ startAt: new Date(Date.now() + 1 * H), endAt: new Date(Date.now() + 2 * H) }))
    const res = await post('reschedule', { token: TOKEN, startAt: newStart().toISOString() })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('MODIFY_WINDOW_CLOSED')
  })

  it('gecmise ya da 3 saatten yakina tasima 400', async () => {
    const past = await post('reschedule', { token: TOKEN, startAt: new Date(Date.now() - H).toISOString() })
    expect(past.status).toBe(400)
    const soon = await post('reschedule', { token: TOKEN, startAt: new Date(Date.now() + 1 * H).toISOString() })
    expect(soon.status).toBe(400)
    expect(m.db.appointment.update).not.toHaveBeenCalled()
  })

  it('staffId verilirse personel online randevu kabul etmeli ve hizmeti yapabilmeli (kiraciya bagli), yoksa 404', async () => {
    m.db.staffProfile.findFirst.mockResolvedValue(null)
    const res = await post('reschedule', { token: TOKEN, startAt: newStart().toISOString(), staffId: '00000000-0000-4000-8000-000000000009' })
    expect(res.status).toBe(404)
    const where = m.db.staffProfile.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ tenantId: 't1', acceptsOnlineBooking: true })
  })

  it('tamamlanmis randevu: 409 BOOKING_NOT_MODIFIABLE', async () => {
    setBooking(booking({ status: 'completed' }))
    const res = await post('reschedule', { token: TOKEN, startAt: newStart().toISOString() })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('BOOKING_NOT_MODIFIABLE')
  })
})

describe('POST /public/bookings/calendar', () => {
  it('text/calendar doner: UID, UTC saatler, konum; fiyat ve musteri bilgisi yok', async () => {
    const res = await post('calendar')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/calendar/)
    expect(res.text).toContain('BEGIN:VCALENDAR')
    expect(res.text).toContain('UID:a1@beautyossapp.com')
    expect(res.text).toMatch(/DTSTART:\d{8}T\d{6}Z/)
    expect(res.text).toContain('LOCATION:Moda Cd. 5')
    expect(res.text).toContain('SUMMARY:Salon X - Sac Boyama')
    expect(res.text).not.toMatch(/250|PRICE|Ayse/i)
  })

  it('klinikte ozet yalniz "Randevu": hizmet adi gecmez', async () => {
    setBooking(booking({ tenant: { name: 'K', slug: 'k', businessType: 'aesthetic_clinic', settings: {} } }))
    const res = await post('calendar')
    expect(res.text).toContain('SUMMARY:Randevu')
    expect(res.text).not.toContain('Sac Boyama')
  })

  it('gecersiz token 404 BOOKING_NOT_FOUND', async () => {
    setBooking(null)
    expect((await post('calendar')).status).toBe(404)
  })
})

describe('hiz siniri', () => {
  it('IP basina 15 dakikada 30 istek: 31. istek 429', async () => {
    const limited = express().use(express.json()).use('/b', createBookingManageRouter({ limitMax: 30 }))
    setBooking(null)
    let last = 0
    for (let i = 0; i < 31; i++) last = (await request(limited).post('/b/lookup').send({ token: TOKEN })).status
    expect(last).toBe(429)
  })
})
