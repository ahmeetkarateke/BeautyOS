import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// ADR-0038: ayni telefonla birden cok musteri. Yardimci, bot ve panel yollari; db sahte, DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  customer: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  service: { findFirst: vi.fn(), findMany: vi.fn() },
  appointment: { create: vi.fn() },
}))
vi.mock('../lib/db', () => ({ db: dbMock }))
const queueMock = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }))
vi.mock('../lib/queue', () => ({ remindersQueue: queueMock }))
vi.mock('../middleware/auth.middleware', () => ({
  authenticateJWT: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'u-me', tenantId: 't1', tenantSlug: 'salon', role: String(req.headers['x-role']) } as never
    next()
  },
  requireTenantAccess: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = 't1'
    next()
  },
  checkTenantActive: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

import { resolveCustomerByPhone } from '../lib/customer-phone'
import { createAppointment } from '../bot/booking.service'
import { createTenantRouter } from '../routes/tenant.route'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('resolveCustomerByPhone', () => {
  it('K-helper: kayit yoksa none, tek kayit single, birden cok kayit multiple (en eski once)', async () => {
    dbMock.customer.findMany.mockResolvedValueOnce([])
    expect(await resolveCustomerByPhone(dbMock, 't1', '+905551112233')).toEqual({ kind: 'none' })
    dbMock.customer.findMany.mockResolvedValueOnce([{ id: 'c1' }])
    expect(await resolveCustomerByPhone(dbMock, 't1', '+905551112233')).toEqual({ kind: 'single', id: 'c1' })
    dbMock.customer.findMany.mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }])
    expect(await resolveCustomerByPhone(dbMock, 't1', '+905551112233')).toEqual({ kind: 'multiple', ids: ['c1', 'c2'] })
    expect(dbMock.customer.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'asc' })
  })

  it('K-helper: sorgu kiraciya baglidir ve telefonun eski bicimlerini de arar', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    await resolveCustomerByPhone(dbMock, 't1', '+905551112233')
    const where = dbMock.customer.findMany.mock.calls[0][0].where
    expect(where.tenantId).toBe('t1')
    expect(where.phone.in).toEqual(expect.arrayContaining(['+905551112233', '05551112233', '5551112233']))
  })

  it('K-helper: telefon olmayan kimlik (Telegram sohbet no) oldugu gibi aranir', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    await resolveCustomerByPhone(dbMock, 't1', '123456789')
    expect(dbMock.customer.findMany.mock.calls[0][0].where.phone.in).toEqual(['123456789'])
  })

  it('K-helper: exact kipinde telefon gibi gorunen kanal kimligi normalize edilip gercek telefonla eslesmez (905321234567 !~ +905321234567)', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    await resolveCustomerByPhone(dbMock, 't1', '905321234567', { exact: true })
    expect(dbMock.customer.findMany.mock.calls[0][0].where.phone.in).toEqual(['905321234567'])
    await resolveCustomerByPhone(dbMock, 't1', '905321234567')
    expect(dbMock.customer.findMany.mock.calls[1][0].where.phone.in).toContain('+905321234567')
  })

  it('K-izolasyon: B kiracisinda ayni telefon varken A icin sorgu tenantId=A ile yapilir (sonuc B kartini icermez)', async () => {
    dbMock.customer.findMany.mockImplementation(async ({ where }: { where: { tenantId: string } }) =>
      where.tenantId === 'tB' ? [{ id: 'cB' }] : [],
    )
    expect(await resolveCustomerByPhone(dbMock, 'tB', '+905551112233')).toEqual({ kind: 'single', id: 'cB' })
    expect(await resolveCustomerByPhone(dbMock, 'tA', '+905551112233')).toEqual({ kind: 'none' })
  })
})

