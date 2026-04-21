import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestStaff,
  createTestService,
  createTestCustomer,
  cleanupTenant,
} from './helpers/setup'

const app = createApp({ rateLimitMax: 1000 })

describe('Randevu endpointleri', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let tenantSlug: string
  let ownerToken: string
  let staffToken: string
  let customerId: string
  let serviceId: string
  let staffProfileId: string
  let createdAppointmentId: string

  const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  futureStart.setMinutes(0, 0, 0)
  const startAt = futureStart.toISOString()

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    tenantSlug = tenant.slug

    const owner = await createTestOwner(tenantId, tenantSlug, suffix)
    ownerToken = owner.token

    const staff = await createTestStaff(tenantId, tenantSlug, suffix)
    staffToken = staff.token
    staffProfileId = staff.profile.id

    const service = await createTestService(tenantId, suffix)
    serviceId = service.id

    const customer = await createTestCustomer(tenantId, `+905551${suffix.slice(0, 7).replace(/\D/g, '').padEnd(7, '1')}`, suffix)
    customerId = customer.id
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  it('auth olmadan GET → 401', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/appointments`)

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('geçerli body ile POST → 201 + referenceCode', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId, serviceId, staffId: staffProfileId, startAt })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('referenceCode')
    expect(res.body.referenceCode).toMatch(/^APT-/)
    expect(res.body).toHaveProperty('id')
    expect(res.body.status).toBe('pending')
    createdAppointmentId = res.body.id
  })

  it('çakışan slot → 409 APPOINTMENT_CONFLICT', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId, serviceId, staffId: staffProfileId, startAt })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('APPOINTMENT_CONFLICT')
  })

  it('geçersiz body → 400', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId, serviceId })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('staff yetkisiyle randevu oluşturma → 201 (staff oluşturabilir)', async () => {
    const laterStart = new Date(futureStart.getTime() + 2 * 60 * 60 * 1000).toISOString()
    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ customerId, serviceId, staffId: staffProfileId, startAt: laterStart })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('referenceCode')
  })

  it('PATCH status → 200', async () => {
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/appointments/${createdAppointmentId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'confirmed' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('confirmed')
  })

  it('PATCH geçersiz status → 400', async () => {
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/appointments/${createdAppointmentId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'invalid_status' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('var olmayan randevu PATCH → 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/appointments/${fakeId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'confirmed' })

    expect(res.status).toBe(404)
  })

  it('başka tenant token ile erişim → 403', async () => {
    const otherSuffix = uniqueSuffix()
    const otherTenant = await createTestTenant(otherSuffix)
    const other = await createTestOwner(otherTenant.id, otherTenant.slug, otherSuffix)

    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${other.token}`)

    expect(res.status).toBe(403)
    await cleanupTenant(otherTenant.id)
  })
})
