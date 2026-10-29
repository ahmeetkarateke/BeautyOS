import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// A6a: tamamla + odeme tek islemde. Kosullu guncelleme (count === 1) ciftlenmeyi onler; Decimal hesap; yanit odeme ozeti tasir. db sahte.
const dbMock = vi.hoisted(() => {
  const tx = {
    appointment: { updateMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn() },
  }
  return {
    ...tx,
    staffProfile: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    _tx: tx,
  }
})
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() } }))
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

import { createTenantRouter } from '../routes/tenant.route'

const app = express().use(express.json()).use('/api/v1/tenants/:slug', createTenantRouter())
const URL = '/api/v1/tenants/salon/appointments/a1/status'
const as = (role: string) => ({ 'x-role': role })
const SP_ME = 'sp-me'

const existing = (over: Record<string, unknown> = {}) => ({ id: 'a1', tenantId: 't1', staffId: SP_ME, customerId: 'c1', status: 'confirmed', ...over })
const full = { id: 'a1', staffId: SP_ME, priceCharged: 100.1, startAt: new Date(), customerId: 'c1', service: { commissionRate: 0.3, followUpSchedule: null, durationMinutes: 30, name: 'S' }, customer: null, tenant: { settings: null, telegramBotToken: null } }

const firstExisting = (over: Record<string, unknown> = {}) => dbMock._tx.appointment.findFirst.mockReset().mockResolvedValueOnce(existing(over)).mockResolvedValue(full)

beforeEach(() => {
  vi.clearAllMocks()
  const tx = dbMock._tx
  Object.values(tx.appointment).forEach((f) => f.mockReset())
  tx.transaction.create.mockReset()
  dbMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
  dbMock.staffProfile.findFirst.mockResolvedValue({ id: SP_ME })
  tx.appointment.updateMany.mockResolvedValue({ count: 1 })
  tx.transaction.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'tx1', completedAt: new Date('2026-11-20T10:00:00Z'), ...data }))
  firstExisting()
})

describe('PATCH /appointments/:id/status completed', () => {
  it('K-A6: tamamlama tek islemde (transaction icinde) kosullu guncelleme + kasa kaydi yapar; yanit odeme ozeti tasir', async () => {
    const res = await request(app).patch(URL).set(as('owner')).send({ status: 'completed', paymentMethod: 'card' })
    expect(res.status).toBe(200)
    expect(dbMock.$transaction).toHaveBeenCalledTimes(1)
    const where = dbMock._tx.appointment.updateMany.mock.calls[0][0].where
    expect(where).toMatchObject({ id: 'a1', tenantId: 't1', status: { notIn: ['completed', 'cancelled', 'no_show'] } })
    expect(dbMock._tx.transaction.create).toHaveBeenCalledTimes(1)
    expect(res.body).toMatchObject({ id: 'a1', status: 'completed', payment: { transactionId: 'tx1', paymentMethod: 'card', grossAmount: 100.1, cashAmount: 0, cardAmount: 100.1 } })
  })

  it('K-A6: komisyon Decimal ile hesaplanir (100.10 x 0.3 = 30.03 tam; float 30.029999...)', async () => {
    await request(app).patch(URL).set(as('owner')).send({ status: 'completed' })
    const data = dbMock._tx.transaction.create.mock.calls[0][0].data
    expect(String(data.commissionAmount)).toBe('30.03')
    expect(String(data.grossAmount)).toBe('100.1')
  })

  it('K-A6: cift odeme: kosullu guncelleme 0 satir verirse (baska istek once tamamladi) 409 STATUS_LOCKED ve kasa kaydi yazilmaz', async () => {
    dbMock._tx.appointment.updateMany.mockResolvedValue({ count: 0 })
    const res = await request(app).patch(URL).set(as('owner')).send({ status: 'completed' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('STATUS_LOCKED')
    expect(dbMock._tx.transaction.create).not.toHaveBeenCalled()
  })

  it('K-A6: zaten tamamlanmis randevu 409 STATUS_LOCKED (islem hic acilmaz)', async () => {
    firstExisting({ status: 'completed' })
    const res = await request(app).patch(URL).set(as('owner')).send({ status: 'completed' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('STATUS_LOCKED')
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it('K-R3: uzman fiyat gonderirse yok sayilir (randevu fiyati yazilir, 200); sahip fiyat degistirir ve randevu fiyati da guncellenir', async () => {
    const staff = await request(app).patch(URL).set(as('staff')).send({ status: 'completed', priceCharged: 1 })
    expect(staff.status).toBe(200)
    expect(String(dbMock._tx.transaction.create.mock.calls[0][0].data.grossAmount)).toBe('100.1')
    expect(dbMock._tx.appointment.update).not.toHaveBeenCalled()
    dbMock._tx.transaction.create.mockClear()
    firstExisting()
    const owner = await request(app).patch(URL).set(as('owner')).send({ status: 'completed', priceCharged: 90 })
    expect(owner.status).toBe(200)
    expect(String(dbMock._tx.transaction.create.mock.calls[0][0].data.grossAmount)).toBe('90')
    expect(dbMock._tx.appointment.update.mock.calls[0][0].data.priceCharged).toBeDefined()
  })

  it('K-A6: uzman baska uzmanin randevusunu tamamlayamaz (403, islem yok)', async () => {
    dbMock.staffProfile.findFirst.mockResolvedValue({ id: 'sp-other' })
    const res = await request(app).patch(URL).set(as('staff')).send({ status: 'completed' })
    expect(res.status).toBe(403)
    expect(dbMock.$transaction).not.toHaveBeenCalled()
  })

  it('K-A6: iptal ayni kosullu guncellemeyle yapilir ve kasa kaydi acmaz', async () => {
    const res = await request(app).patch(URL).set(as('owner')).send({ status: 'cancelled', cancellationReason: 'Musteri vazgecti' })
    expect(res.status).toBe(200)
    expect(dbMock._tx.transaction.create).not.toHaveBeenCalled()
    expect(res.body.payment).toBeUndefined()
  })
})
