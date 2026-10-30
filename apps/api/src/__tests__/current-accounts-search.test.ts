import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// W13-API-1 Oneri 1: cari hesap musteri aramasi da telefonu normalize eder ve jokerleri kacislar. db sahte.
const dbMock = vi.hoisted(() => ({
  currentAccountEntry: { groupBy: vi.fn(), findMany: vi.fn() },
  customer: { findMany: vi.fn() },
  supplier: { findMany: vi.fn() },
}))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../middleware/auth.middleware', () => ({
  authenticateJWT: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'u-me', tenantId: 't1', tenantSlug: 'salon', role: 'owner' } as never
    next()
  },
  requireTenantAccess: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = 't1'
    next()
  },
  checkTenantActive: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

import { createCurrentAccountsRouter } from '../routes/current-accounts.route'

const app = express().use('/api/v1/tenants/:slug', createCurrentAccountsRouter())

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.currentAccountEntry.groupBy.mockResolvedValue([])
  dbMock.customer.findMany.mockResolvedValue([])
})

const whereOf = () => dbMock.customer.findMany.mock.calls[0][0].where as { tenantId: string; OR: Array<Record<string, { contains: string }>> }

describe('cari hesap musteri aramasi', () => {
  it('0532 ve +90532 yazimlari ayni ulusal desenle aranir; kiraci filtresi korunur', async () => {
    for (const term of ['0532 111', '+90532111']) {
      dbMock.customer.findMany.mockClear()
      const res = await request(app).get(`/api/v1/tenants/salon/current-accounts?search=${encodeURIComponent(term)}`)
      expect(res.status, term).toBe(200)
      expect(whereOf().tenantId).toBe('t1')
      expect(whereOf().OR[1].phone.contains, term).toBe('532111')
    }
  })

  it('ad aramasinda LIKE jokerleri kacislanir; harf+rakam karisik terim aynen aranir', async () => {
    await request(app).get(`/api/v1/tenants/salon/current-accounts?search=${encodeURIComponent('a_c')}`)
    expect(whereOf().OR[0].fullName.contains).toBe('a\\_c')
    dbMock.customer.findMany.mockClear()
    await request(app).get(`/api/v1/tenants/salon/current-accounts?search=ab532`)
    expect(whereOf().OR[1].phone.contains).toBe('ab532')
  })
})
