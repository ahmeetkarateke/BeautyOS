import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { createApp } from '../app'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestService,
  createTestStaff,
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

  // ── Attack vector 3: A'nın geçerli oturumu + gövdede/yolda B'nin kimlikleri (K2-H1 ve aynı sınıf) ──
  // Her testte A kendi geçerli kaynaklarını kullanır, YALNIZ bir kimlik B'ye aittir (tek kural bozulur);
  // beklenen: 404 ve hiçbir kayıt oluşmaz/değişmez. Önkoşul: B'nin kaynakları B'de gerçekten görünür.
  describe('cross-tenant ids in body/path', () => {
    let serviceA: Awaited<ReturnType<typeof createTestService>>
    let staffA: Awaited<ReturnType<typeof createTestStaff>>
    let customerA: Awaited<ReturnType<typeof createTestCustomer>>
    let apptBId: string
    const startAt = () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()

    beforeAll(async () => {
      const s = uniqueSuffix()
      serviceA = await createTestService(tenantA.id, s)
      staffA = await createTestStaff(tenantA.id, tenantA.slug, s)
      customerA = await createTestCustomer(tenantA.id, `+905558${s.slice(0, 6)}`, s)
      await db.staffServiceAssignment.create({
        data: { staffId: staffA.profile.id, serviceId: serviceA.id, tenantId: tenantA.id, isActive: true },
      })
      await db.staffServiceAssignment.create({
        data: { staffId: staffBId, serviceId: serviceB.id, tenantId: tenantB.id, isActive: true, commissionValue: 5 },
      })
      const b = await request
        .post(`/api/v1/tenants/${tenantB.slug}/appointments`)
        .set('Authorization', `Bearer ${ownerB.token}`)
        .send({ customerId: customerB.id, serviceId: serviceB.id, staffId: staffBId, startAt: startAt() })
      expect(b.status).toBe(201)
      apptBId = b.body.id
    })

    it("B's customerId on A slug with A's valid service+staff → 404, nothing written (K2-H1)", async () => {
      const bView = await request
        .get(`/api/v1/tenants/${tenantB.slug}/customers/${customerB.id}`)
        .set('Authorization', `Bearer ${ownerB.token}`)
      expect(bView.status).toBe(200)

      const res = await request
        .post(`/api/v1/tenants/${tenantA.slug}/appointments`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ customerId: customerB.id, serviceId: serviceA.id, staffId: staffA.profile.id, startAt: startAt() })
      expect(res.status).toBe(404)
      expect(res.body.error.message).toBe('Müşteri bulunamadı.')
      expect(await db.appointment.count({ where: { tenantId: tenantA.id } })).toBe(0)
      expect(await db.appointment.count({ where: { customerId: customerB.id } })).toBe(1) // yalnız B'nin kendi randevusu
    })

    it("POST staff/:staffId/services — B's staff with A's service → 404, no assignment", async () => {
      const res = await request
        .post(`/api/v1/tenants/${tenantA.slug}/staff/${staffBId}/services`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ serviceId: serviceA.id })
      expect(res.status).toBe(404)
      expect(await db.staffServiceAssignment.count({ where: { staffId: staffBId, tenantId: tenantA.id } })).toBe(0)
    })

    it("POST staff/:staffId/services — A's staff with B's service → 404, existing B assignment untouched", async () => {
      const res = await request
        .post(`/api/v1/tenants/${tenantA.slug}/staff/${staffA.profile.id}/services`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ serviceId: serviceB.id, commissionValue: 99 })
      expect(res.status).toBe(404)
      expect(await db.staffServiceAssignment.count({ where: { serviceId: serviceB.id, tenantId: tenantA.id } })).toBe(0)
    })

    it("POST staff/:staffId/services — B's staff AND B's service (both foreign) → 404, B's commission untouched", async () => {
      const res = await request
        .post(`/api/v1/tenants/${tenantA.slug}/staff/${staffBId}/services`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ serviceId: serviceB.id, commissionValue: 99 })
      expect(res.status).toBe(404)
      const b = await db.staffServiceAssignment.findFirst({ where: { staffId: staffBId, serviceId: serviceB.id } })
      expect(Number(b!.commissionValue)).toBe(5)
    })

    it("POST staff/:staffId/leaves — B's staff on A slug → 404, no leave", async () => {
      const res = await request
        .post(`/api/v1/tenants/${tenantA.slug}/staff/${staffBId}/leaves`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ leaveDate: '2026-12-01' })
      expect(res.status).toBe(404)
      expect(await db.staffLeave.count({ where: { staffId: staffBId } })).toBe(0)
    })

    it('POST waitlist — B customerId / B service / B staff each → 404, nothing created', async () => {
      const base = { customerId: customerA.id, serviceId: serviceA.id, staffId: staffA.profile.id }
      for (const bozuk of [{ customerId: customerB.id }, { serviceId: serviceB.id }, { staffId: staffBId }]) {
        const res = await request
          .post(`/api/v1/tenants/${tenantA.slug}/waitlist`)
          .set('Authorization', `Bearer ${ownerA.token}`)
          .send({ ...base, ...bozuk })
        expect(res.status).toBe(404)
      }
      expect(await db.waitlist.count({ where: { tenantId: tenantA.id } })).toBe(0)
    })

    it('PATCH waitlist/:id — B service / B staff each → 404, entry unchanged', async () => {
      const created = await request
        .post(`/api/v1/tenants/${tenantA.slug}/waitlist`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ customerId: customerA.id, serviceId: serviceA.id, staffId: staffA.profile.id })
      expect(created.status).toBe(201)
      const id = created.body.id as string
      for (const bozuk of [{ serviceId: serviceB.id }, { staffId: staffBId }]) {
        const res = await request
          .patch(`/api/v1/tenants/${tenantA.slug}/waitlist/${id}`)
          .set('Authorization', `Bearer ${ownerA.token}`)
          .send(bozuk)
        expect(res.status).toBe(404)
      }
      const row = await db.waitlist.findUnique({ where: { id } })
      expect(row!.serviceId).toBe(serviceA.id)
      expect(row!.staffId).toBe(staffA.profile.id)
    })

    it("POST customer-packages/:id/use — B's appointmentId → 404, no usage, no session consumed", async () => {
      const pkg = await request
        .post(`/api/v1/tenants/${tenantA.slug}/packages`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ serviceId: serviceA.id, name: 'Test Paket', totalSessions: 3, price: 300 })
      expect(pkg.status).toBe(201)
      const sold = await request
        .post(`/api/v1/tenants/${tenantA.slug}/customer-packages`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ customerId: customerA.id, packageId: pkg.body.id })
      expect(sold.status).toBe(201)
      const cpId = sold.body.id as string
      const res = await request
        .post(`/api/v1/tenants/${tenantA.slug}/customer-packages/${cpId}/use`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ appointmentId: apptBId })
      expect(res.status).toBe(404)
      expect(await db.packageUsage.count({ where: { customerPackageId: cpId } })).toBe(0)
      const cp = await db.customerPackage.findUnique({ where: { id: cpId } })
      expect(cp!.remainingSessions).toBe(3)
    })
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
