import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// W27-1 Kritik: PATCH /settings icinde activeModules (R7) ve businessType yalniz sahibe aittir.
// DB ve kimlik katmani sahte; DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn(), update: vi.fn() },
}))

vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() } }))
vi.mock('../lib/anamnesis-seeder', () => ({ seedDefaultAnamnesisQuestions: vi.fn() }))
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
const URL = '/api/v1/tenants/salon/settings'
const patch = (role: string, body: object) => request(app).patch(URL).set('x-role', role).send(body)

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.tenant.findUnique.mockResolvedValue({ settings: { phone: '05321234567' }, businessType: 'barbershop' })
  dbMock.tenant.update.mockResolvedValue({
    id: 't1', name: 'Salon', slug: 'salon', settings: {}, onboardingCompleted: true, businessType: 'barbershop',
  })
})

describe('PATCH /settings alan bazli rol kapisi', () => {
  it('owner activeModules degistirebilir', async () => {
    const res = await patch('owner', { activeModules: ['appointments'] })
    expect(res.status).toBe(200)
    expect(dbMock.tenant.update).toHaveBeenCalledTimes(1)
  })

  it('owner businessType degistirebilir', async () => {
    const res = await patch('owner', { businessType: 'dentist' })
    expect(res.status).toBe(200)
    expect(dbMock.tenant.update.mock.calls[0][0].data.businessType).toBe('dentist')
  })

  it('manager activeModules gonderirse 403 FORBIDDEN, hicbir sey yazilmaz', async () => {
    const res = await patch('manager', { activeModules: ['appointments'] })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })

  it('manager businessType gonderirse 403 FORBIDDEN, hicbir sey yazilmaz', async () => {
    const res = await patch('manager', { businessType: 'dentist' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })

  it('manager gecerli bir alanla birlikte sahip alani gonderirse butun istek reddedilir (kismi yazma yok)', async () => {
    const res = await patch('manager', { name: 'Yeni Ad', businessType: 'dentist' })
    expect(res.status).toBe(403)
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })

  it('manager mevcut turle ayni businessType gonderse de 403 (alan sahibe aittir)', async () => {
    const res = await patch('manager', { businessType: 'barbershop' })
    expect(res.status).toBe(403)
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })

  it('manager kendi alanlarini degistirebilir (name, phone)', async () => {
    const res = await patch('manager', { name: 'Yeni Ad', phone: '05329998877' })
    expect(res.status).toBe(200)
    expect(dbMock.tenant.update).toHaveBeenCalledTimes(1)
    const data = dbMock.tenant.update.mock.calls[0][0].data
    expect(data.name).toBe('Yeni Ad')
    expect(data).not.toHaveProperty('businessType')
    expect(data.settings).not.toHaveProperty('activeModules')
  })

  it.each(['staff', 'receptionist'])('%s hicbir alani degistiremez (403)', async (role) => {
    const res = await patch(role, { name: 'Yeni Ad' })
    expect(res.status).toBe(403)
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })

  it('manager gecersiz businessType ile 400 alir (dogrulama kapidan once); sahip alani yazilmaz', async () => {
    const res = await patch('manager', { businessType: 'NOPE' })
    expect(res.status).toBe(400)
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })
})
