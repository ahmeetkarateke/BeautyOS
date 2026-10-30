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

// ADR-0041 (R3 uzman tasima) riskleri, gercek PG: uzman kendi staffId'siyle 200; baska kiracinin personeli ve
// hizmete atanmis ama pasif personel 400 STAFF_NOT_ASSIGNABLE; baska kiracidaki kayit degismez.
const app = createApp({ rateLimitMax: 1000 })

describe('ADR-0041: reschedule staffId kurallari (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenant: { id: string; slug: string }
  let other: { id: string; slug: string }
  let owner: string
  let me: Awaited<ReturnType<typeof createTestStaff>>
  let inactive: Awaited<ReturnType<typeof createTestStaff>>
  let foreign: Awaited<ReturnType<typeof createTestStaff>>
  let apptId: string
  let foreignApptId: string
  const startAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString()

  const assign = (tenantId: string, staffId: string, serviceId: string, isActive: boolean) =>
    db.staffServiceAssignment.create({ data: { tenantId, staffId, serviceId, isActive } })
  const patch = (slug: string, id: string, token: string, body: object) =>
    request(app).patch(`/api/v1/tenants/${slug}/appointments/${id}/reschedule`).set('Authorization', `Bearer ${token}`).send(body)

  beforeAll(async () => {
    tenant = await createTestTenant(suffix)
    other = await createTestTenant(`${suffix}x`)
    owner = (await createTestOwner(tenant.id, tenant.slug, suffix)).token
    me = await createTestStaff(tenant.id, tenant.slug, suffix)
    inactive = await createTestStaff(tenant.id, tenant.slug, `${suffix}i`)
    foreign = await createTestStaff(other.id, other.slug, `${suffix}x`)
    const service = await createTestService(tenant.id, suffix)
    const foreignService = await createTestService(other.id, `${suffix}x`)
    await assign(tenant.id, me.profile.id, service.id, true)
    await assign(tenant.id, inactive.profile.id, service.id, false)
    await assign(other.id, foreign.profile.id, foreignService.id, true)
    const customer = await db.customer.create({ data: { tenantId: tenant.id, fullName: 'Tasima Musteri', phone: '+905329990002' } })
    const mk = (tenantId: string, customerId: string | null, staffId: string, serviceId: string, hourOffset: number) =>
      db.appointment.create({
        data: {
          tenantId, customerId, staffId, serviceId,
          requestedName: customerId ? null : 'x', requestedPhone: customerId ? null : '+905329990003',
          referenceCode: `T-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
          startAt: new Date(Date.now() + hourOffset * 3600 * 1000), endAt: new Date(Date.now() + (hourOffset + 1) * 3600 * 1000),
          priceCharged: 300, status: 'confirmed',
        },
      })
    apptId = (await mk(tenant.id, customer.id, me.profile.id, service.id, 24)).id
    const foreignCustomer = await db.customer.create({ data: { tenantId: other.id, fullName: 'B Musteri', phone: '+905329990004' } })
    foreignApptId = (await mk(other.id, foreignCustomer.id, foreign.profile.id, foreignService.id, 24)).id
  })

  afterAll(async () => {
    await cleanupTenant(tenant.id)
    await cleanupTenant(other.id)
  })

  it('(1) uzman govdeye kendi staffId sini koyarsa 200 doner (saat degisimi), baska uzmana tasima 403', async () => {
    const same = await patch(tenant.slug, apptId, me.token, { startAt, staffId: me.profile.id })
    expect(same.status).toBe(200)
    const moved = await patch(tenant.slug, apptId, me.token, { startAt, staffId: inactive.profile.id })
    expect(moved.status).toBe(403)
    expect((await db.appointment.findFirstOrThrow({ where: { id: apptId } })).staffId).toBe(me.profile.id)
  })

  it('(2) baska kiracinin personel kimligiyle tasima 400 STAFF_NOT_ASSIGNABLE; B de kayit var ve degismez', async () => {
    // Veri gercekten var: B personeli B de bulunur.
    expect(await db.staffProfile.count({ where: { id: foreign.profile.id, tenantId: other.id } })).toBe(1)
    const res = await patch(tenant.slug, apptId, owner, { startAt, staffId: foreign.profile.id })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('STAFF_NOT_ASSIGNABLE')
    expect((await db.appointment.findFirstOrThrow({ where: { id: apptId } })).staffId).toBe(me.profile.id)
    expect((await db.appointment.findFirstOrThrow({ where: { id: foreignApptId } })).staffId).toBe(foreign.profile.id)
  })

  it('(3) hizmete atanmis ama isActive=false personele tasima 400', async () => {
    expect(await db.staffServiceAssignment.count({ where: { tenantId: tenant.id, staffId: inactive.profile.id, isActive: false } })).toBe(1)
    const res = await patch(tenant.slug, apptId, owner, { startAt, staffId: inactive.profile.id })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('STAFF_NOT_ASSIGNABLE')
    expect((await db.appointment.findFirstOrThrow({ where: { id: apptId } })).staffId).toBe(me.profile.id)
  })
})
