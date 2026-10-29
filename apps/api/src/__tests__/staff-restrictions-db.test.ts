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

// A2 bolum 2 (gercek PG): R3 fiyat kilidi, R4 maskeli telefon/arama, tips/summary kapsami ve kiracı izolasyonu.
// staff-restrictions.test.ts ayni davranislari sahte db ile sinar; burada gercek sorgular dogrulanir.
const app = createApp({ rateLimitMax: 1000 })

describe('A2 bolum 2: uzman kisitlari (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenant: { id: string; slug: string }
  let other: { id: string; slug: string }
  let ownerToken: string
  let me: Awaited<ReturnType<typeof createTestStaff>>
  let colleague: Awaited<ReturnType<typeof createTestStaff>>
  let serviceId: string
  const ownPhone = '+905321110001'
  const otherPhone = '+905321110002'
  const foreignPhone = '+905321110003'
  let apptId: string

  beforeAll(async () => {
    tenant = await createTestTenant(suffix)
    other = await createTestTenant(`${suffix}x`)
    ownerToken = (await createTestOwner(tenant.id, tenant.slug, suffix)).token
    me = await createTestStaff(tenant.id, tenant.slug, suffix)
    colleague = await createTestStaff(tenant.id, tenant.slug, `${suffix}c`)
    serviceId = (await createTestService(tenant.id, suffix)).id

    const ownCust = await db.customer.create({ data: { tenantId: tenant.id, fullName: 'Zeynep Kendi', phone: ownPhone, email: 'kendi@test.local' } })
    const otherCust = await db.customer.create({ data: { tenantId: tenant.id, fullName: 'Zeynep Baska', phone: otherPhone, email: 'baska@test.local' } })
    await createTestCustomer(other.id, foreignPhone, `${suffix}x`)
    await db.customer.update({ where: { id: (await db.customer.findFirstOrThrow({ where: { tenantId: other.id } })).id }, data: { fullName: 'Zeynep Yabanci' } })

    const start = new Date(Date.now() + 24 * 3600 * 1000)
    const mk = (customerId: string, staffId: string, offsetH: number) =>
      db.appointment.create({
        data: {
          tenantId: tenant.id, customerId, staffId, serviceId,
          referenceCode: `T-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
          startAt: new Date(start.getTime() + offsetH * 3600 * 1000),
          endAt: new Date(start.getTime() + (offsetH + 1) * 3600 * 1000),
          priceCharged: 500, status: 'confirmed',
        },
      })
    apptId = (await mk(ownCust.id, me.profile.id, 0)).id
    await mk(otherCust.id, colleague.profile.id, 2)

    await db.tipEntry.createMany({
      data: [
        { tenantId: tenant.id, staffId: me.profile.id, amount: 40 },
        { tenantId: tenant.id, staffId: colleague.profile.id, amount: 70 },
        { tenantId: tenant.id, staffId: null, amount: 25 },
      ],
    })
  })

  afterAll(async () => {
    await cleanupTenant(tenant.id)
    await cleanupTenant(other.id)
  })

  const get = (path: string, token: string) => request(app).get(`/api/v1/tenants/${tenant.slug}${path}`).set('Authorization', `Bearer ${token}`)

  it('K-R4: uzman aramada kendi musterisini acik, digerini maskeli gorur; baska kiracinin musterisi yok', async () => {
    const res = await get('/customers?search=Zeynep', me.token)
    expect(res.status).toBe(200)
    const byName = Object.fromEntries(res.body.data.map((c: { fullName: string }) => [c.fullName, c]))
    expect(byName['Zeynep Kendi']).toMatchObject({ phone: ownPhone, phoneMasked: false, isOwn: true })
    expect(byName['Zeynep Baska']).toMatchObject({ phone: '0532 *** ** 02', phoneMasked: true, isOwn: false, email: null })
    expect(byName['Zeynep Yabanci']).toBeUndefined()
  })

  it('K-R4: baska musterinin numarasi telefon aramasiyla bulunamaz, kendi musterisi bulunur', async () => {
    const foreign = await get('/customers?search=1110002', me.token)
    expect(foreign.body.data).toEqual([])
    const own = await get('/customers?search=1110001', me.token)
    expect(own.body.data.map((c: { fullName: string }) => c.fullName)).toEqual(['Zeynep Kendi'])
  })

  it('K-R4: LIKE jokerleri uzman aramasinda tum musterileri listelemez (___, %%%)', async () => {
    for (const wildcard of ['___', '%%%', '_%_']) {
      const res = await get(`/customers?search=${encodeURIComponent(wildcard)}`, me.token)
      expect(res.status, wildcard).toBe(200)
      expect(res.body.data, wildcard).toEqual([])
    }
    // sahip icin ayni arama etkilenmez (kontrol: veri gercekten var)
    expect((await get('/customers?search=Zey', ownerToken)).body.data.length).toBeGreaterThanOrEqual(2)
  })

  it('K-R4: uzman aramasiz liste alamaz; sahip telefonu acik alir', async () => {
    expect((await get('/customers', me.token)).status).toBe(400)
    const res = await get('/customers?search=Baska', ownerToken)
    expect(res.body.data[0].phone).toBe(otherPhone)
  })

  it('K-R3: uzman fiyat gondererek tamamlayinca islem tutari randevu fiyati (500) olur', async () => {
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenant.slug}/appointments/${apptId}/status`)
      .set('Authorization', `Bearer ${me.token}`)
      .send({ status: 'completed', priceCharged: 1 })
    expect(res.status).toBe(200)
    const tx = await db.transaction.findFirstOrThrow({ where: { tenantId: tenant.id, appointmentId: apptId } })
    expect(Number(tx.grossAmount)).toBe(500)
    expect(Number((await db.appointment.findFirstOrThrow({ where: { id: apptId } })).priceCharged)).toBe(500)
  })

  it('K-tips: uzman ozeti yalniz kendi bahsisidir; sahip tumunu gorur', async () => {
    const mine = await get('/tips/summary?period=month', me.token)
    expect(mine.status).toBe(200)
    expect(mine.body.totalAmount).toBe(40)
    expect(mine.body.undistributedTotal).toBe(0)
    expect(mine.body.perStaff.map((p: { staffId: string }) => p.staffId)).toEqual([me.profile.id])
    const all = await get('/tips/summary?period=month', ownerToken)
    expect(all.body.totalAmount).toBe(135)
    expect(all.body.perStaff).toHaveLength(2)
  })
})
