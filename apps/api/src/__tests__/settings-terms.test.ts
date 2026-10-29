import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// A5 / ADR-0031: terim seti ve terim ozellestirmeleri (PATCH /settings). Yalniz sahip yazar; zod ile dogrulanir.
// db ve kimlik katmani sahte; DB/Redis gerekmez.
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

describe('PATCH /settings termSet ve termOverrides', () => {
  it('owner terim setini ve ozellestirmeleri kaydeder; digerleri korunur', async () => {
    const res = await patch('owner', { termSet: 'clinic_patient', termOverrides: { client: 'Hasta', appointment: 'Muayene' } })
    expect(res.status).toBe(200)
    expect(dbMock.tenant.update.mock.calls[0][0].data.settings).toMatchObject({
      termSet: 'clinic_patient', termOverrides: { client: 'Hasta', appointment: 'Muayene' }, phone: '05321234567',
    })
  })

  it.each([{ termSet: 'clinic_client' }, { termOverrides: { client: 'Danisan' } }])('manager %j gonderirse 403, yazilmaz (yalniz sahip)', async (body) => {
    const res = await patch('manager', body)
    expect(res.status).toBe(403)
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })

  it.each(['staff', 'receptionist'])('%s degistiremez: 403', async (role) => {
    expect((await patch(role, { termSet: 'salon' })).status).toBe(403)
  })

  it('bilinmeyen terim seti 400 (baska her alan gecerli)', async () => {
    const res = await patch('owner', { termSet: 'hospital' })
    expect(res.status).toBe(400)
    expect(dbMock.tenant.update).not.toHaveBeenCalled()
  })

  it('termOverrides deger string degilse 400', async () => {
    expect((await patch('owner', { termOverrides: { client: 5 } })).status).toBe(400)
  })

  it('termOverrides degeri 60 karakteri asarsa 400, 60 kabul', async () => {
    expect((await patch('owner', { termOverrides: { client: 'a'.repeat(61) } })).status).toBe(400)
    expect((await patch('owner', { termOverrides: { client: 'a'.repeat(60) } })).status).toBe(200)
  })

  it('termOverrides en cok 30 anahtar', async () => {
    const many = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`k${i}`, 'v']))
    expect((await patch('owner', { termOverrides: many })).status).toBe(400)
  })

  it('terim degerinde HTML isareti reddedilir (XSS), anahtar adi da harf/rakam/alt cizgi', async () => {
    expect((await patch('owner', { termOverrides: { client: '<script>x</script>' } })).status).toBe(400)
    expect((await patch('owner', { termOverrides: { 'a b<': 'Hasta' } })).status).toBe(400)
  })
})
