import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestCustomer,
  cleanupTenant,
} from './helpers/setup'

const app = createApp({ rateLimitMax: 1000 })

describe('Müşteri endpointleri', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let tenantSlug: string
  let ownerToken: string
  let createdCustomerId: string

  const basePhone = `+905552${suffix.replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    tenantSlug = tenant.slug
    const owner = await createTestOwner(tenantId, tenantSlug, suffix)
    ownerToken = owner.token
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  it('yeni müşteri POST → 201', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/customers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fullName: `Ayşe Yılmaz ${suffix}`, phone: basePhone })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.phone).toBe(basePhone)
    createdCustomerId = res.body.id
  })

  it('aynı telefon → 409 DUPLICATE_PHONE', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/customers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fullName: `Başka Kişi ${suffix}`, phone: basePhone })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_PHONE')
  })

  it('geçersiz body → 400', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/customers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fullName: 'A', phone: '123' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('GET /customers → 200 ve liste döner', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/customers`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)
  })

  it('GET /customers/:id → 200 ve müşteri detayı', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(createdCustomerId)
    expect(Array.isArray(res.body.appointments)).toBe(true)
  })

  it('sadece allergyNotes güncelle PATCH → 200', async () => {
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/customers/${createdCustomerId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ allergyNotes: 'Fındık alerjisi var' })

    expect(res.status).toBe(200)
    expect(res.body.allergyNotes).toBe('Fındık alerjisi var')
  })

  it('başka tenant müşterisine kendi slug ile erişim → 404 (tenant izolasyonu)', async () => {
    const otherSuffix = uniqueSuffix()
    const otherTenant = await createTestTenant(otherSuffix)
    const otherPhone = `+905553${otherSuffix.replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`
    const otherCustomer = await createTestCustomer(otherTenant.id, otherPhone, otherSuffix)

    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/customers/${otherCustomer.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(404)
    await cleanupTenant(otherTenant.id)
  })

  it('başka tenant slug ile direkt erişim → 403', async () => {
    const otherSuffix = uniqueSuffix()
    const otherTenant = await createTestTenant(otherSuffix)

    const res = await request(app)
      .get(`/api/v1/tenants/${otherTenant.slug}/customers`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(403)
    await cleanupTenant(otherTenant.id)
  })

  it('var olmayan müşteri GET → 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/customers/${fakeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(404)
  })
})
