import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { can } from '@beautyos/shared'

// A6b (R5): kasa gunu kapanisi, gunu yeniden acma ve odeme duzeltmesi; her duzeltme kaydi tutar. db sahte.
const dbMock = vi.hoisted(() => ({
  transaction: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
  expense: { findMany: vi.fn() },
  staffProfile: { findMany: vi.fn(), findFirst: vi.fn() },
  user: { findMany: vi.fn() },
  appointment: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  cashDayClosure: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  correction: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}))
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
const BASE = '/api/v1/tenants/salon'
const as = (role: string) => ({ 'x-role': role })
const DAY = '2026-11-20'
const NOW_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const txRow = (over: Record<string, unknown> = {}) => ({
  id: 'tx1', tenantId: 't1', appointmentId: 'a1', grossAmount: 500, commissionRate: 0.1, commissionAmount: 50, paymentMethod: 'cash',
  cashAmount: 500, cardAmount: 0, status: 'completed', completedAt: new Date(`${DAY}T10:00:00+03:00`), ...over,
})

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.$transaction.mockImplementation(async (fn: (t: typeof dbMock) => unknown) => fn(dbMock))
  dbMock.transaction.findMany.mockResolvedValue([])
  dbMock.expense.findMany.mockResolvedValue([])
  dbMock.staffProfile.findMany.mockResolvedValue([])
  dbMock.user.findMany.mockResolvedValue([])
  dbMock.cashDayClosure.findUnique.mockResolvedValue(null)
  dbMock.cashDayClosure.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({ ...create }))
  dbMock.correction.create.mockResolvedValue({ id: 'cr1' })
})

describe('izin', () => {
  it('K-R5: finance.correction yalniz owner ve manager; resepsiyon ve uzman yapamaz', () => {
    expect(can('owner', 'finance.correction')).toBe(true)
    expect(can('manager', 'finance.correction')).toBe(true)
    expect(can('receptionist', 'finance.correction')).toBe(false)
    expect(can('staff', 'finance.correction')).toBe(false)
  })
})

describe('POST /finance/close-day kapanisi kaydeder', () => {
  it('K-R5: gun kapanisi kiraciya ve gune bagli upsert edilir; sayim farki doner', async () => {
    dbMock.transaction.findMany.mockResolvedValue([
      { id: 'x', grossAmount: 300, cashAmount: 300, cardAmount: 0, paymentMethod: 'cash', commissionAmount: 30, staffId: null, completedAt: new Date(), notes: null, appointment: null },
    ])
    const res = await request(app).post(`${BASE}/finance/close-day?date=${NOW_DAY}`).set(as('receptionist')).send({ countedCash: 290, note: 'eksik' })
    expect(res.status).toBe(200)
    const arg = dbMock.cashDayClosure.upsert.mock.calls[0][0]
    expect(arg.where).toEqual({ tenantId_date: { tenantId: 't1', date: new Date(`${NOW_DAY}T00:00:00.000Z`) } })
    expect(arg.create).toMatchObject({ tenantId: 't1', isClosed: true, closedById: 'u-me', expectedCash: 300, countedCash: 290 })
    expect(res.body.closure).toMatchObject({ isClosed: true, expectedCash: 300, countedCash: 290, difference: -10 })
  })

  it('K-R5: sayim girilmeden de kapanir (kapama sayimsiz calisir): countedCash ve fark null', async () => {
    const res = await request(app).post(`${BASE}/finance/close-day?date=${NOW_DAY}`).set(as('owner'))
    expect(res.status).toBe(200)
    expect(res.body.closure).toMatchObject({ isClosed: true, countedCash: null, difference: null })
  })
})

