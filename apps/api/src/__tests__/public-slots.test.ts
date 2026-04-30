import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import {
  uniqueSuffix,
  createTestTenant,
  createTestStaff,
  createTestService,
  createTestCustomer,
  cleanupTenant,
} from './helpers/setup'

const app = createApp({ rateLimitMax: 1000 })

// Gelecekteki bir pazartesi tarihi bul (personeL mesaisi olan gün)
function nextMonday(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  // 1 = monday
  const daysUntilMonday = (8 - d.getUTCDay()) % 7 || 7
  d.setUTCDate(d.getUTCDate() + daysUntilMonday)
  return d.toISOString().slice(0, 10)
}

describe('Public Slots & Services endpointleri', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let tenantSlug: string
  let serviceId: string
  let staffProfileId: string
  let customerId: string
  const testDate = nextMonday()

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    tenantSlug = tenant.slug

    const service = await createTestService(tenantId, suffix)
    serviceId = service.id

    // isOnlineBookable varsayılan true olarak oluşturuluyor
    // eğer değilse güncelle
    await db.service.update({ where: { id: serviceId }, data: { isOnlineBookable: true } })

    const staff = await createTestStaff(tenantId, tenantSlug, suffix)
    staffProfileId = staff.profile.id

    // Staff için pazartesi mesaisi ayarla
    await db.staffProfile.update({
      where: { id: staffProfileId },
      data: {
        workingHours: {
          monday: { start: '09:00', end: '18:00' },
          tuesday: { start: '09:00', end: '18:00' },
          wednesday: { start: '09:00', end: '18:00' },
          thursday: { start: '09:00', end: '18:00' },
          friday: { start: '09:00', end: '18:00' },
          saturday: null,
          sunday: null,
        },
      },
    })

    // Staff'a service assignment ekle
    await db.staffServiceAssignment.create({
      data: { staffId: staffProfileId, serviceId, tenantId, isActive: true },
    })

    const customer = await createTestCustomer(
      tenantId,
      `+905556${suffix.replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
      suffix,
    )
    customerId = customer.id
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  // ─── /public/services ─────────────────────────────────────────────────────────

  it('GET /public/services → 200 ve liste döner', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/public/services`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data[0]).toHaveProperty('id')
    expect(res.body.data[0]).toHaveProperty('durationMinutes')
    expect(res.body.data[0]).toHaveProperty('price')
  })

  it('GET /public/services auth header olmadan → 200 (public)', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/public/services`)
    // Auth header yok, yine de 200
    expect(res.status).toBe(200)
  })

  it('GET /public/services var olmayan slug → 404', async () => {
    const res = await request(app)
      .get('/api/v1/tenants/zzz-no-salon-zzz/public/services')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  // ─── /public/slots ────────────────────────────────────────────────────────────

  it('GET /public/slots zorunlu param eksik → 400', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/public/slots?serviceId=${serviceId}&date=${testDate}`)
    // staffId eksik

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('GET /public/slots geçersiz uuid → 400', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/public/slots?serviceId=not-a-uuid&staffId=${staffProfileId}&date=${testDate}`)

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('GET /public/slots geçerli istek → 200 ve slot listesi', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/public/slots?serviceId=${serviceId}&staffId=${staffProfileId}&date=${testDate}`)

    expect(res.status).toBe(200)
    expect(res.body.date).toBe(testDate)
    expect(Array.isArray(res.body.slots)).toBe(true)
    expect(res.body.slots.length).toBeGreaterThan(0)
  })

  it('slot nesneleri id, label ve available içerir', async () => {
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/public/slots?serviceId=${serviceId}&staffId=${staffProfileId}&date=${testDate}`)

    expect(res.status).toBe(200)
    const slot = res.body.slots[0]
    expect(slot).toHaveProperty('id')
    expect(slot).toHaveProperty('label')
    expect(slot).toHaveProperty('available')
    expect(typeof slot.available).toBe('boolean')
    // label HH:MM formatında
    expect(slot.label).toMatch(/^\d{2}:\d{2}$/)
  })

  it('var olmayan serviceId → 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/public/slots?serviceId=${fakeId}&staffId=${staffProfileId}&date=${testDate}`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('var olmayan staffId → 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/public/slots?serviceId=${serviceId}&staffId=${fakeId}&date=${testDate}`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('personel izinli olduğunda boş slot listesi döner', async () => {
    // O gün için izin ekle
    await db.staffLeave.create({
      data: {
        staffId: staffProfileId,
        tenantId,
        leaveDate: new Date(`${testDate}T00:00:00Z`),
        leaveType: 'day_off',
      },
    })

    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/public/slots?serviceId=${serviceId}&staffId=${staffProfileId}&date=${testDate}`)

    expect(res.status).toBe(200)
    expect(res.body.slots).toHaveLength(0)

    // İzni temizle
    await db.staffLeave.deleteMany({ where: { staffId: staffProfileId, tenantId } })
  })

  it('çakışan randevu olan slot available: false döner', async () => {
    // Randevu slotları: mesai 09:00-18:00 TR, ilk slot 09:00 TR = 06:00 UTC
    const slotStartUTC = new Date(`${testDate}T06:00:00Z`)
    const slotEndUTC = new Date(slotStartUTC.getTime() + 60 * 60 * 1000) // service is 60 min

    await db.appointment.create({
      data: {
        tenantId,
        customerId,
        staffId: staffProfileId,
        serviceId,
        startAt: slotStartUTC,
        endAt: slotEndUTC,
        status: 'confirmed',
        bookingChannel: 'manual',
        referenceCode: `TEST-${suffix}`,
        priceCharged: 150,
      },
    })

    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/public/slots?serviceId=${serviceId}&staffId=${staffProfileId}&date=${testDate}`)

    expect(res.status).toBe(200)
    // 09:00 slotu (id = testDateT06:00:00) available: false olmalı
    const nineAmSlot = res.body.slots.find((s: { id: string }) => s.id.includes('T06:00:00'))
    expect(nineAmSlot).toBeDefined()
    expect(nineAmSlot.available).toBe(false)

    // Diğer slotlar hala müsait
    const otherAvailable = res.body.slots.filter((s: { available: boolean; id: string }) =>
      s.available && !s.id.includes('T06:00:00')
    )
    expect(otherAvailable.length).toBeGreaterThan(0)
  })

  it('mesai olmayan günde (Pazar) boş slot listesi döner', async () => {
    // Pazar = UTC gün 0; sonraki pazar bul
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    const daysUntilSunday = (7 - d.getUTCDay()) % 7 || 7
    d.setUTCDate(d.getUTCDate() + daysUntilSunday)
    const sunday = d.toISOString().slice(0, 10)

    const res = await request(app)
      .get(`/api/v1/tenants/${tenantSlug}/public/slots?serviceId=${serviceId}&staffId=${staffProfileId}&date=${sunday}`)

    expect(res.status).toBe(200)
    expect(res.body.slots).toHaveLength(0)
  })
})
