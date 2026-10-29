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

// Gercek PostgreSQL ister (api-test.sh yigini). Dogrulanmamis online talep: musterisiz kayit, CHECK, onayda eslestirme.
const app = createApp({ rateLimitMax: 1000 })
const H = 60 * 60 * 1000
const REQUESTED_PHONE = '+905550001122'

describe('S2 Kritik 2: dogrulanmamis talep ve onayda musteri eslestirme (gercek PG)', () => {
  const suffix = uniqueSuffix()
  const suffixB = `${uniqueSuffix()}b`
  let tenantId: string
  let slug: string
  let ownerToken: string
  let staffToken: string
  let staffId: string
  let serviceId: string
  let existingCustomerId: string
  let otherPhoneCustomerId: string
  let tenantBId: string
  let tenantBCustomerId: string
  let slotCounter = 0

  async function unverifiedRequest(phone = REQUESTED_PHONE) {
    slotCounter += 1
    const start = new Date(Date.now() + (20 + slotCounter) * 24 * H)
    return db.appointment.create({
      data: {
        tenantId,
        customerId: null,
        requestedName: 'Talep Eden',
        requestedPhone: phone,
        phoneVerified: false,
        bookingChannel: 'web',
        status: 'pending',
        staffId,
        serviceId,
        referenceCode: `T-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        startAt: start,
        endAt: new Date(start.getTime() + H),
        priceCharged: 100,
      },
    })
  }

  const approve = (id: string, body?: object, token = ownerToken) =>
    request(app).patch(`/api/v1/tenants/${slug}/appointments/${id}/approve`).set('Authorization', `Bearer ${token}`).send(body ?? {})

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    slug = tenant.slug
    ownerToken = (await createTestOwner(tenantId, slug, suffix)).token
    const staff = await createTestStaff(tenantId, slug, suffix)
    staffToken = staff.token
    staffId = staff.profile.id
    serviceId = (await createTestService(tenantId, suffix)).id
    existingCustomerId = (await createTestCustomer(tenantId, '05550001122', suffix)).id
    otherPhoneCustomerId = (await createTestCustomer(tenantId, '+905559998877', `${suffix}x`)).id

    const tenantB = await createTestTenant(suffixB)
    tenantBId = tenantB.id
    tenantBCustomerId = (await createTestCustomer(tenantBId, '+905550001122', suffixB)).id
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
    await cleanupTenant(tenantBId)
  })

  it('CHECK: musterisiz kayit yalniz dogrulanmamis ve ad+telefon tasiyan talep olabilir (phoneVerified=true iken customerId null reddedilir)', async () => {
    const start = new Date(Date.now() + 90 * 24 * H)
    const base = {
      tenantId, staffId, serviceId, customerId: null, startAt: start, endAt: new Date(start.getTime() + H), priceCharged: 100,
    }
    await expect(
      db.appointment.create({ data: { ...base, referenceCode: 'CHK-1', phoneVerified: true, requestedName: 'A', requestedPhone: '+905550001122' } }),
    ).rejects.toThrow(/appointments_customer_or_request|check constraint/i)
    await expect(
      db.appointment.create({ data: { ...base, referenceCode: 'CHK-2', phoneVerified: false, requestedName: null, requestedPhone: '+905550001122' } }),
    ).rejects.toThrow(/appointments_customer_or_request|check constraint/i)
  })

  it('musterisiz talep, telefonu kayitli musterinin kartina baglanmaz: liste ad/telefonu talepten verir, musteri sayisi ve kart degismez', async () => {
    const before = await db.customer.count({ where: { tenantId } })
    const appt = await unverifiedRequest()
    const res = await request(app)
      .get(`/api/v1/tenants/${slug}/appointments?limit=100`)
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    const row = res.body.data.find((a: { id: string }) => a.id === appt.id)
    expect(row).toMatchObject({ customerName: 'Talep Eden', customerPhone: REQUESTED_PHONE, unverified: true })
    expect(await db.customer.count({ where: { tenantId } })).toBe(before)
    expect(await db.appointment.count({ where: { customerId: existingCustomerId } })).toBe(0)
  })

  it('govdesiz onay: telefon kayitliysa 409 CUSTOMER_MATCH_REQUIRED + adaylar, talep pending kalir', async () => {
    const appt = await unverifiedRequest()
    const res = await approve(appt.id)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CUSTOMER_MATCH_REQUIRED')
    expect(res.body.candidates.map((c: { id: string }) => c.id)).toContain(existingCustomerId)
    const after = await db.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(after.status).toBe('pending')
    expect(after.customerId).toBeNull()
  })

  it('link: telefonu eslesen musteri baglanir; talep confirmed ve customerId dolu', async () => {
    const appt = await unverifiedRequest()
    const res = await approve(appt.id, { customerAction: 'link', customerId: existingCustomerId })
    expect(res.status).toBe(200)
    const after = await db.appointment.findUniqueOrThrow({ where: { id: appt.id } })
    expect(after).toMatchObject({ status: 'confirmed', customerId: existingCustomerId })
  })

  it('link: baska telefonlu musteri 409 CUSTOMER_PHONE_MISMATCH, talep degismez', async () => {
    const appt = await unverifiedRequest()
    const res = await approve(appt.id, { customerAction: 'link', customerId: otherPhoneCustomerId })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CUSTOMER_PHONE_MISMATCH')
    expect((await db.appointment.findUniqueOrThrow({ where: { id: appt.id } })).customerId).toBeNull()
  })

  it('kiraci izolasyonu: A kiracisi B kiracisinin musterisiyle link denerse 404 (musteri B de gercekten var)', async () => {
    expect(await db.customer.count({ where: { id: tenantBCustomerId, tenantId: tenantBId } })).toBe(1)
    const appt = await unverifiedRequest()
    const res = await approve(appt.id, { customerAction: 'link', customerId: tenantBCustomerId })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('CUSTOMER_NOT_FOUND')
    expect((await db.appointment.findUniqueOrThrow({ where: { id: appt.id } })).customerId).toBeNull()
  })

  it('create: telefon kiracida kayitli degilse yeni musteri olusur ve talebe baglanir', async () => {
    const appt = await unverifiedRequest('+905551230000')
    const res = await approve(appt.id, { customerAction: 'create' })
    expect(res.status).toBe(200)
    const after = await db.appointment.findUniqueOrThrow({ where: { id: appt.id }, include: { customer: true } })
    expect(after.status).toBe('confirmed')
    expect(after.customer).toMatchObject({ tenantId, phone: '+905551230000', fullName: 'Talep Eden' })
  })

  it('eszamanli iki onaydan biri 200, digeri 409; tek musteri olusur', async () => {
    const appt = await unverifiedRequest('+905551239999')
    const results = await Promise.all([approve(appt.id, { customerAction: 'create' }), approve(appt.id, { customerAction: 'create' })])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect(await db.customer.count({ where: { tenantId, phone: '+905551239999' } })).toBe(1)
  })

  it('uzman (staff) onaylayamaz: 403 ve talep degismez', async () => {
    const appt = await unverifiedRequest('+905551230001')
    const res = await approve(appt.id, { customerAction: 'create' }, staffToken)
    expect(res.status).toBe(403)
    expect((await db.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('pending')
  })

  it('red musteri olusturmaz ve musterisiz talepte calisir (cancelReason=rejected)', async () => {
    const before = await db.customer.count({ where: { tenantId } })
    const appt = await unverifiedRequest('+905551230002')
    const res = await request(app).patch(`/api/v1/tenants/${slug}/appointments/${appt.id}/reject`).set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    expect(await db.customer.count({ where: { tenantId } })).toBe(before)
    expect(await db.appointment.findUniqueOrThrow({ where: { id: appt.id } })).toMatchObject({ status: 'cancelled', cancelReason: 'rejected' })
  })

  it('eski durum ucu: uzman musterisiz talebi onaylayamaz/iptal edemez (403), talep pending kalir, govdede aday yok', async () => {
    const appt = await unverifiedRequest()
    const res = await request(app)
      .patch(`/api/v1/tenants/${slug}/appointments/${appt.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'confirmed' })
    expect(res.status).toBe(403)
    expect(JSON.stringify(res.body)).not.toContain('candidates')
    expect((await db.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('pending')
  })

  it('eski durum ucu: yetkili de musterisiz talebi confirmed/completed yapamaz (409 CUSTOMER_MATCH_REQUIRED, aday yok); iptal edebilir', async () => {
    const appt = await unverifiedRequest()
    const patchStatus = (status: string) =>
      request(app)
        .patch(`/api/v1/tenants/${slug}/appointments/${appt.id}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status })
    for (const status of ['confirmed', 'completed']) {
      const res = await patchStatus(status)
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('CUSTOMER_MATCH_REQUIRED')
      expect(res.body.candidates).toBeUndefined()
    }
    expect((await db.appointment.findUniqueOrThrow({ where: { id: appt.id } })).customerId).toBeNull()
    expect((await patchStatus('cancelled')).status).toBe(200)
  })

  it('S2 Kritik 1: dogrulamasiz modda ayni telefondan ikinci gecerli talep de gercekten olusur ve ayni yaniti verir (DB de 2 kayit)', async () => {
    await db.tenant.update({ where: { id: tenantId }, data: { settings: { publicBookingEnabled: true } } })
    await db.staffProfile.update({ where: { id: staffId }, data: { acceptsOnlineBooking: true } })
    await db.staffServiceAssignment.create({ data: { staffId, serviceId, tenantId, isActive: true } })
    await db.service.update({ where: { id: serviceId }, data: { isOnlineBookable: true, isActive: true } })

    const phone = '0555 777 66 55'
    const book = (hours: number) =>
      request(app)
        .post(`/api/v1/tenants/${slug}/public/book`)
        .send({
          serviceId,
          staffId,
          startAt: new Date(Date.now() + (40 * 24 + hours) * H).toISOString().replace(/\.\d{3}Z$/, 'Z'),
          customerName: 'Aynı Telefon',
          customerPhone: phone,
        })
    const first = await book(1)
    const second = await book(3)
    expect([first.status, second.status]).toEqual([201, 201])
    expect(Object.keys(second.body).sort()).toEqual(Object.keys(first.body).sort())
    expect(second.body).toMatchObject({ status: 'pending', approvalRequired: true, phoneVerified: false })
    expect(await db.appointment.count({ where: { tenantId, requestedPhone: '+905557776655', customerId: null } })).toBe(2)
    // ikinci talep slotu gercekten tutar: ayni saate baska telefon 409
    const clash = await request(app)
      .post(`/api/v1/tenants/${slug}/public/book`)
      .send({
        serviceId,
        staffId,
        startAt: new Date(Date.now() + (40 * 24 + 3) * H).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        customerName: 'Baska Kisi',
        customerPhone: '0555 111 00 99',
      })
    expect(clash.status).toBe(409)
    expect(clash.body.error.code).toBe('SLOT_TAKEN')
  })

  it('saklama: 30 gunden eski iptal edilmis musterisiz talebin ad ve telefonu gece taramasinda anonimlesir; yeni olan ve baglanmis kayit korunur', async () => {
    const old = await unverifiedRequest('+905553334455')
    const fresh = await unverifiedRequest('+905553334466')
    await db.appointment.update({ where: { id: old.id }, data: { status: 'cancelled', cancelReason: 'expired' } })
    await db.appointment.update({ where: { id: fresh.id }, data: { status: 'cancelled', cancelReason: 'rejected' } })
    const noShow = await unverifiedRequest('+905553334477')
    await db.appointment.update({ where: { id: noShow.id }, data: { status: 'no_show' } })
    await db.$executeRaw`UPDATE appointments SET "updatedAt" = now() - interval '31 days' WHERE id = ${noShow.id}::uuid`
    await db.$executeRaw`UPDATE appointments SET "updatedAt" = now() - interval '31 days' WHERE id = ${old.id}::uuid`
    const { anonymizeStaleRequests } = await import('../lib/online-booking')
    expect(await anonymizeStaleRequests()).toBeGreaterThanOrEqual(1)
    expect(await db.appointment.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ requestedName: '-', requestedPhone: '-' })
    expect(await db.appointment.findUniqueOrThrow({ where: { id: noShow.id } })).toMatchObject({ requestedName: '-', requestedPhone: '-' })
    expect(await db.appointment.findUniqueOrThrow({ where: { id: fresh.id } })).toMatchObject({ requestedName: 'Talep Eden', requestedPhone: '+905553334466' })
  })
})
