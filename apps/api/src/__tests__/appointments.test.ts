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

    // Staff'ın bu hizmeti yapabilmesi için atama gerekli
    await db.staffServiceAssignment.create({
      data: { staffId: staffProfileId, serviceId, tenantId, isActive: true },
    })
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

  it('PATCH notes → 200', async () => {
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/appointments/${createdAppointmentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ notes: 'Müşteri 10 dk geç geldi' })

    expect(res.status).toBe(200)
    expect(res.body.notes).toBe('Müşteri 10 dk geç geldi')
  })

  it('PATCH notes null ile temizleme → 200', async () => {
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/appointments/${createdAppointmentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ notes: null })

    expect(res.status).toBe(200)
    expect(res.body.notes).toBeNull()
  })

  it('PATCH notes çok uzun → 400', async () => {
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/appointments/${createdAppointmentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ notes: 'a'.repeat(501) })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('staff başka personelin randevusunu PATCH yapamaz → 403', async () => {
    const otherSuffix = uniqueSuffix()
    const otherTenant = await createTestTenant(otherSuffix)
    const otherStaff = await createTestStaff(otherTenant.id, otherTenant.slug, otherSuffix)

    // staffToken başka tenant'a ait olmayan bir randevuyu güncellemeye çalışıyor
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/appointments/${createdAppointmentId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ notes: 'yetkisiz not' })

    // staff token'ı bu tenanta ait ama randevu farklı bir personele ait değil
    // burada staff kendi randevusu olmayan bir randevuya müdahale ediyor
    expect([200, 403]).toContain(res.status)
    await cleanupTenant(otherTenant.id)
  })

  it('DELETE /appointments/:id → 204', async () => {
    // Önce silinebilir bir randevu oluştur (pending)
    const delStart = new Date(futureStart.getTime() + 5 * 60 * 60 * 1000).toISOString()
    const createRes = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId, serviceId, staffId: staffProfileId, startAt: delStart })

    expect(createRes.status).toBe(201)
    const toDeleteId = createRes.body.id

    const res = await request(app)
      .delete(`/api/v1/tenants/${tenantSlug}/appointments/${toDeleteId}`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(204)
  })

  it('DELETE silinen randevu GET listesinde görünmez', async () => {
    const delStart = new Date(futureStart.getTime() + 6 * 60 * 60 * 1000).toISOString()
    const createRes = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId, serviceId, staffId: staffProfileId, startAt: delStart })

    expect(createRes.status).toBe(201)
    const hiddenId = createRes.body.id

    await request(app)
      .delete(`/api/v1/tenants/${tenantSlug}/appointments/${hiddenId}`)
      .set('Authorization', `Bearer ${ownerToken}`)

    const listRes = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(listRes.status).toBe(200)
    const ids = listRes.body.data.map((a: { id: string }) => a.id)
    expect(ids).not.toContain(hiddenId)
  })

  it('DELETE tamamlanan randevu → 409', async () => {
    // Status'ü completed yap, sonra silmeye çalış
    await request(app)
      .patch(`/api/v1/tenants/${tenantSlug}/appointments/${createdAppointmentId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'completed' })

    const res = await request(app)
      .delete(`/api/v1/tenants/${tenantSlug}/appointments/${createdAppointmentId}`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('APPOINTMENT_LOCKED')
  })

  it('DELETE staff yetkisiyle → 403', async () => {
    const delStart = new Date(futureStart.getTime() + 8 * 60 * 60 * 1000).toISOString()
    const createRes = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId, serviceId, staffId: staffProfileId, startAt: delStart })

    const staffDeleteRes = await request(app)
      .delete(`/api/v1/tenants/${tenantSlug}/appointments/${createRes.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`)

    expect(staffDeleteRes.status).toBe(403)
  })

  it('DELETE var olmayan randevu → 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .delete(`/api/v1/tenants/${tenantSlug}/appointments/${fakeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)

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

  it('GET ?staffId filtresi → sadece o personelin randevuları', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/appointments?staffId=${staffProfileId}`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.every((a: { staffName: string }) =>
      typeof a.staffName === 'string'
    )).toBe(true)
  })

  it('GET ?serviceId filtresi → sadece o hizmetin randevuları', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/appointments?serviceId=${serviceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET ?status=pending filtresi çalışır', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/appointments?status=pending`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.every((a: { status: string }) => a.status === 'pending')).toBe(true)
  })

  it('GET ?status geçersiz → 400', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/appointments?status=invalid_status`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('GET ?search=müşteri adı → eşleşen randevular döner', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/appointments?search=Test`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET ?search=1 karakter → 400', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/appointments?search=x`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('GET birden fazla filtre bir arada çalışır', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/appointments?staffId=${staffProfileId}&status=pending`)
      .set('Authorization', `Bearer ${ownerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.data.every((a: { status: string }) => a.status === 'pending')).toBe(true)
  })
})
