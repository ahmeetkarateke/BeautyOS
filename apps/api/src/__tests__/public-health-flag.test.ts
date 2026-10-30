import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Müdür kararı: public uçlar ham businessType açmaz; yalnız isHealthRegulated: boolean döner (estetik, diş, saç ekimi). db sahte.
const m = vi.hoisted(() => ({
  db: {
    tenant: { findUnique: vi.fn() },
    appointment: { findFirst: vi.fn() },
  },
}))

vi.mock('../lib/db', () => ({ db: m.db }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() }, scheduleReminders: vi.fn(), cancelReminders: vi.fn() }))

import { createPublicRouter } from '../routes/public.route'
import { createBookingManageRouter } from '../routes/bookings-public.route'

const app = express()
  .use(express.json())
  .use('/api/v1/tenants/:slug/public', createPublicRouter())
  .use('/api/v1/public/bookings', createBookingManageRouter({ limitMax: 10_000 }))

const TYPES: Array<[string, boolean]> = [
  ['aesthetic_clinic', true],
  ['dentist', true],
  ['hair_transplant', true],
  ['hair_salon', false],
  ['barbershop', false],
]

const tenantRow = (businessType: string) => ({ id: 't1', name: 'Salon X', slug: 'salon-x', isActive: true, businessType, settings: { phone: '05320000000', address: 'Moda Cd. 5', publicBookingEnabled: true } })
const bookingRow = (businessType: string) => {
  const startAt = new Date(Date.now() + 48 * 3_600_000)
  return {
    id: 'a1', tenantId: 't1', status: 'confirmed', referenceCode: 'RDV-1', customerId: 'c1', staffId: 's1', serviceId: 'sv1',
    startAt, endAt: new Date(startAt.getTime() + 3_600_000), priceCharged: 250,
    service: { name: 'Hizmet', durationMinutes: 60, bufferMinutes: 0 },
    staff: { user: { fullName: 'Uzman' } },
    tenant: tenantRow(businessType),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('GET /public/tenant isHealthRegulated', () => {
  for (const [type, expected] of TYPES) {
    it(`${type}: isHealthRegulated ${expected}; ham businessType yanitta yok`, async () => {
      m.db.tenant.findUnique.mockResolvedValue(tenantRow(type))
      const res = await request(app).get('/api/v1/tenants/salon-x/public/tenant')
      expect(res.status).toBe(200)
      expect(res.body.isHealthRegulated).toBe(expected)
      expect(res.body).not.toHaveProperty('businessType')
      expect(JSON.stringify(res.body)).not.toContain(type)
    })
  }
})

describe('POST /public/bookings/lookup isHealthRegulated', () => {
  for (const [type, expected] of TYPES) {
    it(`${type}: tenant.isHealthRegulated ${expected}; ham businessType yanitta yok`, async () => {
      m.db.appointment.findFirst.mockResolvedValue(bookingRow(type))
      const res = await request(app).post('/api/v1/public/bookings/lookup').send({ token: 'M'.repeat(43) })
      expect(res.status).toBe(200)
      expect(res.body.tenant.isHealthRegulated).toBe(expected)
      expect(res.body.tenant).not.toHaveProperty('businessType')
      expect(JSON.stringify(res.body)).not.toContain(type)
    })
  }

  it('showPrices kurali degismedi: klinikte varsayilan fiyat yok, berberde var', async () => {
    m.db.appointment.findFirst.mockResolvedValue(bookingRow('dentist'))
    const clinic = await request(app).post('/api/v1/public/bookings/lookup').send({ token: 'M'.repeat(43) })
    expect(clinic.body.appointment).not.toHaveProperty('price')
    m.db.appointment.findFirst.mockResolvedValue(bookingRow('barbershop'))
    const shop = await request(app).post('/api/v1/public/bookings/lookup').send({ token: 'M'.repeat(43) })
    expect(shop.body.appointment.price).toBe(250)
  })
})
