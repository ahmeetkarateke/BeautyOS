import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestStaff,
  createTestService,
  createTestCustomer,
  cleanupTenant,
} from './helpers/setup'

// Personel odemeleri (gercek PG): Istanbul gun siniri, cakisan donem 409 (yaris dahil), eksi net 400, kurus hesabi.
const app = createApp({ rateLimitMax: 1000 })

describe('staff-payouts (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenant: { id: string; slug: string }
  let ownerToken: string
  let staffId: string
  let serviceId: string
  let customerId: string
  let base: string

  async function addTx(completedAt: Date, commission: string) {
    const appt = await db.appointment.create({
      data: {
        tenantId: tenant.id, customerId, requestedName: 'Prim', requestedPhone: '+905320000077', staffId, serviceId,
        referenceCode: `P-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        startAt: completedAt, endAt: new Date(completedAt.getTime() + 3600 * 1000),
        priceCharged: 100, status: 'pending', bookingChannel: 'web', phoneVerified: false,
      },
    })
    await db.transaction.create({
      data: {
        tenantId: tenant.id, appointmentId: appt.id, staffId, grossAmount: 100, commissionRate: 0.1, commissionAmount: commission,
        paymentMethod: 'cash', cashAmount: 100, cardAmount: 0, status: 'completed', completedAt,
      },
    })
  }

  const post = (body: Record<string, unknown>) =>
    request(app).post(base).set('Authorization', `Bearer ${ownerToken}`).send({ staffId, ...body })

  beforeAll(async () => {
    tenant = await createTestTenant(suffix)
    ownerToken = (await createTestOwner(tenant.id, tenant.slug, suffix)).token
    const staff = await createTestStaff(tenant.id, tenant.slug, suffix)
    staffId = staff.profile.id
    serviceId = (await createTestService(tenant.id, suffix)).id
    customerId = (await createTestCustomer(tenant.id, '+905320000078', suffix)).id
    base = `/api/v1/tenants/${tenant.slug}/staff-payouts`
    // 2026-03-31 23:30 UTC = 2026-04-01 02:30 Istanbul -> Nisan'a ait
    await addTx(new Date('2026-03-31T23:30:00.000Z'), '10.10')
    // 2026-04-30 21:30 UTC = 2026-05-01 00:30 Istanbul -> Mayis'a ait
    await addTx(new Date('2026-04-30T21:30:00.000Z'), '20.20')
    // Nisan icinde, kurus toplami: 0.10 + 0.20 float'ta 0.30000000000000004
    await addTx(new Date('2026-04-10T09:00:00.000Z'), '0.10')
    await addTx(new Date('2026-04-11T09:00:00.000Z'), '0.20')
  })

  afterAll(async () => {
    await cleanupTenant(tenant.id)
  })

  it('K1: donem Istanbul gun sinirina gore hesaplanir (UTC kaymasi yok)', async () => {
    const res = await request(app)
      .get(`${base}/calculate?staffId=${staffId}&from=2026-04-01&to=2026-04-30`)
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    // 31 Mart 23:30 UTC (Istanbul 1 Nisan) dahil; 30 Nisan 21:30 UTC (Istanbul 1 Mayis) haric
    expect(res.body.grossEarned).toBe(10.4)
    expect(res.body.transactionCount).toBe(3)
  })

  it('K2: kurus hesabi Decimal ile yapilir (0.10 + 0.20 + bonus 0.10 = tam 0.50 ... net)', async () => {
    const res = await post({ periodStart: '2026-04-10', periodEnd: '2026-04-12', bonus: 0.1 })
    expect(res.status).toBe(201)
    expect(res.body.grossEarned).toBe(0.3)
    expect(res.body.netAmount).toBe(0.4)
    await db.staffPayout.deleteMany({ where: { tenantId: tenant.id } })
  })

  it('K3: kesinti hak edis + ek odemeyi asarsa 400 NEGATIVE_NET ve kayit olusmaz', async () => {
    const res = await post({ periodStart: '2026-04-10', periodEnd: '2026-04-12', deductions: 5 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('NEGATIVE_NET')
    expect(await db.staffPayout.count({ where: { tenantId: tenant.id } })).toBe(0)
  })

  it('K4: cakisan donemde ikinci odeme 409 PAYOUT_OVERLAP; iptal edilince yeniden yazilabilir', async () => {
    const first = await post({ periodStart: '2026-04-01', periodEnd: '2026-04-15' })
    expect(first.status).toBe(201)
    const overlap = await post({ periodStart: '2026-04-15', periodEnd: '2026-04-30' })
    expect(overlap.status).toBe(409)
    expect(overlap.body.error.code).toBe('PAYOUT_OVERLAP')
    const adjacent = await post({ periodStart: '2026-04-16', periodEnd: '2026-04-30' })
    expect(adjacent.status).toBe(201)
    await db.staffPayout.updateMany({ where: { id: first.body.id }, data: { status: 'cancelled' } })
    const again = await post({ periodStart: '2026-04-01', periodEnd: '2026-04-15' })
    expect(again.status).toBe(201)
    await db.staffPayout.deleteMany({ where: { tenantId: tenant.id } })
  })

  it('K5: ayni anda gelen iki istekten yalniz biri kayit olusturur (yaris)', async () => {
    const results = await Promise.all([
      post({ periodStart: '2026-04-01', periodEnd: '2026-04-30' }),
      post({ periodStart: '2026-04-01', periodEnd: '2026-04-30' }),
      post({ periodStart: '2026-04-05', periodEnd: '2026-04-20' }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409])
    expect(await db.staffPayout.count({ where: { tenantId: tenant.id, status: { not: 'cancelled' } } })).toBe(1)
    await db.staffPayout.deleteMany({ where: { tenantId: tenant.id } })
  })

  it('K6: PATCH ile kesinti artirilip net eksiye dusurulemez', async () => {
    const created = await post({ periodStart: '2026-04-10', periodEnd: '2026-04-12' })
    expect(created.status).toBe(201)
    const res = await request(app)
      .patch(`${base}/${created.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ deductions: 5 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('NEGATIVE_NET')
    const row = await db.staffPayout.findUniqueOrThrow({ where: { id: created.body.id } })
    expect(Number(row.netAmount)).toBe(0.3)
  })
})
