import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// S-stok-yetki-1 onerisi: tedarikci listesi ve hizmet recetesi okuma uclari da yalniz sahip ve mudur.
const dbMock = vi.hoisted(() => ({
  supplier: { findMany: vi.fn() },
  service: { findFirst: vi.fn() },
  serviceInventoryRecipe: { findMany: vi.fn() },
}))

vi.mock('../lib/db', () => ({ db: dbMock }))
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

import { createStockRouter } from '../routes/stock.route'

const app = express().use(express.json()).use('/api/v1/tenants/:slug', createStockRouter())
const BASE = '/api/v1/tenants/salon'
const SERVICE = '55555555-5555-4555-8555-555555555555'
const URLS = [`${BASE}/suppliers`, `${BASE}/services/${SERVICE}/inventory-recipes`]

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.supplier.findMany.mockResolvedValue([])
  dbMock.service.findFirst.mockResolvedValue({ id: SERVICE })
  dbMock.serviceInventoryRecipe.findMany.mockResolvedValue([])
})

describe('tedarikci ve recete okuma rol kapisi', () => {
  for (const role of ['staff', 'receptionist']) {
    for (const url of URLS) {
      it(`${role} ${url.replace(BASE, '')} -> 403 FORBIDDEN, veri sorgulanmaz`, async () => {
        const res = await request(app).get(url).set('x-role', role)
        expect(res.status).toBe(403)
        expect(res.body.error.code).toBe('FORBIDDEN')
        expect(dbMock.supplier.findMany).not.toHaveBeenCalled()
        expect(dbMock.serviceInventoryRecipe.findMany).not.toHaveBeenCalled()
      })
    }
  }
  for (const role of ['owner', 'manager']) {
    it(`${role} her iki listeyi okuyabilir`, async () => {
      for (const url of URLS) expect((await request(app).get(url).set('x-role', role)).status).toBe(200)
    })
  }
})
