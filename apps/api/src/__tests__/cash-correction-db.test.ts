import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestManager,
  createTestReceptionist,
  createTestStaff,
  createTestService,
  cleanupTenant,
} from './helpers/setup'

// A6b (gercek PG): gun kapanisi, yeniden acma ve odeme duzeltmesi; duzeltme kaydi ve kiraci izolasyonu.
// cash-correction.test.ts ayni davranislari sahte db ile sinar. Adimlar siralidir (ayni "bugun" kasasi).
const app = createApp({ rateLimitMax: 1000 })
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

describe('A6b: kasa kapanisi ve duzeltme (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenant: { id: string; slug: string }
  let other: { id: string; slug: string }
  let owner: string
  let manager: string
  let reception: string
  let otherOwner: string
  let staffProfileId: string
  let apptId: string

  const api = (method: 'get' | 'post' | 'patch', slug: string, path: string, token: string) =>
    request(app)[method](`/api/v1/tenants/${slug}${path}`).set('Authorization', `Bearer ${token}`)

  beforeAll(async () => {
    tenant = await createTestTenant(suffix)
    other = await createTestTenant(`${suffix}x`)
    owner = (await createTestOwner(tenant.id, tenant.slug, suffix)).token
    manager = (await createTestManager(tenant.id, tenant.slug, suffix)).token
    reception = (await createTestReceptionist(tenant.id, tenant.slug, suffix)).token
    otherOwner = (await createTestOwner(other.id, other.slug, `${suffix}x`)).token
    staffProfileId = (await createTestStaff(tenant.id, tenant.slug, suffix)).profile.id
    const service = await createTestService(tenant.id, suffix)
    const customer = await db.customer.create({ data: { tenantId: tenant.id, fullName: 'Kasa Musteri', phone: '+905329990001' } })
    const start = new Date(Date.now() + 3600_000)
    apptId = (
      await db.appointment.create({
        data: {
          tenantId: tenant.id, customerId: customer.id, staffId: staffProfileId, serviceId: service.id,
          referenceCode: `K-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
          startAt: start, endAt: new Date(start.getTime() + 1800_000), priceCharged: 500, status: 'confirmed',
        },
      })
    ).id
  })

  afterAll(async () => {
    await cleanupTenant(tenant.id)
    await cleanupTenant(other.id)
  })

  it('K-R5 1: tamamlama 200 ve odeme ozeti; ikinci tamamlama 409 STATUS_LOCKED, kasada tek kayit', async () => {
    const first = await api('patch', tenant.slug, `/appointments/${apptId}/status`, owner).send({ status: 'completed', paymentMethod: 'cash' })
    expect(first.status).toBe(200)
    expect(first.body.payment).toMatchObject({ grossAmount: 500, cashAmount: 500, cardAmount: 0 })
    const second = await api('patch', tenant.slug, `/appointments/${apptId}/status`, owner).send({ status: 'completed', paymentMethod: 'card' })
    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('STATUS_LOCKED')
    expect(await db.transaction.count({ where: { tenantId: tenant.id, appointmentId: apptId } })).toBe(1)
  })

  it('K-R5 2: manager odemeyi duzeltir (tutar + yontem); duzeltme kaydi eski -> yeni ve gerekceyi tasir; resepsiyon 403', async () => {
    expect((await api('post', tenant.slug, `/appointments/${apptId}/correction`, reception).send({ grossAmount: 450, reason: 'Indirim unutuldu' })).status).toBe(403)
    const res = await api('post', tenant.slug, `/appointments/${apptId}/correction`, manager).send({ grossAmount: 450, paymentMethod: 'card', reason: 'Indirim unutuldu' })
    expect(res.status).toBe(200)
    const txn = await db.transaction.findFirstOrThrow({ where: { tenantId: tenant.id, appointmentId: apptId } })
    expect(Number(txn.grossAmount)).toBe(450)
    expect(txn.paymentMethod).toBe('card')
    expect(Number(txn.cardAmount)).toBe(450)
    expect(Number(txn.cashAmount)).toBe(0)
    expect(Number((await db.appointment.findFirstOrThrow({ where: { id: apptId } })).priceCharged)).toBe(450)
    const rec = await db.correction.findFirstOrThrow({ where: { tenantId: tenant.id, kind: 'payment' } })
    expect(rec.reason).toBe('Indirim unutuldu')
    expect(rec.oldValue).toMatchObject({ grossAmount: 500, paymentMethod: 'cash' })
    expect(rec.newValue).toMatchObject({ grossAmount: 450, paymentMethod: 'card' })
  })

  it('K-R5 3: gun kapaninca bugune odeme/gelir yazilamaz (DAY_CLOSED), duzeltme de ayni; sayim farki doner', async () => {
    const close = await api('post', tenant.slug, `/finance/close-day?date=${today}`, reception).send({ countedCash: 10 })
    expect(close.status).toBe(200)
    expect(close.body.closure).toMatchObject({ isClosed: true, countedCash: 10 })
    const revenue = await api('post', tenant.slug, '/revenues', owner).send({ description: 'x', amount: 10, paymentMethod: 'cash', revenueDate: today })
    expect(revenue.status).toBe(409)
    expect(revenue.body.error.code).toBe('DAY_CLOSED')
    const corr = await api('post', tenant.slug, `/appointments/${apptId}/correction`, owner).send({ grossAmount: 400, reason: 'Kapali gun' })
    expect(corr.status).toBe(409)
    expect(corr.body.error.code).toBe('DAY_CLOSED')
    expect(Number((await db.transaction.findFirstOrThrow({ where: { tenantId: tenant.id, appointmentId: apptId } })).grossAmount)).toBe(450)
  })

  it('K-R5 4: resepsiyon gunu yeniden acamaz; owner gerekceyle acar, kayit tutulur; sonra yazma tekrar calisir', async () => {
    expect((await api('post', tenant.slug, '/finance/reopen-day', reception).send({ date: today, reason: 'Hata var' })).status).toBe(403)
    expect(await db.cashDayClosure.count({ where: { tenantId: tenant.id, isClosed: true } })).toBe(1)
    const reopen = await api('post', tenant.slug, '/finance/reopen-day', owner).send({ date: today, reason: 'Hata var' })
    expect(reopen.status).toBe(200)
    const rec = await db.correction.findFirstOrThrow({ where: { tenantId: tenant.id, kind: 'day_reopen' } })
    expect(rec.reason).toBe('Hata var')
    expect(rec.newValue).toMatchObject({ isClosed: false })
    expect((await api('post', tenant.slug, '/finance/reopen-day', owner).send({ date: today, reason: 'Tekrar' })).status).toBe(409)
    const revenue = await api('post', tenant.slug, '/revenues', owner).send({ description: 'x', amount: 10, paymentMethod: 'cash', revenueDate: today })
    expect(revenue.status).toBe(201)
  })

  it('K-R5 5: kiraci izolasyonu: B sahibi A duzeltmelerini listeleyemez, A odemesini duzeltemez; A verisi degismez', async () => {
    // Veri gercekten var: A sahibi iki kayit gorur.
    const own = await api('get', tenant.slug, '/finance/corrections', owner)
    expect(own.status).toBe(200)
    expect(own.body.data.length).toBe(2)
    const foreign = await api('get', other.slug, '/finance/corrections', otherOwner)
    expect(foreign.body.data).toEqual([])
    const attempt = await api('post', other.slug, `/appointments/${apptId}/correction`, otherOwner).send({ grossAmount: 1, reason: 'Baska kiraci' })
    expect(attempt.status).toBe(409)
    expect(attempt.body.error.code).toBe('NOT_COMPLETED')
    expect(Number((await db.transaction.findFirstOrThrow({ where: { tenantId: tenant.id, appointmentId: apptId } })).grossAmount)).toBe(450)
    // Baska kiracida kapatma, A gununu etkilemez.
    expect((await api('post', other.slug, `/finance/close-day?date=${today}`, otherOwner)).status).toBe(200)
    expect(await db.cashDayClosure.count({ where: { tenantId: tenant.id, isClosed: true } })).toBe(0)
  })
})
