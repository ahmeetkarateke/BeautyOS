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
import { findCustomerCandidates } from '../lib/online-booking'

// ADR-0038 (gercek PG, api-test.sh yigini): tekillik kalkti, CHECK gevsedi, onayda create aday kontrolu yapmaz.
const app = createApp({ rateLimitMax: 1000 })
const H = 60 * 60 * 1000
const SHARED_PHONE = '+905550007788'

describe('ADR-0038: ayni telefonla birden cok musteri (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let a: { id: string; slug: string }
  let b: { id: string; slug: string }
  let ownerToken: string
  let staffProfileId: string
  let serviceId: string
  let slot = 0

  beforeAll(async () => {
    a = await createTestTenant(suffix)
    b = await createTestTenant(`${suffix}b`)
    ownerToken = (await createTestOwner(a.id, a.slug, suffix)).token
    const staff = await createTestStaff(a.id, a.slug, suffix)
    staffProfileId = staff.profile.id
    serviceId = (await createTestService(a.id, suffix)).id
  })

  afterAll(async () => {
    await cleanupTenant(a.id)
    await cleanupTenant(b.id)
  })

  function requestRow(overrides: Record<string, unknown> = {}) {
    slot += 1
    const start = new Date(Date.now() + (10 + slot) * 24 * H)
    return {
      tenantId: a.id,
      customerId: null,
      requestedName: 'Talep Eden',
      requestedPhone: SHARED_PHONE,
      phoneVerified: false,
      bookingChannel: 'web' as const,
      status: 'pending' as const,
      staffId: staffProfileId,
      serviceId,
      referenceCode: `T-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      startAt: start,
      endAt: new Date(start.getTime() + H),
      priceCharged: 100,
      ...overrides,
    }
  }

  it('K-sema: ayni kiracida ayni telefonla iki musteri olusabilir (tekillik kalkti)', async () => {
    await db.customer.create({ data: { tenantId: a.id, fullName: 'Anne', phone: SHARED_PHONE } })
    await db.customer.create({ data: { tenantId: a.id, fullName: 'Kiz', phone: SHARED_PHONE } })
    expect(await db.customer.count({ where: { tenantId: a.id, phone: SHARED_PHONE } })).toBe(2)
  })

  it('K-check: musterisiz kayit ad ve telefon yoksa reddedilir; requested* doluysa phoneVerified=true olsa da kabul edilir', async () => {
    await expect(db.appointment.create({ data: requestRow({ requestedName: null, requestedPhone: null }) })).rejects.toThrow()
    const ok = await db.appointment.create({ data: requestRow({ phoneVerified: true }) })
    expect(ok.customerId).toBeNull()
  })

  it('K-onay: aday varken customerAction=create 200 verir, eski kartlar degismez ve randevu yeni karta baglanir', async () => {
    const before = await db.customer.findMany({ where: { tenantId: a.id, phone: SHARED_PHONE }, orderBy: { createdAt: 'asc' } })
    const appt = await db.appointment.create({ data: requestRow() })
    const res = await request(app)
      .patch(`/api/v1/tenants/${a.slug}/appointments/${appt.id}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerAction: 'create' })
    expect(res.status).toBe(200)
    const after = await db.customer.findMany({ where: { tenantId: a.id, phone: SHARED_PHONE }, orderBy: { createdAt: 'asc' } })
    expect(after.length).toBe(before.length + 1)
    expect(after.slice(0, before.length).map((c) => [c.id, c.fullName, c.totalVisits])).toEqual(before.map((c) => [c.id, c.fullName, c.totalVisits]))
    const row = await db.appointment.findFirstOrThrow({ where: { id: appt.id } })
    expect(row.status).toBe('confirmed')
    expect(after.map((c) => c.id)).toContain(row.customerId)
  })

  it('K-onay: eylem verilmezse aday varken eski match_required (409) korunur', async () => {
    const appt = await db.appointment.create({ data: requestRow() })
    const res = await request(app)
      .patch(`/api/v1/tenants/${a.slug}/appointments/${appt.id}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({})
    expect(res.status).toBe(409)
  })

  it('K-izolasyon: B kiracisinda ayni telefon varken A icin aday listesi bos (once B\'de var oldugu dogrulanir)', async () => {
    const phone = '+905550009900'
    await db.customer.create({ data: { tenantId: b.id, fullName: 'B Musteri', phone } })
    expect((await findCustomerCandidates(b.id, phone)).length).toBe(1)
    expect(await findCustomerCandidates(a.id, phone)).toEqual([])
  })

  it('K6: panel POST /customers ayni telefonda varsayilan 409, allowSharedPhone ile 201', async () => {
    const post = (body: object) =>
      request(app).post(`/api/v1/tenants/${a.slug}/customers`).set('Authorization', `Bearer ${ownerToken}`).send(body)
    const dup = await post({ fullName: 'Baska Kisi', phone: SHARED_PHONE })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('DUPLICATE_PHONE')
    const shared = await post({ fullName: 'Baska Kisi', phone: SHARED_PHONE, allowSharedPhone: true })
    expect(shared.status).toBe(201)
  })
})
