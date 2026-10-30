import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// ADR-0045 + ADR-0044: randevu durumu tek yardimcidan; panel randevusu confirmed acilir ve hatirlatma isleri hemen kurulur;
// elle pending'e cekilince isler silinir. db, kuyruk ve kimlik katmani sahte; DB/Redis gerekmez.
const m = vi.hoisted(() => ({
  db: {
    customer: { findFirst: vi.fn() },
    service: { findFirst: vi.fn() },
    staffServiceAssignment: { findFirst: vi.fn() },
    appointment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
  scheduleReminders: vi.fn(),
  cancelReminders: vi.fn(),
}))

vi.mock('../lib/db', () => ({ db: m.db }))
vi.mock('../lib/queue', () => ({
  remindersQueue: { add: vi.fn(), remove: vi.fn() },
  scheduleReminders: m.scheduleReminders,
  cancelReminders: m.cancelReminders,
}))
vi.mock('../middleware/auth.middleware', () => ({
  authenticateJWT: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'u1', tenantId: 't1', tenantSlug: 'salon', role: 'owner' } as never
    next()
  },
  requireTenantAccess: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = 't1'
    next()
  },
  checkTenantActive: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

import { createTenantRouter } from '../routes/tenant.route'
import { initialAppointmentStatus } from '../lib/appointment-status'

const app = express().use(express.json()).use('/api/v1/tenants/:slug', createTenantRouter())
const U = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
const START = new Date(Date.now() + 72 * 3_600_000)
const flush = () => new Promise((r) => setTimeout(r, 10))

beforeEach(() => {
  vi.clearAllMocks()
  m.scheduleReminders.mockResolvedValue(undefined)
  m.cancelReminders.mockResolvedValue(undefined)
})

describe('ADR-0045: baslangic durumu tablosu', () => {
  it.each([
    ['manual', undefined, 'confirmed'],
    ['waitlist', undefined, 'confirmed'],
    ['bot', undefined, 'confirmed'],
    ['web', { approvalRequired: false }, 'confirmed'],
    ['web', { approvalRequired: true }, 'pending'],
  ] as const)('%s (%j) -> %s', (channel, opts, expected) => {
    expect(initialAppointmentStatus(channel, opts)).toBe(expected)
  })
})

describe('POST /appointments (panel)', () => {
  beforeEach(() => {
    m.db.customer.findFirst.mockResolvedValue({ id: U(1) })
    m.db.service.findFirst.mockResolvedValue({ durationMinutes: 60, price: 100 })
    m.db.staffServiceAssignment.findFirst.mockResolvedValue({ priceOverride: null })
    m.db.appointment.findFirst.mockResolvedValue(null)
    m.db.appointment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'a1', referenceCode: 'APT-X', customer: { fullName: 'Ayse' }, service: { name: 'Sac' },
      staff: { colorCode: 1, user: { fullName: 'Uzman' } }, ...data,
    }))
  })
  const create = () => request(app).post('/api/v1/tenants/salon/appointments').send({ customerId: U(1), serviceId: U(2), staffId: U(3), startAt: START.toISOString() })

  it('panel randevusu confirmed acilir (bookingChannel manual)', async () => {
    const res = await create()
    expect(res.status).toBe(201)
    const data = m.db.appointment.create.mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'confirmed', bookingChannel: 'manual', tenantId: 't1' })
  })

  it('olusturulunca 24 saat ve 2 saat hatirlatma isleri kurulur (kiraci ve baslangic ile)', async () => {
    await create()
    await flush()
    expect(m.scheduleReminders).toHaveBeenCalledTimes(1)
    const arg = m.scheduleReminders.mock.calls[0][0]
    expect(arg).toMatchObject({ appointmentId: 'a1', tenantId: 't1' })
    expect(arg.startAt.toISOString()).toBe(START.toISOString())
  })
})

describe('PATCH /appointments/:id/status ile hatirlatma isleri', () => {
  const patch = (status: string) => request(app).patch(`/api/v1/tenants/salon/appointments/${U(5)}/status`).send({ status })
  beforeEach(() => {
    m.db.appointment.update.mockResolvedValue({ id: U(5), status: 'x', cancellationReason: null })
  })
  const existing = (status: string) => ({ id: U(5), tenantId: 't1', status, customerId: U(1), staffId: U(3), startAt: START })

  it('confirmed -> pending: bekleyen hatirlatma isleri silinir', async () => {
    m.db.appointment.findFirst.mockResolvedValue(existing('confirmed'))
    const res = await patch('pending')
    expect(res.status).toBe(200)
    await flush()
    expect(m.cancelReminders).toHaveBeenCalledWith(U(5))
    expect(m.scheduleReminders).not.toHaveBeenCalled()
  })

  it('pending -> confirmed: hatirlatma isleri kurulur', async () => {
    m.db.appointment.findFirst.mockResolvedValue(existing('pending'))
    const res = await patch('confirmed')
    expect(res.status).toBe(200)
    await flush()
    expect(m.scheduleReminders).toHaveBeenCalledTimes(1)
    expect(m.scheduleReminders.mock.calls[0][0]).toMatchObject({ appointmentId: U(5), tenantId: 't1' })
  })

  it('confirmed -> cancelled: isler silinir', async () => {
    m.db.appointment.findFirst.mockResolvedValue(existing('confirmed'))
    await patch('cancelled')
    await flush()
    expect(m.cancelReminders).toHaveBeenCalledWith(U(5))
  })
})
