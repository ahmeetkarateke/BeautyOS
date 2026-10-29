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

// A4 (gercek PG): randevu listesi sozlesmesi. Gun sinirlari Europe/Istanbul gunune gore.
const app = createApp({ rateLimitMax: 1000 })

describe('A4: randevu listesi sozlesmesi (gercek PG)', () => {
  const suffix = uniqueSuffix()
  const suffixB = `${uniqueSuffix()}b`
  let tenant: { id: string; slug: string }
  let otherTenant: { id: string; slug: string }
  let ownerToken: string
  let serviceId: string
  let staffId: string
  let customerId: string

  const list = (query: string) =>
    request(app).get(`/api/v1/tenants/${tenant.slug}/appointments?${query}`).set('Authorization', `Bearer ${ownerToken}`)

  async function addAppointment(startAt: string, minutes: number, code: string) {
    const start = new Date(startAt)
    return db.appointment.create({
      data: {
        tenantId: tenant.id,
        customerId,
        serviceId,
        staffId,
        startAt: start,
        endAt: new Date(start.getTime() + minutes * 60_000),
        priceCharged: 100,
        referenceCode: `APT-A4-${code}-${suffix}`,
        status: 'confirmed',
        bookingChannel: 'manual',
      },
    })
  }

  beforeAll(async () => {
    tenant = await createTestTenant(suffix)
    otherTenant = await createTestTenant(suffixB)
    ownerToken = (await createTestOwner(tenant.id, tenant.slug, suffix)).token
    staffId = (await createTestStaff(tenant.id, tenant.slug, suffix)).profile.id
    serviceId = (await createTestService(tenant.id, suffix)).id
    customerId = (await createTestCustomer(tenant.id, `+90555${suffix.replace(/\D/g, '').slice(0, 7).padEnd(7, '2')}`, suffix)).id
    // 2031-03-10 Istanbul gunu: 21:00Z (onceki gun) ile 20:59Z arasi.
    await addAppointment('2031-03-09T21:00:00Z', 45, 'A') // 10 Mart 00:00 Istanbul (gunun ilk dakikasi)
    await addAppointment('2031-03-10T20:30:00Z', 30, 'B') // 10 Mart 23:30 Istanbul (gunun son dakikalari)
    await addAppointment('2031-03-10T21:00:00Z', 30, 'C') // 11 Mart 00:00 Istanbul
    await addAppointment('2031-03-09T20:59:00Z', 1, 'D') // 9 Mart 23:59 Istanbul
  })

  afterAll(async () => {
    await cleanupTenant(tenant.id)
    await cleanupTenant(otherTenant.id)
  })

  it('liste ogesi customerId, serviceId, staffId ve durationMinutes tasir', async () => {
    const res = await list('date=2031-03-10')
    expect(res.status).toBe(200)
    const a = res.body.data.find((x: { referenceCode: string }) => x.referenceCode === `APT-A4-A-${suffix}`)
    expect(a).toMatchObject({ customerId, serviceId, staffId, durationMinutes: 45 })
  })

  it('date=: Istanbul gunu sinirlari (00:00 dahil, ertesi gun 00:00 haric)', async () => {
    const res = await list('date=2031-03-10')
    const codes = res.body.data.map((x: { referenceCode: string }) => x.referenceCode.split('-')[2]).sort()
    expect(codes).toEqual(['A', 'B'])
  })

  it('dateFrom/dateTo: aralik her iki ucta Istanbul gunune gore, dateTo dahil', async () => {
    const res = await list('dateFrom=2031-03-10&dateTo=2031-03-11')
    const codes = res.body.data.map((x: { referenceCode: string }) => x.referenceCode.split('-')[2]).sort()
    expect(codes).toEqual(['A', 'B', 'C'])
  })

  it('aralikta satir siniri yok: limit=1 verilse de aralikta tum randevular gelir', async () => {
    const res = await list('dateFrom=2031-03-09&dateTo=2031-03-11&limit=1')
    expect(res.body.data).toHaveLength(4)
  })

  it('aralik 31 gunden uzunsa 400 RANGE_TOO_LARGE; ters aralik 400 INVALID_RANGE', async () => {
    const big = await list('dateFrom=2031-03-01&dateTo=2031-04-05')
    expect(big.status).toBe(400)
    expect(big.body.error.code).toBe('RANGE_TOO_LARGE')
    const reversed = await list('dateFrom=2031-03-11&dateTo=2031-03-10')
    expect(reversed.status).toBe(400)
    expect(reversed.body.error.code).toBe('INVALID_RANGE')
  })

  it('kiraci izolasyonu: baska kiracinin yetkilisi bu salonun randevusunu goremez', async () => {
    const otherOwner = await createTestOwner(otherTenant.id, otherTenant.slug, suffixB)
    const res = await request(app)
      .get(`/api/v1/tenants/${otherTenant.slug}/appointments?date=2031-03-10`)
      .set('Authorization', `Bearer ${otherOwner.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})
