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

// Panel ozeti (gercek PG): sayaclar ve bugunku kasa kiracıya ozeldir; B kiracisinda veri varken A'da gorunmez.
const app = createApp({ rateLimitMax: 1000 })

describe('panel-summary (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let a: { id: string; slug: string }
  let b: { id: string; slug: string }
  let ownerA: string
  let staffA: string

  beforeAll(async () => {
    a = await createTestTenant(suffix)
    b = await createTestTenant(`${suffix}b`)
    ownerA = (await createTestOwner(a.id, a.slug, suffix)).token
    staffA = (await createTestStaff(a.id, a.slug, suffix)).token

    // B: bekleyen web talebi, bekleme kaydi ve bugunku islem var
    const staffB = await createTestStaff(b.id, b.slug, `${suffix}b`)
    const svcB = await createTestService(b.id, `${suffix}b`)
    const custB = await createTestCustomer(b.id, '+905320000099', `${suffix}b`)
    const start = new Date(Date.now() + 3600 * 1000)
    const apptB = await db.appointment.create({
      data: {
        tenantId: b.id, customerId: null, requestedName: 'Talep', requestedPhone: '+905320000098', staffId: staffB.profile.id, serviceId: svcB.id,
        referenceCode: `T-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, startAt: start, endAt: new Date(start.getTime() + 3600 * 1000),
        priceCharged: 100, status: 'pending', bookingChannel: 'web',
      },
    })
    await db.waitlist.create({ data: { tenantId: b.id, customerId: custB.id, status: 'waiting' } })
    await db.transaction.create({
      data: {
        tenantId: b.id, appointmentId: apptB.id, staffId: staffB.profile.id, grossAmount: 777, commissionRate: 0, commissionAmount: 0,
        paymentMethod: 'cash', cashAmount: 777, cardAmount: 0, status: 'completed', completedAt: new Date(),
      },
    })
    // B'de verinin gercekten var oldugunu dogrula (A'da gorunmeme testi tesadufen gecmesin)
    const ownerB = (await createTestOwner(b.id, b.slug, `${suffix}b`)).token
    const own = await request(app).get(`/api/v1/tenants/${b.slug}/panel-summary`).set('Authorization', `Bearer ${ownerB}`)
    expect(own.body.counters).toEqual({ pendingOnlineRequests: 1, waitingList: 1 })
    expect(own.body.cashToday.totalAmount).toBe(777)
  })

  afterAll(async () => {
    await cleanupTenant(a.id)
    await cleanupTenant(b.id)
  })

  const get = (slug: string, token: string) => request(app).get(`/api/v1/tenants/${slug}/panel-summary`).set('Authorization', `Bearer ${token}`)

  it('K-tenant: A sahibi B verisini saymaz; bos salon 0 sayac, 0 kasa ve kurulum yuzdesi 0', async () => {
    const res = await get(a.slug, ownerA)
    expect(res.status).toBe(200)
    expect(res.body.counters).toEqual({ pendingOnlineRequests: 0, waitingList: 0 })
    expect(res.body.cashToday).toEqual({ totalAmount: 0, cashAmount: 0, cardAmount: 0, count: 0 })
    expect(res.body.setup.percent).toBeLessThan(40)
  })

  it('K-rol: uzman null bloklar alir; baska kiracinin slug\'i ile istek reddedilir', async () => {
    const res = await get(a.slug, staffA)
    expect(res.body.cashToday).toBeNull()
    expect(res.body.counters.waitingList).toBeNull()
    const cross = await get(b.slug, ownerA)
    expect([401, 403, 404]).toContain(cross.status)
  })
})
