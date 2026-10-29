import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// docs/tasarim.md 8.1: GET /customers/:id uzmana (staff) tutar alanlarini (lifetimeValue, priceCharged) dondurmez.
// db ve kimlik katmani sahte; DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  customer: { findFirst: vi.fn() },
  staffProfile: { findFirst: vi.fn() },
}))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() }, scheduleReminders: vi.fn(), cancelReminders: vi.fn() }))
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
const ID = '00000000-0000-4000-8000-000000000001'
const get = (role: string) => request(app).get(`/api/v1/tenants/salon/customers/${ID}`).set('x-role', role)

const customer = {
  id: ID, fullName: 'Ayse Yilmaz', phone: '+905321234567', email: null, birthDate: null, allergyNotes: null, preferenceNotes: null,
  totalVisits: 4, lifetimeValue: 1250.5, segment: 'regular', lastVisitAt: null, phoneVerifiedAt: null,
  marketingConsentSms: false, marketingConsentEmail: false, createdAt: new Date('2026-01-01T00:00:00Z'),
  appointments: [{ id: 'a1', startAt: new Date('2026-10-01T09:00:00Z'), endAt: new Date('2026-10-01T10:00:00Z'), status: 'completed', priceCharged: 300, service: { name: 'Sac' }, staff: { user: { fullName: 'Uzman' } } }],
}

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.customer.findFirst.mockResolvedValue(customer)
  dbMock.staffProfile.findFirst.mockResolvedValue({ id: 'sp1' })
})

describe('GET /customers/:id tutar alanlari', () => {
  it.each(['owner', 'manager', 'receptionist'])('%s lifetimeValue ve randevu priceCharged alanlarini gorur', async (role) => {
    const res = await get(role)
    expect(res.status).toBe(200)
    expect(res.body.lifetimeValue).toBe(1250.5)
    expect(res.body.appointments[0].priceCharged).toBe(300)
  })

  it('staff: lifetimeValue ve priceCharged anahtarlari hic bulunmaz (null da donmez); diger alanlar duruyor', async () => {
    const res = await get('staff')
    expect(res.status).toBe(200)
    expect(res.body).not.toHaveProperty('lifetimeValue')
    expect(res.body.appointments[0]).not.toHaveProperty('priceCharged')
    expect(JSON.stringify(res.body)).not.toMatch(/1250|300/)
    expect(res.body).toMatchObject({ id: ID, fullName: 'Ayse Yilmaz', totalVisits: 4 })
    expect(res.body.appointments[0]).toMatchObject({ id: 'a1', serviceName: 'Sac', status: 'completed' })
  })

  it('staff icin tutar alanlari veritabanindan hic secilmez', async () => {
    await get('staff')
    const select = dbMock.customer.findFirst.mock.calls[0][0].select
    expect(select).not.toHaveProperty('lifetimeValue')
    expect(select.appointments.select).not.toHaveProperty('priceCharged')
  })

  it('musteri bulunamazsa (ya da uzmanin musterisi degilse) staff icin 404', async () => {
    dbMock.customer.findFirst.mockResolvedValue(null)
    expect((await get('staff')).status).toBe(404)
  })
})
