import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { can } from '@beautyos/shared'

// A2-1 denetim duzeltmesi: resepsiyon icin gecmis gun/prim sizintisi, saglik verisi (R9) ve rol-adiyla-ret kalibi.
// db ve kimlik katmani sahtelenir; DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  transaction: { findMany: vi.fn(), create: vi.fn() },
  expense: { findMany: vi.fn() },
  staffProfile: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  user: { findMany: vi.fn() },
  customer: { findFirst: vi.fn(), update: vi.fn() },
  tipEntry: { aggregate: vi.fn(), groupBy: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  tipDistribution: { groupBy: vi.fn() },
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
import { createTipsRouter } from '../routes/tips.route'

const app = express().use(express.json()).use('/api/v1/tenants/:slug', createTipsRouter()).use('/api/v1/tenants/:slug', createTenantRouter())
const URL = '/api/v1/tenants/salon'
const as = (role: string) => ({ 'x-role': role })
const istanbulDay = (offsetDays: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() + offsetDays * 86400000))
const today = () => istanbulDay(0)
const yesterday = () => istanbulDay(-1)

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.transaction.findMany.mockResolvedValue([
    { id: 'x1', grossAmount: 100, cashAmount: 100, cardAmount: 0, paymentMethod: 'cash', commissionAmount: 10, staffId: 'sp1', completedAt: new Date(), notes: null, appointment: null },
  ])
  dbMock.expense.findMany.mockResolvedValue([])
  dbMock.staffProfile.findMany.mockResolvedValue([{ id: 'sp1', userId: 'u1' }])
  dbMock.user.findMany.mockResolvedValue([{ id: 'u1', fullName: 'Uzman' }])
  dbMock.transaction.create.mockResolvedValue({ id: 'r1', grossAmount: 50, paymentMethod: 'cash' })
})

describe('A2-1 K1: close-day resepsiyon yalniz bugun ve prim yok', () => {
  const closeDay = (role: string, date?: string) => request(app).post(`${URL}/finance/close-day${date ? `?date=${date}` : ''}`).set(as(role))

  it('K1: resepsiyon dunku gunu kapatma dokumu isteyemez (403) ve DB sorgulanmaz', async () => {
    const res = await closeDay('receptionist', yesterday())
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    expect(dbMock.transaction.findMany).not.toHaveBeenCalled()
  })

  it('K1: resepsiyon bugun (tarihli ya da tarihsiz) 200 alir ve yanitta staffCommissions yoktur', async () => {
    for (const date of [undefined, today()]) {
      const res = await closeDay('receptionist', date)
      expect(res.status).toBe(200)
      expect(res.body).not.toHaveProperty('staffCommissions')
      expect(JSON.stringify(res.body)).not.toContain('commissionAmount')
    }
  })

  it('K1: sahip ve mudur gecmis gunu ve staffCommissions listesini gorur', async () => {
    for (const role of ['owner', 'manager']) {
      const res = await closeDay(role, yesterday())
      expect(res.status, role).toBe(200)
      expect(res.body.staffCommissions, role).toEqual([expect.objectContaining({ staffId: 'sp1', commissionAmount: 10 })])
    }
  })
})

