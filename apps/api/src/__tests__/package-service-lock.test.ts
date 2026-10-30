import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// W26-paketler-1 onerisi: satilmis (aktif musteri paketi olan) paketin hizmeti degistirilemez, aksi halde seanslar baska hizmete duser.
const dbMock = vi.hoisted(() => ({
  servicePackage: { findFirst: vi.fn(), update: vi.fn() },
  service: { findFirst: vi.fn() },
  customerPackage: { count: vi.fn() },
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

import { createPackagesRouter } from '../routes/packages.route'

const app = express().use(express.json()).use('/api/v1/tenants/:slug', createPackagesRouter())
const P = '00000000-0000-4000-8000-000000000001'
const S_OLD = '00000000-0000-4000-8000-0000000000a1'
const S_NEW = '00000000-0000-4000-8000-0000000000a2'
const patch = (body: object) => request(app).patch(`/api/v1/tenants/salon/packages/${P}`).set('x-role', 'owner').send(body)
const stored = { id: P, tenantId: 't1', serviceId: S_OLD, name: 'Paket', totalSessions: 6, price: 100, validityDays: null, description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() }

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.servicePackage.findFirst.mockResolvedValue(stored)
  dbMock.service.findFirst.mockResolvedValue({ id: S_NEW })
  dbMock.servicePackage.update.mockResolvedValue({ ...stored, serviceId: S_NEW, service: { id: S_NEW, name: 'Yeni', durationMinutes: 30 } })
})

describe('paket hizmet kilidi', () => {
  it('aktif musteri paketi varken serviceId degisikligi 409 PACKAGE_IN_USE, guncelleme yazilmaz', async () => {
    dbMock.customerPackage.count.mockResolvedValue(2)
    const res = await patch({ serviceId: S_NEW })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('PACKAGE_IN_USE')
    expect(dbMock.customerPackage.count.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', packageId: P, status: 'active' })
    expect(dbMock.servicePackage.update).not.toHaveBeenCalled()
  })

  it('sinir: tam 1 aktif musteri paketi bile kilitler (inUse > 0, > 1 degil)', async () => {
    dbMock.customerPackage.count.mockResolvedValue(1)
    const res = await patch({ serviceId: S_NEW })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('PACKAGE_IN_USE')
    expect(dbMock.servicePackage.update).not.toHaveBeenCalled()
  })

  it('satilmamis pakette serviceId degisir', async () => {
    dbMock.customerPackage.count.mockResolvedValue(0)
    const res = await patch({ serviceId: S_NEW })
    expect(res.status).toBe(200)
    expect(dbMock.servicePackage.update).toHaveBeenCalledTimes(1)
  })

  it('kullanimdaki pakette ayni serviceId gonderilirse ya da baska alan degisirse kilit devreye girmez', async () => {
    dbMock.customerPackage.count.mockResolvedValue(2)
    dbMock.servicePackage.update.mockResolvedValue({ ...stored, service: { id: S_OLD, name: 'Eski', durationMinutes: 30 } })
    expect((await patch({ serviceId: S_OLD })).status).toBe(200)
    expect((await patch({ name: 'Yeni ad' })).status).toBe(200)
    expect(dbMock.customerPackage.count).not.toHaveBeenCalled()
  })
})
