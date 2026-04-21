import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestStaff,
  createTestService,
  cleanupTenant,
} from './helpers/setup'

const app = createApp({ rateLimitMax: 1000 })

describe('Hizmet endpointleri', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let tenantSlug: string
  let ownerToken: string
  let staffToken: string
  let createdServiceId: string

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    tenantSlug = tenant.slug
    const owner = await createTestOwner(tenantId, tenantSlug, suffix)
    ownerToken = owner.token
    const staff = await createTestStaff(tenantId, tenantSlug, suffix)
    staffToken = staff.token
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  it('GET /services → 200 ve liste döner', async () => {
    await createTestService(tenantId, suffix)
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/services`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('owner ile POST /services → 201', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/services`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: `Yeni Hizmet ${suffix}`, durationMinutes: 45, price: 200 })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.name).toBe(`Yeni Hizmet ${suffix}`)
    expect(res.body.isActive).toBe(true)
    createdServiceId = res.body.id
  })

  it('staff rolü ile POST /services → 403 (sadece owner/manager)', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/services`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Yetkisiz Hizmet', durationMinutes: 30, price: 100 })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('staff rolü ile PATCH /services → 403', async () => {
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/services/${createdServiceId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ price: 999 })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('PATCH /services/:id → owner ile güncelleme → 200', async () => {
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/services/${createdServiceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ price: 250, name: `Güncellendi ${suffix}` })

    expect(res.status).toBe(200)
    expect(res.body.price).toBe(250)
    expect(res.body.name).toBe(`Güncellendi ${suffix}`)
  })

  it('DELETE /services/:id → soft delete, isActive=false', async () => {
    const deleteRes = await request(app)
      .delete(`/api/v1/tenants/${tenantSlug}/services/${createdServiceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.ok).toBe(true)

    const listRes = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/services`)
      .set('Authorization', `Bearer ${ownerToken}`)

    const found = listRes.body.data.find((s: { id: string }) => s.id === createdServiceId)
    expect(found).toBeUndefined()
  })

  it('staff rolü ile DELETE /services → 403', async () => {
    const newService = await createTestService(tenantId, `del-${suffix}`)
    const res = await request(app)
      .delete(`/api/v1/tenants/${tenantSlug}/services/${newService.id}`)
      .set('Authorization', `Bearer ${staffToken}`)

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('geçersiz body ile POST → 400', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/services`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Eksik Alan' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('var olmayan servis PATCH → 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/services/${fakeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ price: 999 })

    expect(res.status).toBe(404)
  })
})