describe('A2-1 K2: resepsiyon saglik verisini (alerji notu) goremez ve yazamaz (R9)', () => {
  const row = { id: 'c1', fullName: 'Ayse', phone: '+905321234567', email: null, birthDate: null, allergyNotes: 'Penisilin alerjisi', preferenceNotes: 'Sicak su', totalVisits: 1, lifetimeValue: 0, segment: null, lastVisitAt: null, phoneVerifiedAt: null, marketingConsentSms: false, marketingConsentEmail: false, createdAt: new Date(), appointments: [] }

  it('K2: resepsiyon GET /customers/:id yanitinda allergyNotes alani ve degeri yoktur', async () => {
    dbMock.customer.findFirst.mockResolvedValue(row)
    const res = await request(app).get(`${URL}/customers/c1`).set(as('receptionist'))
    expect(res.status).toBe(200)
    expect(res.body).not.toHaveProperty('allergyNotes')
    expect(JSON.stringify(res.body)).not.toContain('Penisilin')
    expect(res.body.preferenceNotes).toBe('Sicak su')
  })

  it.each(['owner', 'manager'])('K2: %s GET ile allergyNotes gorur', async (role) => {
    dbMock.customer.findFirst.mockResolvedValue(row)
    const res = await request(app).get(`${URL}/customers/c1`).set(as(role))
    expect(res.body.allergyNotes).toBe('Penisilin alerjisi')
  })

  it('K2: resepsiyon PATCH ile allergyNotes gonderirse 403 ve DB yazilmaz', async () => {
    dbMock.customer.findFirst.mockResolvedValue(row)
    const res = await request(app).patch(`${URL}/customers/c1`).set(as('receptionist')).send({ allergyNotes: 'yeni' })
    expect(res.status).toBe(403)
    expect(dbMock.customer.update).not.toHaveBeenCalled()
  })

  it('K2: resepsiyon allergyNotes olmadan baska alani duzenleyebilir; yanitta allergyNotes donmez', async () => {
    dbMock.customer.findFirst.mockResolvedValue(row)
    dbMock.customer.update.mockResolvedValue({ ...row, fullName: 'Ayse Yeni' })
    const res = await request(app).patch(`${URL}/customers/c1`).set(as('receptionist')).send({ fullName: 'Ayse Yeni' })
    expect(res.status).toBe(200)
    expect(res.body).not.toHaveProperty('allergyNotes')
    expect(JSON.stringify(res.body)).not.toContain('Penisilin')
    expect(dbMock.customer.update.mock.calls[0][0].data).not.toHaveProperty('allergyNotes')
  })

  it('K2: sahip PATCH ile allergyNotes yazar ve yanitta gorur', async () => {
    dbMock.customer.findFirst.mockResolvedValue(row)
    dbMock.customer.update.mockResolvedValue({ ...row, allergyNotes: 'yeni' })
    const res = await request(app).patch(`${URL}/customers/c1`).set(as('owner')).send({ allergyNotes: 'yeni' })
    expect(res.status).toBe(200)
    expect(res.body.allergyNotes).toBe('yeni')
  })
})

describe('A2-1 Onemli 1: resepsiyon gecmis tarihe manuel gelir yazamaz', () => {
  const post = (role: string, revenueDate: string) =>
    request(app).post(`${URL}/revenues`).set(as(role)).send({ description: 'x', amount: 50, paymentMethod: 'cash', revenueDate })

  it('resepsiyon dunku tarihe gelir yazamaz (403), bugun yazabilir (201)', async () => {
    expect((await post('receptionist', yesterday())).status).toBe(403)
    expect(dbMock.transaction.create).not.toHaveBeenCalled()
    expect((await post('receptionist', today())).status).toBe(201)
  })

  it('sahip ve mudur gecmis tarihe gelir yazabilir', async () => {
    for (const role of ['owner', 'manager']) expect((await post(role, yesterday())).status, role).toBe(201)
  })
})

describe('A2-1 Onemli 3: rol adiyla ret yerine izin anahtari', () => {
  it('izin tablosu: tip.view uzman dahil sahip/mudur; finance.report.range yalniz sahip/mudur', () => {
    expect(['owner', 'manager', 'staff', 'receptionist'].filter((r) => can(r, 'tip.view'))).toEqual(['owner', 'manager', 'staff'])
    expect(['owner', 'manager', 'staff', 'receptionist'].filter((r) => can(r, 'finance.report.range'))).toEqual(['owner', 'manager'])
  })

  it('izni olmayan (bilinmeyen) rol bahsis listesi ve ozetinde 403 alir; varsayilan izin yok', async () => {
    for (const path of ['/tips', '/tips/summary']) {
      const res = await request(app).get(`${URL}${path}`).set(as('physician'))
      expect(res.status, path).toBe(403)
    }
  })

  it('izni olmayan (bilinmeyen) rol reports/daily icin gecmis gun isteyemez', async () => {
    const res = await request(app).get(`${URL}/reports/daily?date=${yesterday()}`).set(as('physician'))
    expect(res.status).toBe(403)
  })
})
