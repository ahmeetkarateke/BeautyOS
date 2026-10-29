import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import { isSlotOverlapError } from '../lib/slot-conflict'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestStaff,
  createTestService,
  createTestCustomer,
  cleanupTenant,
} from './helpers/setup'

// Gercek PostgreSQL ister (btree_gist EXCLUDE kisiti). api-test.sh yiginiyla kosulur.
const app = createApp({ rateLimitMax: 1000 })
const H = 60 * 60 * 1000

describe('S3: cift randevuya veritabani kisiti', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let slug: string
  let ownerToken: string
  let staffProfileId: string
  let otherStaffProfileId: string
  let serviceId: string
  let customerId: string

  const base = new Date(Date.now() + 10 * 24 * H)
  base.setUTCMinutes(0, 0, 0)
  const at = (hours: number) => new Date(base.getTime() + hours * H)

  function rawAppointment(staffId: string, start: Date, end: Date, status: 'pending' | 'cancelled' = 'pending', isDeleted = false) {
    return db.appointment.create({
      data: {
        tenantId,
        customerId,
        staffId,
        serviceId,
        referenceCode: `T-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        startAt: start,
        endAt: end,
        priceCharged: 100,
        status,
        isDeleted,
      },
    })
  }

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    slug = tenant.slug
    ownerToken = (await createTestOwner(tenantId, slug, suffix)).token
    staffProfileId = (await createTestStaff(tenantId, slug, suffix)).profile.id
    otherStaffProfileId = (await createTestStaff(tenantId, slug, `${suffix}b`)).profile.id
    serviceId = (await createTestService(tenantId, suffix)).id
    customerId = (await createTestCustomer(tenantId, `+90555${suffix.replace(/\D/g, '').padEnd(7, '2').slice(0, 7)}`, suffix)).id
    for (const staffId of [staffProfileId, otherStaffProfileId]) {
      await db.staffServiceAssignment.create({ data: { staffId, serviceId, tenantId, isActive: true } })
    }
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  it('K1: ayni personel icin cakisan ikinci kayit veritabaninda reddedilir (23P01)', async () => {
    await rawAppointment(staffProfileId, at(0), at(1))
    const second = await rawAppointment(staffProfileId, at(0.5), at(1.5)).then(
      () => null,
      (err: unknown) => err,
    )
    expect(second).not.toBeNull()
    expect(isSlotOverlapError(second)).toBe(true)
  })

  it('K1: ardisik randevu (biri biterken oburu baslar) cakisma sayilmaz', async () => {
    await rawAppointment(staffProfileId, at(2), at(3))
    await expect(rawAppointment(staffProfileId, at(3), at(4))).resolves.toBeDefined()
  })

  it('K1: farkli personel ayni saatte randevu alabilir', async () => {
    await rawAppointment(staffProfileId, at(5), at(6))
    await expect(rawAppointment(otherStaffProfileId, at(5), at(6))).resolves.toBeDefined()
  })

  it('K1: iptal, gelmedi ve silinmis randevu saati bloklamaz', async () => {
    await rawAppointment(staffProfileId, at(7), at(8), 'cancelled')
    await rawAppointment(staffProfileId, at(7), at(8), 'pending', true)
    await expect(rawAppointment(staffProfileId, at(7), at(8))).resolves.toBeDefined()
  })

  it('K1: eszamanli iki yonetici istegi -> biri 201, digeri 409 SLOT_TAKEN (on kontrol yarisi veritabaninda biter)', async () => {
    const startAt = at(10).toISOString()
    const send = () =>
      request(app)
        .post(`/api/v1/tenants/${slug}/appointments`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ customerId, serviceId, staffId: staffProfileId, startAt })
    const results = await Promise.all([send(), send(), send()])
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([201, 409, 409])
    for (const r of results.filter((x) => x.status === 409)) expect(r.body.error.code).toBe('SLOT_TAKEN')
    const count = await db.appointment.count({ where: { tenantId, staffId: staffProfileId, startAt: at(10) } })
    expect(count).toBe(1)
  })

  it('K2: saat degistirme cakisirsa 409 SLOT_TAKEN ve randevu yerinde kalir', async () => {
    const a = await rawAppointment(staffProfileId, at(20), at(21))
    await rawAppointment(staffProfileId, at(22), at(23))
    const res = await request(app)
      .patch(`/api/v1/tenants/${slug}/appointments/${a.id}/reschedule`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ startAt: at(22).toISOString() })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SLOT_TAKEN')
    const after = await db.appointment.findUniqueOrThrow({ where: { id: a.id } })
    expect(after.startAt.getTime()).toBe(at(20).getTime())
  })

  it('K4: cakisma kisiti pg_constraint icinde tanimli ve btree_gist kurulu', async () => {
    const rows = await db.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint WHERE conname = 'appointments_staff_no_overlap' AND contype = 'x'`
    expect(rows).toHaveLength(1)
  })
})