describe('bot createAppointment (ADR-0038)', () => {
  const input = { tenantId: 't1', customerPhone: '905320000001', customerName: 'Ayse', serviceName: 'Saç Kesimi', slotId: '2026-11-20T10:00:00__sp1', channel: 'whatsapp' as const }

  beforeEach(() => {
    dbMock.service.findFirst.mockResolvedValue({ id: 'sv1', durationMinutes: 30, bufferMinutes: 0, price: 250 })
    dbMock.appointment.create.mockResolvedValue({ id: 'appt-1' })
    queueMock.add.mockResolvedValue({})
    dbMock.customer.create.mockResolvedValue({ id: 'c-new' })
    dbMock.customer.update.mockResolvedValue({})
  })

  it('K-bot: none -> musteri olusur, randevu confirmed ve musteriye bagli', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    const r = await createAppointment(input)
    expect(r.status).toBe('confirmed')
    expect(r.referenceCode).toMatch(/^RDV-/)
    expect(dbMock.appointment.create.mock.calls[0][0].data).toMatchObject({ customerId: 'c-new', status: 'confirmed' })
  })

  it('K-bot: Telegram kanalinda sohbet no telefon gibi normalize edilmez; WhatsApp kanalinda normalize aranir', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    await createAppointment({ ...input, customerPhone: '905321234567', channel: 'telegram' })
    expect(dbMock.customer.findMany.mock.calls[0][0].where.phone.in).toEqual(['905321234567'])
    await createAppointment({ ...input, customerPhone: '905321234567', channel: 'whatsapp' })
    expect(dbMock.customer.findMany.mock.calls[1][0].where.phone.in).toContain('+905321234567')
  })

  it('ADR-0038 Onemli 1: bot multiple talebi icin sure dolumu is kurulur (belirlenimci jobId); musterili randevuda kurulmaz', async () => {
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])
    await createAppointment(input)
    expect(queueMock.add).toHaveBeenCalledWith('online-expire', { type: 'online_expire', appointmentId: 'appt-1' }, expect.objectContaining({ jobId: 'online-expire-appt-1' }))
    queueMock.add.mockClear()
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c-old' }])
    await createAppointment(input)
    expect(queueMock.add).not.toHaveBeenCalled()
  })

  it('ADR-0038 Onemli 2: WhatsApp multiple talebinde requestedPhone normalize saklanir (+90...), Telegram sohbet no oldugu gibi', async () => {
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])
    await createAppointment({ ...input, customerPhone: '905320000001', channel: 'whatsapp' })
    expect(dbMock.appointment.create.mock.calls[0][0].data.requestedPhone).toBe('+905320000001')
    await createAppointment({ ...input, customerPhone: '905320000001', channel: 'telegram' })
    expect(dbMock.appointment.create.mock.calls[1][0].data.requestedPhone).toBe('905320000001')
  })

  it('ADR-0038 Onemli 2: WhatsApp none yolunda yeni musterinin telefonu normalize yazilir', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    await createAppointment({ ...input, customerPhone: '905320000001', channel: 'whatsapp' })
    expect(dbMock.customer.create.mock.calls[0][0].data.phone).toBe('+905320000001')
  })

  it('K-bot: single -> var olan karta baglanir, yeni musteri olusmaz', async () => {
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c-old' }])
    const r = await createAppointment(input)
    expect(r.status).toBe('confirmed')
    expect(dbMock.customer.create).not.toHaveBeenCalled()
    expect(dbMock.appointment.create.mock.calls[0][0].data.customerId).toBe('c-old')
  })

  it('K-bot: multiple -> hicbir karta baglanmaz; requested* dolu, pending (salon eslestirir), ziyaret sayaci artmaz', async () => {
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])
    const r = await createAppointment(input)
    expect(r.status).toBe('pending')
    const data = dbMock.appointment.create.mock.calls[0][0].data
    expect(data).toMatchObject({ customerId: null, requestedName: 'Ayse', requestedPhone: '+905320000001', status: 'pending' })
    expect(dbMock.customer.create).not.toHaveBeenCalled()
    expect(dbMock.customer.update).not.toHaveBeenCalled()
  })
})

