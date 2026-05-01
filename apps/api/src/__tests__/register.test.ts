import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import { uniqueSuffix, createTestOwner, cleanupTenant } from './helpers/setup'

const app = createApp({ rateLimitMax: 1000 })

describe('Kayıt (register) ve trial middleware', () => {
  const createdTenantIds: string[] = []

  afterEach(async () => {
    for (const id of createdTenantIds.splice(0)) {
      await cleanupTenant(id)
    }
  })

  // ─── Register ────────────────────────────────────────────────────────────────

  it('başarılı kayıt → 201, token + trialEndsAt', async () => {
    const suffix = uniqueSuffix()
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        salonName: `Test Salon ${suffix}`,
        slug: `tst-reg-${suffix.replace(/\W/g, '').slice(0, 10)}`,
        ownerFullName: `Ahmet Test ${suffix}`,
        email: `owner-reg-${suffix}@test.local`,
        password: 'Secure123!',
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
    expect(res.body).toHaveProperty('trialEndsAt')
    expect(res.body.user.role).toBe('owner')
    expect(res.body.user.email).toBe(`owner-reg-${suffix}@test.local`)

    const tenant = await db.tenant.findUnique({ where: { slug: res.body.user.tenantSlug }, select: { id: true, plan: true, trialEndsAt: true } })
    expect(tenant).not.toBeNull()
    expect(tenant!.plan).toBe('trial')
    expect(tenant!.trialEndsAt).not.toBeNull()
    createdTenantIds.push(tenant!.id)
  })

  it('duplicate slug → 409 DUPLICATE_SLUG', async () => {
    const suffix = uniqueSuffix()
    const slug = `tst-dup-${suffix.replace(/\W/g, '').slice(0, 8)}`

    const first = await request(app)
      .post('/api/v1/auth/register')
      .send({
        salonName: `Salon A ${suffix}`,
        slug,
        ownerFullName: 'Owner A',
        email: `owner-a-${suffix}@test.local`,
        password: 'Secure123!',
      })
    expect(first.status).toBe(201)
    const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } })
    if (tenant) createdTenantIds.push(tenant.id)

    const second = await request(app)
      .post('/api/v1/auth/register')
      .send({
        salonName: `Salon B ${suffix}`,
        slug,
        ownerFullName: 'Owner B',
        email: `owner-b-${suffix}@test.local`,
        password: 'Secure123!',
      })

    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('DUPLICATE_SLUG')
  })

  it('duplicate email → 409 DUPLICATE_EMAIL', async () => {
    const suffix = uniqueSuffix()
    const email = `shared-${suffix}@test.local`

    const first = await request(app)
      .post('/api/v1/auth/register')
      .send({
        salonName: `Salon X ${suffix}`,
        slug: `tst-x-${suffix.replace(/\W/g, '').slice(0, 8)}`,
        ownerFullName: 'Owner X',
        email,
        password: 'Secure123!',
      })
    expect(first.status).toBe(201)
    const tenant = await db.tenant.findUnique({ where: { slug: first.body.user.tenantSlug }, select: { id: true } })
    if (tenant) createdTenantIds.push(tenant.id)

    const second = await request(app)
      .post('/api/v1/auth/register')
      .send({
        salonName: `Salon Y ${suffix}`,
        slug: `tst-y-${suffix.replace(/\W/g, '').slice(0, 8)}`,
        ownerFullName: 'Owner Y',
        email,
        password: 'Secure123!',
      })

    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('DUPLICATE_EMAIL')
  })

  it('geçersiz slug (büyük harf) → 400 VALIDATION_ERROR', async () => {
    const suffix = uniqueSuffix()
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        salonName: 'Test',
        slug: 'INVALID-SLUG',
        ownerFullName: 'Owner',
        email: `val-${suffix}@test.local`,
        password: 'Secure123!',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('şifre çok kısa → 400 VALIDATION_ERROR', async () => {
    const suffix = uniqueSuffix()
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        salonName: 'Test',
        slug: `tst-short-${suffix.replace(/\W/g, '').slice(0, 5)}`,
        ownerFullName: 'Owner',
        email: `short-${suffix}@test.local`,
        password: '123',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  // ─── checkTenantActive middleware ─────────────────────────────────────────────

  it('aktif tenant → 200 (middleware geçiyor)', async () => {
    const suffix = uniqueSuffix()
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        salonName: `Active Salon ${suffix}`,
        slug: `tst-act-${suffix.replace(/\W/g, '').slice(0, 8)}`,
        ownerFullName: 'Owner Active',
        email: `active-${suffix}@test.local`,
        password: 'Secure123!',
      })
    expect(res.status).toBe(201)

    const token = res.body.token
    const tenantSlug = res.body.user.tenantSlug
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } })
    createdTenantIds.push(tenant!.id)

    const apiRes = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${token}`)

    expect(apiRes.status).toBe(200)
  })

  it('trial süresi dolmuş tenant → 402 SUBSCRIPTION_REQUIRED', async () => {
    const suffix = uniqueSuffix()
    const slug = `tst-exp-${suffix.replace(/\W/g, '').slice(0, 7)}`

    // Register first to get a valid tenant and token
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        salonName: `Expired Salon ${suffix}`,
        slug,
        ownerFullName: 'Owner Expired',
        email: `expired-${suffix}@test.local`,
        password: 'Secure123!',
      })
    expect(regRes.status).toBe(201)

    const token = regRes.body.token
    const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } })
    createdTenantIds.push(tenant!.id)

    // Backdate trialEndsAt to simulate expiry
    await db.tenant.update({
      where: { id: tenant!.id },
      data: { trialEndsAt: new Date('2024-01-01T00:00:00Z') },
    })

    const apiRes = await request(app)
      .get(`/api/v1/tenants/${slug}/appointments`)
      .set('Authorization', `Bearer ${token}`)

    expect(apiRes.status).toBe(402)
    expect(apiRes.body.error.code).toBe('SUBSCRIPTION_REQUIRED')
  })

  it('isActive=false tenant → 402 SUBSCRIPTION_REQUIRED', async () => {
    const suffix = uniqueSuffix()
    const slug = `tst-ina-${suffix.replace(/\W/g, '').slice(0, 7)}`

    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        salonName: `Inactive Salon ${suffix}`,
        slug,
        ownerFullName: 'Owner Inactive',
        email: `inactive-${suffix}@test.local`,
        password: 'Secure123!',
      })
    expect(regRes.status).toBe(201)

    const token = regRes.body.token
    const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } })
    createdTenantIds.push(tenant!.id)

    await db.tenant.update({ where: { id: tenant!.id }, data: { isActive: false } })

    const apiRes = await request(app)
      .get(`/api/v1/tenants/${slug}/appointments`)
      .set('Authorization', `Bearer ${token}`)

    expect(apiRes.status).toBe(402)
    expect(apiRes.body.error.code).toBe('SUBSCRIPTION_REQUIRED')
  })

  it('süresi dolmuş tenant GET /settings → 200 (exempt)', async () => {
    const suffix = uniqueSuffix()
    const slug = `tst-set-${suffix.replace(/\W/g, '').slice(0, 7)}`

    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        salonName: `Settings Salon ${suffix}`,
        slug,
        ownerFullName: 'Owner Settings',
        email: `settings-${suffix}@test.local`,
        password: 'Secure123!',
      })
    expect(regRes.status).toBe(201)

    const token = regRes.body.token
    const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } })
    createdTenantIds.push(tenant!.id)

    await db.tenant.update({ where: { id: tenant!.id }, data: { isActive: false } })

    const apiRes = await request(app)
      .get(`/api/v1/tenants/${slug}/settings`)
      .set('Authorization', `Bearer ${token}`)

    expect(apiRes.status).toBe(200)
  })
})
