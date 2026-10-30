import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// W25-stok-1: stok okuma uclari (liste, dusuk stok, hareketler) yalniz sahip ve mudur; birim maliyet baska role donmez.
const dbMock = vi.hoisted(() => ({
  inventoryItem: { findMany: vi.fn(), findFirst: vi.fn() },
  stockMovement: { findMany: vi.fn(), count: vi.fn() },
  $queryRaw: vi.fn(),
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
const ITEM = '33333333-3333-4333-8333-333333333333'
const row = { id: ITEM, tenantId: 't1', name: 'Boya', sku: null, quantity: 1, lowStockThreshold: 2, unitCost: 41.5, sellingPrice: 60, unit: 'adet', updatedAt: new Date() }

const URLS = [`${BASE}/inventory`, `${BASE}/inventory/low-stock`, `${BASE}/inventory/${ITEM}/movements`]

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.inventoryItem.findMany.mockResolvedValue([row])
  dbMock.inventoryItem.findFirst.mockResolvedValue(row)
  dbMock.$queryRaw.mockResolvedValue([row])
  dbMock.stockMovement.findMany.mockResolvedValue([])
  dbMock.stockMovement.count.mockResolvedValue(0)
})

describe('stok okuma uclari rol kapisi', () => {
  for (const role of ['staff', 'receptionist']) {
    for (const url of URLS) {
      it(`${role} ${url.replace(BASE, '')} -> 403 FORBIDDEN, veri sorgulanmaz`, async () => {
        const res = await request(app).get(url).set('x-role', role)
        expect(res.status).toBe(403)
        expect(res.body.error.code).toBe('FORBIDDEN')
        expect(dbMock.inventoryItem.findMany).not.toHaveBeenCalled()
        expect(dbMock.$queryRaw).not.toHaveBeenCalled()
        expect(dbMock.stockMovement.findMany).not.toHaveBeenCalled()
      })
    }
  }

  for (const role of ['owner', 'manager']) {
    it(`${role} stok listesini birim maliyetiyle gorur`, async () => {
      const res = await request(app).get(`${BASE}/inventory`).set('x-role', role)
      expect(res.status).toBe(200)
      expect(res.body.data[0].unitCost).toBe(41.5)
    })
    it(`${role} dusuk stok ve hareket listesine erisir`, async () => {
      expect((await request(app).get(`${BASE}/inventory/low-stock`).set('x-role', role)).status).toBe(200)
      expect((await request(app).get(`${BASE}/inventory/${ITEM}/movements`).set('x-role', role)).status).toBe(200)
    })
  }
})
