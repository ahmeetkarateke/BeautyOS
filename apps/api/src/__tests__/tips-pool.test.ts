import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// W26-bahsis-1: tipIds'siz "esit dagit" yalniz havuz bahsislerini (staffId bos) dagitir; kisiye birakilan bahsise dokunmaz.
const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  tipEntry: { findMany: vi.fn(), updateMany: vi.fn() },
  staffProfile: { findMany: vi.fn() },
  tipDistribution: { create: vi.fn() },
}))

vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../middleware/auth.middleware', () => ({
  authenticateJWT: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'u1', tenantId: 't1', tenantSlug: 'salon', role: 'owner' } as never
    next()
  },
  requireTenantAccess: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = 't1'
    next()
  },
  checkTenantActive: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

import { createTipsRouter } from '../routes/tips.route'

const app = express().use(express.json()).use('/api/v1/tenants/:slug', createTipsRouter())
const URL = '/api/v1/tenants/salon/tips/distribute'
const STAFF = '11111111-1111-4111-8111-111111111111'
const TIP = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.$transaction.mockImplementation(async (fn: (t: typeof dbMock) => unknown) => fn(dbMock))
  dbMock.tipEntry.findMany.mockResolvedValue([{ id: TIP, amount: 100 }])
  dbMock.staffProfile.findMany.mockResolvedValue([{ id: STAFF }])
  dbMock.tipDistribution.create.mockResolvedValue({ id: 'd1', staffId: STAFF, amount: 100, shareWeight: null, notes: null, distributedAt: new Date() })
})

describe('POST /tips/distribute havuz kapsami', () => {
  it('tipIds yokken yalniz staffId bos (havuz) bahsisleri secilir', async () => {
    const res = await request(app).post(URL).send({ distributions: [{ staffId: STAFF, amount: 100 }] })
    expect(res.status).toBe(201)
    const where = dbMock.tipEntry.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ tenantId: 't1', isDistributed: false, staffId: null })
  })

  it('tipIds verilince secim o kayitlarla sinirlidir ve tenant filtresi korunur', async () => {
    const res = await request(app).post(URL).send({ tipIds: [TIP], distributions: [{ staffId: STAFF, amount: 100 }] })
    expect(res.status).toBe(201)
    const where = dbMock.tipEntry.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ tenantId: 't1', isDistributed: false, id: { in: [TIP] } })
    expect(dbMock.tipEntry.updateMany.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', id: { in: [TIP] } })
  })
})
