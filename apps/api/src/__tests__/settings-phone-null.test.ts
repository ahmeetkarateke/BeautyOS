import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// PATCH /settings: phone null gonderilirse kayitli telefon temizlenir; doluysa 7-20 kurali surer. DB ve kimlik sahte.
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
const patch = (body: object, role = 'owner') => request(app).patch('/api/v1/tenants/salon/settings').set('x-role', role).send(body)
const written = () => dbMock.tenant.update.mock.calls[0][0].data.settings as Record<string, unknown>

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.tenant.findUnique.mockResolvedValue({ settings: { phone: '05321234567', address: 'Atatürk Cad. 5' }, businessType: 'barbershop' })
  dbMock.tenant.update.mockResolvedValue({ id: 't1', name: 'Salon', slug: 'salon', settings: {}, onboardingCompleted: true, businessType: 'barbershop' })
})

describe('PATCH /settings phone temizleme', () => {
  it('phone: null kayitli telefonu siler, diger ayarlara dokunmaz', async () => {
    const res = await patch({ phone: null })
    expect(res.status).toBe(200)
    expect(written()).not.toHaveProperty('phone')
    expect(written().address).toBe('Atatürk Cad. 5')
  })

  it('manager de telefonu temizleyebilir', async () => {
    expect((await patch({ phone: null }, 'manager')).status).toBe(200)
    expect(written()).not.toHaveProperty('phone')
  })

  it('dolu telefon yazilir (geriye uyum)', async () => {
    expect((await patch({ phone: '05559998877' })).status).toBe(200)
    expect(written().phone).toBe('05559998877')
  })

  it('phone gonderilmezse mevcut telefon korunur', async () => {
    expect((await patch({ address: 'Yeni Cad. 12' })).status).toBe(200)
    expect(written().phone).toBe('05321234567')
  })

  it('dolu ama 7 haneden kisa telefon 400 VALIDATION_ERROR, yazilmaz (kural surer)', async () => {
    const res = await patch({ phone: '12345' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })

  it('21 karakterlik telefon 400, yazilmaz', async () => {
    expect((await patch({ phone: '1'.repeat(21) })).status).toBe(400)
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })

  it("bos string '' telefon 400 (temizleme yalniz null ile)", async () => {
    expect((await patch({ phone: '' })).status).toBe(400)
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })
})