describe('DAY_CLOSED: kapali gune yazma', () => {
  it('K-R5: bugun kapaliysa randevu tamamlama 409 DAY_CLOSED (kasa kaydi yok, kosullu guncelleme yok)', async () => {
    dbMock.appointment.findFirst.mockResolvedValue({ id: 'a1', tenantId: 't1', staffId: 'sp', customerId: 'c1', status: 'confirmed' })
    dbMock.cashDayClosure.findUnique.mockResolvedValue({ isClosed: true })
    const res = await request(app).patch(`${BASE}/appointments/a1/status`).set(as('owner')).send({ status: 'completed' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DAY_CLOSED')
    expect(dbMock.appointment.updateMany).not.toHaveBeenCalled()
    expect(dbMock.transaction.create).not.toHaveBeenCalled()
    expect(dbMock.cashDayClosure.findUnique.mock.calls[0][0].where.tenantId_date.tenantId).toBe('t1')
  })

  it('K-R5: kapali gune manuel gelir (POST /revenues) 409 DAY_CLOSED; acik/kayitsiz gunde 201', async () => {
    dbMock.cashDayClosure.findUnique.mockResolvedValue({ isClosed: true })
    const closed = await request(app).post(`${BASE}/revenues`).set(as('owner')).send({ description: 'x', amount: 10, paymentMethod: 'cash', revenueDate: NOW_DAY })
    expect(closed.status).toBe(409)
    expect(closed.body.error.code).toBe('DAY_CLOSED')
    expect(dbMock.transaction.create).not.toHaveBeenCalled()
    dbMock.cashDayClosure.findUnique.mockResolvedValue({ isClosed: false })
    dbMock.transaction.create.mockResolvedValue({ id: 'r1', grossAmount: 10, paymentMethod: 'cash' })
    const open = await request(app).post(`${BASE}/revenues`).set(as('owner')).send({ description: 'x', amount: 10, paymentMethod: 'cash', revenueDate: NOW_DAY })
    expect(open.status).toBe(201)
  })
})

describe('POST /finance/reopen-day', () => {
  const body = { date: DAY, reason: 'Yanlis tutar girildi' }

  it('K-R5: owner ve manager kapali gunu gerekceyle acar; duzeltme kaydi (kim, eski -> yeni, gerekce) ayni islemde yazilir', async () => {
    for (const role of ['owner', 'manager']) {
      dbMock.correction.create.mockClear()
      dbMock.cashDayClosure.findUnique.mockResolvedValue({ isClosed: true, closedAt: new Date('2026-11-20T18:00:00Z') })
      dbMock.cashDayClosure.update.mockResolvedValue({})
      const res = await request(app).post(`${BASE}/finance/reopen-day`).set(as(role)).send(body)
      expect(res.status, role).toBe(200)
      expect(res.body).toMatchObject({ date: DAY, isClosed: false })
      expect(dbMock.$transaction).toHaveBeenCalled()
      expect(dbMock.cashDayClosure.update.mock.calls.at(-1)![0].data).toMatchObject({ isClosed: false, reopenedById: 'u-me' })
      expect(dbMock.correction.create.mock.calls[0][0].data).toMatchObject({
        tenantId: 't1', kind: 'day_reopen', createdById: 'u-me', reason: body.reason, oldValue: { isClosed: true }, newValue: { isClosed: false },
      })
    }
  })

  it('K-R5: resepsiyon ve uzman acamaz (403, yazma yok)', async () => {
    for (const role of ['receptionist', 'staff']) {
      const res = await request(app).post(`${BASE}/finance/reopen-day`).set(as(role)).send(body)
      expect(res.status, role).toBe(403)
    }
    expect(dbMock.cashDayClosure.update).not.toHaveBeenCalled()
    expect(dbMock.correction.create).not.toHaveBeenCalled()
  })

  it('K-R5: gerekce zorunlu (bos/kisa 400); kapali olmayan gun 409 DAY_NOT_CLOSED', async () => {
    const noReason = await request(app).post(`${BASE}/finance/reopen-day`).set(as('owner')).send({ date: DAY, reason: 'x' })
    expect(noReason.status).toBe(400)
    dbMock.cashDayClosure.findUnique.mockResolvedValue({ isClosed: false })
    const open = await request(app).post(`${BASE}/finance/reopen-day`).set(as('owner')).send(body)
    expect(open.status).toBe(409)
    expect(open.body.error.code).toBe('DAY_NOT_CLOSED')
    dbMock.cashDayClosure.findUnique.mockResolvedValue(null)
    expect((await request(app).post(`${BASE}/finance/reopen-day`).set(as('owner')).send(body)).status).toBe(409)
    expect(dbMock.correction.create).not.toHaveBeenCalled()
  })
})

describe('POST /appointments/:id/correction', () => {
  const body = { grossAmount: 450, reason: 'Indirim unutuldu' }

  it('K-R5: tutar duzeltmesi odeme kaydini Decimal ile yeniden hesaplar, randevu fiyatini gunceller ve eski -> yeni kaydi yazar', async () => {
    dbMock.transaction.findFirst.mockResolvedValue(txRow())
    dbMock.transaction.update.mockResolvedValue({})
    const res = await request(app).post(`${BASE}/appointments/a1/correction`).set(as('owner')).send(body)
    expect(res.status).toBe(200)
    const upd = dbMock.transaction.update.mock.calls[0][0]
    expect(String(upd.data.grossAmount)).toBe('450')
    expect(String(upd.data.commissionAmount)).toBe('45')
    expect(String(upd.data.cashAmount)).toBe('450')
    expect(upd.data.cardAmount).toBe(0)
    expect(dbMock.appointment.update.mock.calls[0][0].data.priceCharged).toBeDefined()
    const rec = dbMock.correction.create.mock.calls[0][0].data
    expect(rec).toMatchObject({ tenantId: 't1', kind: 'payment', transactionId: 'tx1', appointmentId: 'a1', createdById: 'u-me', reason: body.reason })
    expect(rec.oldValue).toMatchObject({ grossAmount: 500, paymentMethod: 'cash' })
    expect(rec.newValue).toMatchObject({ grossAmount: 450, paymentMethod: 'cash' })
  })

  it('K-R5: yontem duzeltmesi nakit -> kart tutari ilgili alana tasir', async () => {
    dbMock.transaction.findFirst.mockResolvedValue(txRow())
    dbMock.transaction.update.mockResolvedValue({})
    const res = await request(app).post(`${BASE}/appointments/a1/correction`).set(as('manager')).send({ paymentMethod: 'card', reason: 'Yanlis yontem' })
    expect(res.status).toBe(200)
    const data = dbMock.transaction.update.mock.calls[0][0].data
    expect(data.paymentMethod).toBe('card')
    expect(String(data.cardAmount)).toBe('500')
    expect(data.cashAmount).toBe(0)
    expect(dbMock.appointment.update).not.toHaveBeenCalled()
  })

  it('K-R5: resepsiyon ve uzman duzeltme yapamaz (403)', async () => {
    for (const role of ['receptionist', 'staff']) {
      expect((await request(app).post(`${BASE}/appointments/a1/correction`).set(as(role)).send(body)).status, role).toBe(403)
    }
    expect(dbMock.transaction.update).not.toHaveBeenCalled()
  })

  it('K-R5: gerekce zorunlu, en az bir alan zorunlu, tutar pozitif (400)', async () => {
    for (const b of [{ grossAmount: 450 }, { reason: 'gerekce var' }, { grossAmount: -5, reason: 'gerekce var' }, { grossAmount: 450, reason: 'x' }]) {
      expect((await request(app).post(`${BASE}/appointments/a1/correction`).set(as('owner')).send(b)).status).toBe(400)
    }
    expect(dbMock.transaction.update).not.toHaveBeenCalled()
  })

  it('K-R5: odeme kaydi yoksa (tamamlanmamis) 409 NOT_COMPLETED; sorgu kiraci ve randevuyla sinirli', async () => {
    dbMock.transaction.findFirst.mockResolvedValue(null)
    const res = await request(app).post(`${BASE}/appointments/a1/correction`).set(as('owner')).send(body)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('NOT_COMPLETED')
    expect(dbMock.transaction.findFirst.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', appointmentId: 'a1', status: 'completed' })
  })

  it('K-R5: odeme kapali bir gune aitse once gun yeniden acilmali: 409 DAY_CLOSED, kayit yok', async () => {
    dbMock.transaction.findFirst.mockResolvedValue(txRow())
    dbMock.cashDayClosure.findUnique.mockResolvedValue({ isClosed: true })
    const res = await request(app).post(`${BASE}/appointments/a1/correction`).set(as('owner')).send(body)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DAY_CLOSED')
    expect(dbMock.cashDayClosure.findUnique.mock.calls[0][0].where.tenantId_date.date).toEqual(new Date(`${DAY}T00:00:00.000Z`))
    expect(dbMock.transaction.update).not.toHaveBeenCalled()
    expect(dbMock.correction.create).not.toHaveBeenCalled()
  })
})

describe('GET /finance/corrections', () => {
  it('K-R5: gecmis kiraciya bagli listelenir (en yeni once), tarih filtresi opsiyonel; yalniz owner/manager', async () => {
    dbMock.correction.findMany.mockResolvedValue([
      { id: 'c1', kind: 'payment', appointmentId: 'a1', transactionId: 'tx1', date: new Date(`${DAY}T00:00:00Z`), oldValue: {}, newValue: {}, reason: 'r', createdById: 'u1', createdAt: new Date() },
    ])
    const res = await request(app).get(`${BASE}/finance/corrections?date=${DAY}`).set(as('manager'))
    expect(res.status).toBe(200)
    expect(res.body.data[0]).toMatchObject({ id: 'c1', kind: 'payment', reason: 'r', date: DAY })
    const arg = dbMock.correction.findMany.mock.calls[0][0]
    expect(arg.where).toMatchObject({ tenantId: 't1' })
    expect(arg.orderBy).toEqual({ createdAt: 'desc' })
    expect((await request(app).get(`${BASE}/finance/corrections`).set(as('receptionist'))).status).toBe(403)
  })
})

describe('GET /finance/day-status', () => {
  it('K-R5: kapali gun: kapanis alanlari ve sayim farki doner; sorgu kiraci ve gune bagli', async () => {
    dbMock.cashDayClosure.findUnique.mockResolvedValue({
      isClosed: true, closedAt: new Date('2026-11-20T18:00:00Z'), expectedCash: 300, countedCash: 290,
    })
    const res = await request(app).get(`${BASE}/finance/day-status?date=${NOW_DAY}`).set(as('receptionist'))
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ date: NOW_DAY, isClosed: true, closedAt: '2026-11-20T18:00:00.000Z', expectedCash: 300, countedCash: 290, difference: -10 })
    expect(dbMock.cashDayClosure.findUnique.mock.calls[0][0].where).toEqual({ tenantId_date: { tenantId: 't1', date: new Date(`${NOW_DAY}T00:00:00.000Z`) } })
  })

  it('K-R5: kayit yok ya da yeniden acilmis gun acik sayilir; beklenen nakit canli toplamdan (tenantId + gun + completed) gelir', async () => {
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { cashAmount: 125.5 } })
    for (const row of [null, { isClosed: false, closedAt: null, expectedCash: null, countedCash: null }]) {
      dbMock.cashDayClosure.findUnique.mockResolvedValue(row)
      const res = await request(app).get(`${BASE}/finance/day-status?date=${NOW_DAY}`).set(as('owner'))
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ isClosed: false, closedAt: null, expectedCash: 125.5, countedCash: null, difference: null })
    }
    expect(dbMock.transaction.aggregate.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', status: 'completed' })
  })

  it('K-R5: resepsiyon yalniz bugunu gorur (gecmis gun 403); owner/manager gecmis gunu gorur; uzman 403; bozuk tarih 400', async () => {
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { cashAmount: 0 } })
    expect((await request(app).get(`${BASE}/finance/day-status?date=${DAY}`).set(as('receptionist'))).status).toBe(403)
    expect((await request(app).get(`${BASE}/finance/day-status?date=${DAY}`).set(as('manager'))).status).toBe(200)
    expect((await request(app).get(`${BASE}/finance/day-status`).set(as('receptionist'))).status).toBe(200)
    expect((await request(app).get(`${BASE}/finance/day-status?date=${DAY}`).set(as('staff'))).status).toBe(403)
    expect((await request(app).get(`${BASE}/finance/day-status?date=20.11.2026`).set(as('owner'))).status).toBe(400)
  })
})
