import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Salon musteri aydinlatma penceresi: GET /public/tenant email ve privacyText doner (yoksa null);
// PATCH /settings email (owner+manager) ve privacyText (yalniz owner, en cok 5000) yazar. db ve kimlik sahte.
const m = vi.hoisted(() => ({ db: { tenant: { findUnique: vi.fn(), update: vi.fn() } } }))
vi.mock('../lib/db', () => ({ db: m.db }))
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
import { createPublicRouter } from '../routes/public.route'

const app = express()
  .use(express.json())
  .use('/api/v1/tenants/:slug/public', createPublicRouter())
  .use('/api/v1/tenants/:slug', createTenantRouter())
const getPublic = () => request(app).get('/api/v1/tenants/salon/public/tenant')
const patch = (body: object, role = 'owner') => request(app).patch('/api/v1/tenants/salon/settings').set('x-role', role).send(body)
const written = () => m.db.tenant.update.mock.calls[0][0].data.settings as Record<string, unknown>
const tenantWith = (settings: object) => ({ id: 't1', name: 'Salon', slug: 'salon', isActive: true, businessType: 'hair_salon', settings: { publicBookingEnabled: true, ...settings } })

beforeEach(() => {
  vi.clearAllMocks()
  m.db.tenant.findUnique.mockResolvedValue({ ...tenantWith({ email: 'eski@salon.com', privacyText: 'Eski metin' }), businessType: 'hair_salon' })
  m.db.tenant.update.mockResolvedValue({ id: 't1', name: 'Salon', slug: 'salon', settings: {}, onboardingCompleted: true, businessType: 'hair_salon' })
})

describe('GET /public/tenant email ve privacyText', () => {
  it('ayarlarda varsa ikisi de doner', async () => {
    m.db.tenant.findUnique.mockResolvedValue(tenantWith({ email: 'info@salon.com', privacyText: 'Aydinlatma metni' }))
    const res = await getPublic()
    expect(res.status).toBe(200)
    expect(res.body.email).toBe('info@salon.com')
    expect(res.body.privacyText).toBe('Aydinlatma metni')
  })

  it('ayarlarda yoksa ikisi de null (alan yanitta bulunur)', async () => {
    m.db.tenant.findUnique.mockResolvedValue(tenantWith({}))
    const res = await getPublic()
    expect(res.body).toHaveProperty('email', null)
    expect(res.body).toHaveProperty('privacyText', null)
  })
})

describe('PATCH /settings email', () => {
  it('owner ve manager gecerli e-postayi kucuk harfle yazar (buyuk I dahil)', async () => {
    expect((await patch({ email: '  INFO@SALON.COM ' })).status).toBe(200)
    expect(written().email).toBe('info@salon.com')
    m.db.tenant.update.mockClear()
    expect((await patch({ email: 'IRMAK@ISLETME.COM' }, 'manager')).status).toBe(200)
    expect(written().email).toBe('irmak@isletme.com')
  })

  it('gecersiz e-posta 400, yazilmaz', async () => {
    const res = await patch({ email: 'bu-eposta-degil' })
    expect(res.status).toBe(400)
    expect(m.db.tenant.update).not.toHaveBeenCalled()
  })

  it('email: null kayitli e-postayi siler, digerine dokunmaz', async () => {
    expect((await patch({ email: null })).status).toBe(200)
    expect(written()).not.toHaveProperty('email')
    expect(written().privacyText).toBe('Eski metin')
  })
})

describe('PATCH /settings privacyText', () => {
  it('owner yazar', async () => {
    expect((await patch({ privacyText: 'Yeni aydinlatma metni' })).status).toBe(200)
    expect(written().privacyText).toBe('Yeni aydinlatma metni')
  })

  it('manager yazamaz: 403 FORBIDDEN, hicbir sey yazilmaz', async () => {
    const res = await patch({ privacyText: 'Yeni' }, 'manager')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    expect(m.db.tenant.update).not.toHaveBeenCalled()
  })

  it('tam 5000 karakter kabul, 5001 reddedilir (400), yazilmaz', async () => {
    expect((await patch({ privacyText: 'a'.repeat(5000) })).status).toBe(200)
    m.db.tenant.update.mockClear()
    expect((await patch({ privacyText: 'a'.repeat(5001) })).status).toBe(400)
    expect(m.db.tenant.update).not.toHaveBeenCalled()
  })

  it('privacyText: null metni siler', async () => {
    expect((await patch({ privacyText: null })).status).toBe(200)
    expect(written()).not.toHaveProperty('privacyText')
  })

  it('isaretleme iceren metin reddedilir (arayuz metin olarak cizer)', async () => {
    const res = await patch({ privacyText: 'Merhaba <script>alert(1)</script>' })
    expect(res.status).toBe(400)
    expect(m.db.tenant.update).not.toHaveBeenCalled()
  })
})
