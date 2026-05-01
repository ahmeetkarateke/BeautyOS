import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import { createTestTenant, createTestOwner, cleanupTenant, uniqueSuffix } from './helpers/setup'

process.env.ADMIN_SEED_SECRET = 'test-admin-seed-secret'

const app = createApp({ rateLimitMax: 1000 })

const ADMIN_EMAIL = 'superadmin-test@test.local'
const ADMIN_PASS = 'AdminPass12!'

describe('Admin API', () => {
  let adminToken: string
  let tenantId: string
  let tenantSlug: string
  let ownerToken: string

  beforeAll(async () => {
    // Seed superadmin
    const seedRes = await request(app).post('/api/v1/admin/seed').send({
      secret: 'test-admin-seed-secret',
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
    })
    expect(seedRes.status).toBe(201)

    // Login as superadmin
    const loginRes = await request(app).post('/api/v1/auth/admin-login').send({
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
    })
    expect(loginRes.status).toBe(200)
    adminToken = loginRes.body.token

    // Create a test tenant + owner for isolation tests
    const suffix = uniqueSuffix()
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    tenantSlug = tenant.slug
    const { token } = await createTestOwner(tenantId, tenantSlug, suffix)
    ownerToken = token
  })

  afterAll(async () => {
    await db.user.deleteMany({ where: { role: 'superadmin' } })
    await cleanupTenant(tenantId)
  })

  // ─── Seed ─────────────────────────────────────────────────────────────────────

  it('seed tekrar → 409 ADMIN_EXISTS', async () => {
    const res = await request(app).post('/api/v1/admin/seed').send({
      secret: 'test-admin-seed-secret',
      email: 'another-admin@test.local',
      password: 'AdminPass12!',
    })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ADMIN_EXISTS')
  })

  it('yanlış secret → 403', async () => {
    const res = await request(app).post('/api/v1/admin/seed').send({
      secret: 'wrong-secret',
      email: 'x@test.local',
      password: 'AdminPass12!',
    })
    expect(res.status).toBe(403)
  })

  // ─── Admin Login ──────────────────────────────────────────────────────────────

  it('admin-login yanlış şifre → 401', async () => {
    const res = await request(app).post('/api/v1/auth/admin-login').send({
      email: ADMIN_EMAIL,
      password: 'wrongpass',
    })
    expect(res.status).toBe(401)
  })

  it('admin-login normal user ile → 401', async () => {
    const suffix = uniqueSuffix()
    await request(app).post('/api/v1/auth/register').send({
      salonName: `Test ${suffix}`,
      slug: `adm-${suffix.replace(/\W/g, '').slice(0, 8)}`,
      ownerFullName: 'Owner',
      email: `adm-owner-${suffix}@test.local`,
      password: 'Secure123!',
    })
    const res = await request(app).post('/api/v1/auth/admin-login').send({
      email: `adm-owner-${suffix}@test.local`,
      password: 'Secure123!',
    })
    expect(res.status).toBe(401)
    // Cleanup
    const t = await db.tenant.findFirst({ where: { slug: { startsWith: `adm-${suffix.replace(/\W/g, '').slice(0, 8)}` } }, select: { id: true } })
    if (t) await cleanupTenant(t.id)
  })

  // ─── Access control ───────────────────────────────────────────────────────────

  it('token olmadan GET /admin/tenants → 401', async () => {
    const res = await request(app).get('/api/v1/admin/tenants')
    expect(res.status).toBe(401)
  })

  it('tenant owner token ile GET /admin/tenants → 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  // ─── GET /admin/tenants ───────────────────────────────────────────────────────

  it('admin token ile GET /admin/tenants → 200 + dizi', async () => {
    const res = await request(app)
      .get('/api/v1/admin/tenants')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.tenants)).toBe(true)
    expect(res.body.tenants.length).toBeGreaterThan(0)
    const t = res.body.tenants[0]
    expect(t).toHaveProperty('id')
    expect(t).toHaveProperty('_count')
  })

  it('?search filtresi çalışıyor', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/tenants?search=tst-${tenantSlug.slice(4)}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.tenants.some((t: { id: string }) => t.id === tenantId)).toBe(true)
  })

  it('?isActive=false filtresi', async () => {
    const res = await request(app)
      .get('/api/v1/admin/tenants?isActive=false')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    res.body.tenants.forEach((t: { isActive: boolean }) => {
      expect(t.isActive).toBe(false)
    })
  })

  // ─── GET /admin/tenants/:tenantId ─────────────────────────────────────────────

  it('tenant detayı döner', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.tenant.id).toBe(tenantId)
    expect(res.body.activity).toHaveProperty('totalAppointments')
    expect(res.body.activity).toHaveProperty('totalRevenue')
  })

  it('olmayan tenantId → 404', async () => {
    const res = await request(app)
      .get('/api/v1/admin/tenants/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  // ─── PATCH /admin/tenants/:tenantId ──────────────────────────────────────────

  it('isActive toggle → 200', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
    expect(res.status).toBe(200)
    expect(res.body.tenant.isActive).toBe(false)

    // Re-enable
    const res2 = await request(app)
      .patch(`/api/v1/admin/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
    expect(res2.status).toBe(200)
    expect(res2.body.tenant.isActive).toBe(true)
  })

  it('plan değiştirme → 200', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'starter' })
    expect(res.status).toBe(200)
    expect(res.body.tenant.plan).toBe('starter')
  })

  it('geçersiz plan → 400', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'invalid_plan' })
    expect(res.status).toBe(400)
  })

  // ─── GET /admin/stats ─────────────────────────────────────────────────────────

  it('stats döner', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    const { stats } = res.body
    expect(stats).toHaveProperty('totalTenants')
    expect(stats).toHaveProperty('activeTenants')
    expect(stats).toHaveProperty('trialTenants')
    expect(stats).toHaveProperty('expiredTenants')
    expect(stats).toHaveProperty('recentRegistrations')
    expect(stats.totalTenants).toBeGreaterThan(0)
  })
})
