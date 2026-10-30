import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// W23-1: GET /reports/daily ozet kipi (fields=summary): 31 gun tavani ve veri en aza indirme.
// Eski sozlesme (fields yok) canlidaki eski finans ekrani icin korunur: listeler + 366 gun.
// DB ve kimlik katmani sahte; DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  transaction: { findMany: vi.fn() },
  expense: { findMany: vi.fn() },
}))

vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() } }))
vi.mock('../middleware/auth.middleware', () => ({
  authenticateJWT: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'u1', tenantId: 't1', tenantSlug: 'salon', role: String(req.headers['x-role']) } as never
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
const get = (query: string) => request(app).get(`/api/v1/tenants/salon/reports/daily?${query}`).set('x-role', 'owner')

const tx = {
  id: 'x1', grossAmount: 500, cashAmount: 500, cardAmount: 0, paymentMethod: 'cash',
  completedAt: new Date('2026-10-10T09:00:00Z'), notes: 'not',
  appointment: { startAt: new Date('2026-10-10T08:00:00Z'), customer: { fullName: 'Zeynep Kaya' }, service: { name: 'Sac', category: 'Sac' } },
}

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.transaction.findMany.mockResolvedValue([tx])
  dbMock.expense.findMany.mockResolvedValue([
    { id: 'e1', title: 'Kira', category: 'Sabit', amount: 100, expenseDate: new Date('2026-10-10T00:00:00Z') },
  ])
})

const S = 'fields=summary'

describe('GET /reports/daily ozet kipi (fields=summary) aralik tavani', () => {
  it('31 gunluk aralik (iki uc dahil) kabul edilir', async () => {
    const res = await get(`from=2026-10-01&to=2026-10-31&groupBy=day&${S}`)
    expect(res.status).toBe(200)
  })

  it('32 gunluk aralik 400 RANGE_TOO_LARGE, veritabani sorgulanmaz (from<=to ve bicim gecerli)', async () => {
    const res = await get(`from=2026-09-30&to=2026-10-31&groupBy=day&${S}`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('RANGE_TOO_LARGE')
    expect(dbMock.transaction.findMany).not.toHaveBeenCalled()
  })
})

describe('GET /reports/daily ozet kipi veri en aza indirme', () => {
  it('yanitta islem ve gider listesi yok, musteri adi hicbir yerde gecmez; toplamlar ve gunluk dokum var', async () => {
    const res = await get(`from=2026-10-10&to=2026-10-10&groupBy=day&${S}`)
    expect(res.status).toBe(200)
    expect(res.body).not.toHaveProperty('transactions')
    expect(res.body).not.toHaveProperty('expenses')
    expect(JSON.stringify(res.body)).not.toContain('Zeynep')
    expect(res.body).toMatchObject({ totalRevenue: 500, cashRevenue: 500, cardRevenue: 0, completedCount: 1, netRevenue: 400 })
    expect(res.body.daily).toEqual([
      { date: '2026-10-10', revenue: 500, cashRevenue: 500, cardRevenue: 0, completedCount: 1, expenses: 100, netRevenue: 400 },
    ])
  })

  it('veritabanindan musteri iliskisi hic secilmez', async () => {
    await get(`from=2026-10-10&to=2026-10-10&groupBy=day&${S}`)
    expect(dbMock.transaction.findMany.mock.calls[0][0].select).not.toHaveProperty('appointment')
  })
})

describe('GET /reports/daily eski sozlesme (fields yok) korunur: canlidaki eski finans ekrani', () => {
  it('groupBy=day eski kipte islem ve gider listelerini, gunluk dokumu birlikte doner', async () => {
    const res = await get('from=2026-10-10&to=2026-10-10&groupBy=day')
    expect(res.status).toBe(200)
    expect(res.body.transactions).toHaveLength(1)
    expect(res.body.transactions[0].customerName).toBe('Zeynep Kaya')
    expect(res.body.expenses).toHaveLength(1)
    expect(res.body.daily).toHaveLength(1)
  })

  it('tek gun listesi (date=) islemleri korur ve daily icermez', async () => {
    const res = await get('date=2026-10-10')
    expect(res.status).toBe(200)
    expect(res.body.transactions[0].customerName).toBe('Zeynep Kaya')
    expect(res.body).not.toHaveProperty('daily')
  })

  it('eski ekranin "Bu yil" araligi (365 gun) kabul edilir', async () => {
    const res = await get('from=2026-01-01&to=2026-12-31&groupBy=day')
    expect(res.status).toBe(200)
  })

  it('366 gunu asan eski kip araligi 400 RANGE_TOO_LARGE', async () => {
    const res = await get('from=2025-10-01&to=2026-10-31&groupBy=day')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('RANGE_TOO_LARGE')
  })
})
