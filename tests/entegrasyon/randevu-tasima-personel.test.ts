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

// R3 (kurucu karari): randevuyu baska personele tasima (reschedule + staffId) gercek PostgreSQL'de.
// Sahte katman yok: S3 EXCLUDE kisiti hedef personelde SLOT_TAKEN vermeli. Bu dosya tests/entegrasyon altindadir;
// api-test.sh kosudan once apps/api/src/__tests__/ icine kopyalar.
const app = createApp({ rateLimitMax: 1000 })
const H = 60 * 60 * 1000

describe('R3: randevuyu baska personele tasima (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let slug: string
  let ownerToken: string
  let staffA: { id: string; token: string }
  let staffB: string
  let staffNoService: string
  let serviceId: string
  let customerId: string
  let otherTenantId: string
  let otherTenantStaff: string

  const base = new Date(Date.now() + 12 * 24 * H)
  base.setUTCMinutes(0, 0, 0)
  const at = (hours: number) => new Date(base.getTime() + hours * H)

  const create = (staffId: string, start: Date, end: Date) =>
    db.appointment.create({
      data: {
        tenantId,
        customerId,
        staffId,
        serviceId,
        referenceCode: `R-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        startAt: start,
        endAt: end,
        priceCharged: 100,
        status: 'confirmed',
      },
    })
  const move = (id: string, token: string, body: Record<string, unknown>) =>
    request(app).patch(`/api/v1/tenants/${slug}/appointments/${id}/reschedule`).set('Authorization', `Bearer ${token}`).send(body)
  const staffOf = async (id: string) => (await db.appointment.findUniqueOrThrow({ where: { id } })).staffId

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    slug = tenant.slug
    ownerToken = (await createTestOwner(tenantId, slug, suffix)).token
    const a = await createTestStaff(tenantId, slug, `${suffix}a`)
    staffA = { id: a.profile.id, token: a.token }
    staffB = (await createTestStaff(tenantId, slug, `${suffix}b`)).profile.id
    staffNoService = (await createTestStaff(tenantId, slug, `${suffix}c`)).profile.id
    serviceId = (await createTestService(tenantId, suffix)).id
    customerId = (await createTestCustomer(tenantId, `+90555${suffix.replace(/\D/g, '').padEnd(7, '3').slice(0, 7)}`, suffix)).id
    for (const staffId of [staffA.id, staffB]) {
      await db.staffServiceAssignment.create({ data: { staffId, serviceId, tenantId, isActive: true } })
    }
    const other = await createTestTenant(`${suffix}x`)
    otherTenantId = other.id
    otherTenantStaff = (await createTestStaff(otherTenantId, other.slug, `${suffix}x`)).profile.id
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
    await cleanupTenant(otherTenantId)
  })

  it('R3: sahip randevuyu bos personele tasir (staffId degisir, saat ayni)', async () => {
    const a = await create(staffA.id, at(0), at(1))
    const res = await move(a.id, ownerToken, { startAt: at(0).toISOString(), staffId: staffB })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await staffOf(a.id)).toBe(staffB)
  })

  it('R3: hedef personelde cakisma 409 SLOT_TAKEN; randevu eski personelde kalir (cakisan kayit gercekten var)', async () => {
    const blocking = await create(staffB, at(4), at(5))
    expect(blocking.staffId).toBe(staffB)
    const a = await create(staffA.id, at(4), at(5))
    const res = await move(a.id, ownerToken, { startAt: at(4).toISOString(), staffId: staffB })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SLOT_TAKEN')
    expect(await staffOf(a.id)).toBe(staffA.id)
  })

  it('R3: hedef personel hizmeti vermiyorsa 400 STAFF_NOT_ASSIGNABLE; randevu yerinde', async () => {
    const a = await create(staffA.id, at(8), at(9))
    const res = await move(a.id, ownerToken, { startAt: at(8).toISOString(), staffId: staffNoService })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('STAFF_NOT_ASSIGNABLE')
    expect(await staffOf(a.id)).toBe(staffA.id)
  })

  it('R3 izolasyon: baska kiracinin personeline tasima reddedilir (personel B kiracisinda gercekten var)', async () => {
    expect(await db.staffProfile.count({ where: { id: otherTenantStaff, tenantId: otherTenantId } })).toBe(1)
    const a = await create(staffA.id, at(12), at(13))
    const res = await move(a.id, ownerToken, { startAt: at(12).toISOString(), staffId: otherTenantStaff })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('STAFF_NOT_ASSIGNABLE')
    expect(await staffOf(a.id)).toBe(staffA.id)
  })

  it('R3 yetki: uzman kendi randevusunun saatini tasir (olumlu esleme), baska personele tasiyamaz (403, yerinde)', async () => {
    const a = await create(staffA.id, at(16), at(17))
    const own = await move(a.id, staffA.token, { startAt: at(18).toISOString() })
    expect(own.status, JSON.stringify(own.body)).toBe(200)
    expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).startAt.getTime()).toBe(at(18).getTime())
    const res = await move(a.id, staffA.token, { startAt: at(18).toISOString(), staffId: staffB })
    expect(res.status).toBe(403)
    expect(await staffOf(a.id)).toBe(staffA.id)
  })
})
