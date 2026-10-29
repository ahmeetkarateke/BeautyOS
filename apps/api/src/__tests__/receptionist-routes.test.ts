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
  cleanupTenant,
} from './helpers/setup'

// A2 (gercek PG): rol atama (yalniz sahip) ve resepsiyonun yalniz-bugun kasa kurali.
const app = createApp({ rateLimitMax: 1000 })

describe('A2: resepsiyon rolu (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenant: { id: string; slug: string }
  const tokens = {} as Record<'owner' | 'manager' | 'receptionist' | 'staff', string>

  beforeAll(async () => {
    tenant = await createTestTenant(suffix)
    tokens.owner = (await createTestOwner(tenant.id, tenant.slug, suffix)).token
    tokens.manager = (await createTestManager(tenant.id, tenant.slug, suffix)).token
    tokens.receptionist = (await createTestReceptionist(tenant.id, tenant.slug, suffix)).token
    tokens.staff = (await createTestStaff(tenant.id, tenant.slug, suffix)).token
  })

  afterAll(async () => {
    await cleanupTenant(tenant.id)
  })

  const addStaff = (token: string, body: Record<string, unknown>) =>
    request(app).post(`/api/v1/tenants/${tenant.slug}/staff`).set('Authorization', `Bearer ${token}`).send({ password: 'Guclu1234', fullName: 'Yeni Kisi', title: 'Unvan', ...body })

  it('sahip role: receptionist verebilir; kullanici receptionist olur ve uzman profili olusmaz', async () => {
    const res = await addStaff(tokens.owner, { email: `resp-${suffix}@test.local`, role: 'receptionist' })
    expect(res.status).toBe(201)
    expect(res.body.role).toBe('receptionist')
    expect(res.body.id).toBeNull()
    const user = await db.user.findFirstOrThrow({ where: { id: res.body.userId }, include: { staffProfile: true } })
    expect(user.role).toBe('receptionist')
    expect(user.staffProfile).toBeNull()
  })

  it('sahip role: manager verebilir', async () => {
    const res = await addStaff(tokens.owner, { email: `mud-${suffix}@test.local`, role: 'manager' })
    expect(res.status).toBe(201)
    expect(res.body.role).toBe('manager')
  })

  it('rol verilmezse uzman olusur ve uzman profili vardir (geriye uyum)', async () => {
    const res = await addStaff(tokens.owner, { email: `uzm-${suffix}@test.local` })
    expect(res.status).toBe(201)
    expect(res.body.role).toBe('staff')
    expect(res.body.id).toEqual(expect.any(String))
  })

  it('mudur role: receptionist veremez (403 FORBIDDEN) ve kullanici olusmaz', async () => {
    const email = `yetkisiz-${suffix}@test.local`
    const res = await addStaff(tokens.manager, { email, role: 'receptionist' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    expect(await db.user.count({ where: { email } })).toBe(0)
  })

  it('mudur rol vermeden uzman ekleyebilir (mevcut davranis korunur)', async () => {
    const res = await addStaff(tokens.manager, { email: `mudur-uzm-${suffix}@test.local` })
    expect(res.status).toBe(201)
  })

  it('gecersiz rol (superadmin, owner) 400 VALIDATION_ERROR', async () => {
    for (const role of ['superadmin', 'owner']) {
      const res = await addStaff(tokens.owner, { email: `gecersiz-${role}-${suffix}@test.local`, role })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('uzman ve resepsiyon personel ekleyemez (403)', async () => {
    for (const token of [tokens.staff, tokens.receptionist]) {
      const res = await addStaff(token, { email: `kimse-${uniqueSuffix()}@test.local` })
      expect(res.status).toBe(403)
    }
  })

  it('resepsiyon bugunun gunluk kasasini gorur (200)', async () => {
    const res = await request(app).get(`/api/v1/tenants/${tenant.slug}/reports/daily`).set('Authorization', `Bearer ${tokens.receptionist}`)
    expect(res.status).toBe(200)
  })

  it('resepsiyon gecmis gun ve aralik raporunu goremez (403); mudur gorur', async () => {
    const past = await request(app).get(`/api/v1/tenants/${tenant.slug}/reports/daily?date=2020-01-01`).set('Authorization', `Bearer ${tokens.receptionist}`)
    expect(past.status).toBe(403)
    const range = await request(app).get(`/api/v1/tenants/${tenant.slug}/reports/daily?from=2020-01-01&to=2020-01-05`).set('Authorization', `Bearer ${tokens.receptionist}`)
    expect(range.status).toBe(403)
    const asManager = await request(app).get(`/api/v1/tenants/${tenant.slug}/reports/daily?date=2020-01-01`).set('Authorization', `Bearer ${tokens.manager}`)
    expect(asManager.status).toBe(200)
  })
})
