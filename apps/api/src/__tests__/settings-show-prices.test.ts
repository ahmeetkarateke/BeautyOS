import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// A7 / ADR-0043: PATCH /settings showPricesOnline. Mevcut ayar kurallari: yalniz owner ve manager yazar. db ve kimlik katmani sahte.
const dbMock = vi.hoisted(() => ({ tenant: { findUnique: vi.fn(), update: vi.fn() } }))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() }, scheduleReminders: vi.fn(), cancelReminders: vi.fn() }))
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
const patch = (role: string, body: object) => request(app).patch('/api/v1/tenants/salon/settings').set('x-role', role).send(body)

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.tenant.findUnique.mockResolvedValue({ settings: { phone: '05321234567' }, businessType: 'dentist' })
  dbMock.tenant.update.mockResolvedValue({ id: 't1', name: 'S', slug: 'salon', settings: {}, onboardingCompleted: true, businessType: 'dentist' })
})

describe('PATCH /settings showPricesOnline', () => {
  it.each(['owner', 'manager'])('%s fiyat gorunurlugunu degistirebilir; deger settings icine birlesir, digerleri korunur', async (role) => {
    const res = await patch(role, { showPricesOnline: true })
    expect(res.status).toBe(200)
    const data = dbMock.tenant.update.mock.calls[0][0].data
    expect(data.settings).toMatchObject({ showPricesOnline: true, phone: '05321234567' })
  })

  it.each(['staff', 'receptionist'])('%s degistiremez: 403, yazilmaz', async (role) => {
    const res = await patch(role, { showPricesOnline: true })
    expect(res.status).toBe(403)
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })

  it('boolean olmayan deger 400 (baska her alan gecerli), yazilmaz', async () => {
    const res = await patch('owner', { showPricesOnline: 'evet' })
    expect(res.status).toBe(400)
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })

  it('false de kaydedilir (klinik olmayan tur fiyati gizleyebilir)', async () => {
    await patch('owner', { showPricesOnline: false })
    expect(dbMock.tenant.update.mock.calls[0][0].data.settings.showPricesOnline).toBe(false)
  })
})