describe('panel: ortak telefon yalniz bilincli (allowSharedPhone)', () => {
  const app = express().use(express.json()).use('/api/v1/tenants/:slug', createTenantRouter())
  const URL = '/api/v1/tenants/salon'
  const owner = { 'x-role': 'owner' }
  const created = { id: 'c-new', fullName: 'Yeni', phone: '05551112233', email: null, totalVisits: 0, createdAt: new Date() }
  const body = { fullName: 'Yeni Kisi', phone: '05551112233' }

  it('K6: ayni telefon kayitliyken POST /customers varsayilan 409 DUPLICATE_PHONE ve yazmaz', async () => {
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c-old' }])
    const res = await request(app).post(`${URL}/customers`).set(owner).send(body)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_PHONE')
    expect(dbMock.customer.create).not.toHaveBeenCalled()
    expect(dbMock.customer.findMany.mock.calls[0][0].where.tenantId).toBe('t1')
  })

  it('K6: allowSharedPhone true ile ayni telefonla 201 olusur; allowSharedPhone kaydedilen veriye girmez', async () => {
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c-old' }])
    dbMock.customer.create.mockResolvedValue(created)
    const res = await request(app).post(`${URL}/customers`).set(owner).send({ ...body, allowSharedPhone: true })
    expect(res.status).toBe(201)
    expect(dbMock.customer.create.mock.calls[0][0].data).not.toHaveProperty('allowSharedPhone')
  })

  it('K6: telefon kayitli degilse bayraksiz 201', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    dbMock.customer.create.mockResolvedValue(created)
    expect((await request(app).post(`${URL}/customers`).set(owner).send(body)).status).toBe(201)
  })

  it('K6: allowSharedPhone boolean olmalidir ("true" metni 400)', async () => {
    const res = await request(app).post(`${URL}/customers`).set(owner).send({ ...body, allowSharedPhone: 'true' })
    expect(res.status).toBe(400)
  })

  const existing = { id: 'c1', fullName: 'Ayse', phone: '05550000000', email: null, birthDate: null, allergyNotes: null, preferenceNotes: null, totalVisits: 0, segment: null, lastVisitAt: null, createdAt: new Date() }

  it('ADR-0038 Onemli 3: panel POST telefonu normalize saklar (0532 123 45 67 -> +905321234567); tekrar kontrolu de normalize deger uzerinden', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    dbMock.customer.create.mockResolvedValue(created)
    const res = await request(app).post(`${URL}/customers`).set(owner).send({ fullName: 'Yeni Kisi', phone: '0532 123 45 67' })
    expect(res.status).toBe(201)
    expect(dbMock.customer.create.mock.calls[0][0].data.phone).toBe('+905321234567')
    expect(dbMock.customer.findMany.mock.calls[0][0].where.phone.in).toContain('+905321234567')
  })

  it('ADR-0038 Onemli 3: panel POST gecersiz telefonu 400 ile reddeder (yazmaz)', async () => {
    const res = await request(app).post(`${URL}/customers`).set(owner).send({ fullName: 'Yeni Kisi', phone: 'abcdefgh' })
    expect(res.status).toBe(400)
    expect(dbMock.customer.create).not.toHaveBeenCalled()
  })

  it('ADR-0038 Onemli 3: panel PATCH telefonu normalize saklar; gecersiz telefon 400', async () => {
    dbMock.customer.findFirst.mockResolvedValue(existing)
    dbMock.customer.findMany.mockResolvedValue([])
    dbMock.customer.update.mockResolvedValue({ ...existing, phone: '+905321234567' })
    const ok = await request(app).patch(`${URL}/customers/c1`).set(owner).send({ phone: '0532-123-45-67' })
    expect(ok.status).toBe(200)
    expect(dbMock.customer.update.mock.calls[0][0].data.phone).toBe('+905321234567')
    dbMock.customer.update.mockClear()
    const bad = await request(app).patch(`${URL}/customers/c1`).set(owner).send({ phone: 'abcdefgh' })
    expect(bad.status).toBe(400)
    expect(dbMock.customer.update).not.toHaveBeenCalled()
  })

  it('K6: PATCH telefon baska kartta kayitliysa 409; kendi karti sayilmaz (sorgu id != kendisi)', async () => {
    dbMock.customer.findFirst.mockResolvedValue(existing)
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c2' }])
    const res = await request(app).patch(`${URL}/customers/c1`).set(owner).send({ phone: '05551112233' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_PHONE')
    expect(dbMock.customer.update).not.toHaveBeenCalled()
    expect(dbMock.customer.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', id: { not: 'c1' } })
  })

  it('K6: PATCH allowSharedPhone true ile telefon paylasilabilir', async () => {
    dbMock.customer.findFirst.mockResolvedValue(existing)
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c2' }])
    dbMock.customer.update.mockResolvedValue({ ...existing, phone: '05551112233' })
    const res = await request(app).patch(`${URL}/customers/c1`).set(owner).send({ phone: '05551112233', allowSharedPhone: true })
    expect(res.status).toBe(200)
    expect(dbMock.customer.update.mock.calls[0][0].data).not.toHaveProperty('allowSharedPhone')
  })

  it('K6: PATCH telefon degismiyorsa tekrar kontrolu yapilmaz', async () => {
    dbMock.customer.findFirst.mockResolvedValue(existing)
    dbMock.customer.update.mockResolvedValue(existing)
    const res = await request(app).patch(`${URL}/customers/c1`).set(owner).send({ fullName: 'Ayse Yeni' })
    expect(res.status).toBe(200)
    expect(dbMock.customer.findMany).not.toHaveBeenCalled()
  })
})
