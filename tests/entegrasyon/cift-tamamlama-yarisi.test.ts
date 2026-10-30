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
  cleanupTenant,
} from './helpers/setup'

// A6b: eszamanli cift tamamlama yarisi (gercek PG). Ayni randevuya es zamanli uc PATCH completed:
// tam biri 200, digerleri 409 STATUS_LOCKED; kasada tek islem kaydi. Bu dosya tests/entegrasyon altindadir;
// api-test.sh kosudan once apps/api/src/__tests__/ icine kopyalar.
const app = createApp({ rateLimitMax: 1000 })

describe('A6b: eszamanli cift tamamlama (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let slug: string
  let owner: string
  let staffId: string
  let serviceId: string
  let customerId: string

  const completeAll = (id: string, adet: number) =>
    Promise.all(
      Array.from({ length: adet }, () =>
        request(app)
          .patch(`/api/v1/tenants/${slug}/appointments/${id}/status`)
          .set('Authorization', `Bearer ${owner}`)
          .send({ status: 'completed', paymentMethod: 'cash' }),
      ),
    )

  const randevu = (hours: number) => {
    const start = new Date(Date.now() + hours * 3600_000)
    return db.appointment.create({
      data: {
        tenantId, customerId, staffId, serviceId,
        referenceCode: `Y-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        startAt: start, endAt: new Date(start.getTime() + 1800_000), priceCharged: 300, status: 'confirmed',
      },
    })
  }

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    slug = tenant.slug
    owner = (await createTestOwner(tenantId, slug, suffix)).token
    staffId = (await createTestStaff(tenantId, slug, suffix)).profile.id
    serviceId = (await createTestService(tenantId, suffix)).id
    customerId = (await db.customer.create({ data: { tenantId, fullName: 'Yaris Musteri', phone: '+905329990077' } })).id
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  it('A6b: 3 es zamanli tamamlama -> biri 200, ikisi 409 STATUS_LOCKED; kasada tek kayit', async () => {
    const a = await randevu(2)
    const results = await completeAll(a.id, 3)
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409])
    for (const r of results.filter((x) => x.status === 409)) expect(r.body.error.code).toBe('STATUS_LOCKED')
    expect(await db.transaction.count({ where: { tenantId, appointmentId: a.id } })).toBe(1)
  })

  it('A6b olumlu esleme: tek tamamlama 200 ve tek kayit (yaris testi tesadufen gecmiyor)', async () => {
    const b = await randevu(5)
    const [only] = await completeAll(b.id, 1)
    expect(only.status).toBe(200)
    expect(await db.transaction.count({ where: { tenantId, appointmentId: b.id } })).toBe(1)
  })
})
