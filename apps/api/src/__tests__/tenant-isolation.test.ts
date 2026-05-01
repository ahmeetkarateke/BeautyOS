import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createApp } from '../app'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestService,
  createTestCustomer,
  cleanupTenant,
} from './helpers/setup'
import { db } from '../lib/db'

// Attack vectors under test:
// 1. Cross-slug: Tenant A's JWT → Tenant B's URL slug → 403 (requireTenantAccess)
// 2. Cross-resource: Tenant A's JWT on A's URL → Tenant B's resource ID → 404 (DB tenantId filter)

describe('Tenant Isolation', () => {
  const app = createApp({ rateLimitMax: 1000 })
  const request = supertest(app)

  let tenantA: Awaited<ReturnType<typeof createTestTenant>>
  let tenantB: Awaited<ReturnType<typeof createTestTenant>>
  let ownerA: Awaited<ReturnType<typeof createTestOwner>>
  let ownerB: Awaited<ReturnType<typeof createTestOwner>>
  let serviceB: Awaited<ReturnType<typeof createTestService>>
  let customerB: Awaited<ReturnType<typeof createTestCustomer>>
  let staffBId: string

  beforeAll(async () => {
    const suffixA = uniqueSuffix()
    const suffixB = uniqueSuffix()

    tenantA = await createTestTenant(suffixA)
    tenantB = await createTestTenant(suffixB)

    ownerA = await createTestOwner(tenantA.id, tenantA.slug, suffixA)
    ownerB = await createTestOwner(tenantB.id, tenantB.slug, suffixB)

    serviceB = await createTestService(tenantB.id, suffixB)
    customerB = await createTestCustomer(tenantB.id, `+905559${suffixB.slice(0, 6)}`, suffixB)

    // Create a staff profile for tenant B
    const pwHash = '$2a$10$somehashedpassword1234567890123456789012'
    const staffUser = await db.user.create({
      data: {
        tenantId: tenantB.id,
        email: `staff-b-${suffixB}@test.local`,
        passwordHash: pwHash,
        fullName: `Staff B ${suffixB}`,
        role: 'staff',
        isActive: true,
      },
    })
    const staffProfile = await db.staffProfile.create({
      data: { userId: staffUser.id, tenantId: tenantB.id, title: 'Uzman', colorCode: 1 },
    })
    staffBId = staffProfile.id
  })

  afterAll(async () => {
    await cleanupTenant(tenantA.id)
    await cleanupTenant(tenantB.id)
  })

  // ── Attack vector 1: Cross-slug (Tenant A JWT → Tenant B URL) ─────────────────

  it('GET appointments cross-slug → 403', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantB.slug}/appointments`)
      .set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(403)
  })

  it('GET customers cross-slug → 403', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantB.slug}/customers`)
      .set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(403)
  })

  it('GET services cross-slug → 403', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantB.slug}/services`)
      .set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(403)
  })

  it('GET staff cross-slug → 403', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantB.slug}/staff`)
      .set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(403)
  })

  it('GET dashboard cross-slug → 403', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantB.slug}/dashboard`)
      .set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(403)
  })

  it('GET reports/daily cross-slug → 403', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantB.slug}/reports/daily`)
      .set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(403)
  })

  it('POST finance/close-day cross-slug → 403', async () => {
    const res = await request
      .post(`/api/v1/tenants/${tenantB.slug}/finance/close-day`)
      .set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(403)
  })

  it('POST appointments cross-slug → 403', async () => {
    const res = await request
      .post(`/api/v1/tenants/${tenantB.slug}/appointments`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ customerId: customerB.id, serviceId: serviceB.id, staffId: staffBId, startAt: new Date().toISOString() })
    expect(res.status).toBe(403)
  })

  it('GET customers/:id cross-slug → 403', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantB.slug}/customers/${customerB.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(403)
  })

  // ── Attack vector 2: Valid slug, wrong tenant's resource ID ──────────────────

  it('GET customers/:id — B resource via A JWT on A slug → 404', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantA.slug}/customers/${customerB.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(404)
  })

  it('PATCH services/:id — B service via A JWT on A slug → 404', async () => {
    const res = await request
      .patch(`/api/v1/tenants/${tenantA.slug}/services/${serviceB.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Hacked' })
    expect(res.status).toBe(404)
  })

  it('DELETE services/:id — B service via A JWT on A slug → 404', async () => {
    const res = await request
      .delete(`/api/v1/tenants/${tenantA.slug}/services/${serviceB.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(404)
  })

  it('GET staff/:id/services — B staff via A JWT on A slug → empty list (not 403)', async () => {
    // staffServiceAssignment query is filtered by tenantId, so no data leaks
    const res = await request
      .get(`/api/v1/tenants/${tenantA.slug}/staff/${staffBId}/services`)
      .set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  // ── No token → 401 ────────────────────────────────────────────────────────────

  it('GET appointments without token → 401', async () => {
    const res = await request.get(`/api/v1/tenants/${tenantA.slug}/appointments`)
    expect(res.status).toBe(401)
  })

  it('GET customers without token → 401', async () => {
    const res = await request.get(`/api/v1/tenants/${tenantA.slug}/customers`)
    expect(res.status).toBe(401)
  })
})
