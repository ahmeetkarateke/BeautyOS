import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import { uniqueSuffix, createTestTenant, createTestOwner, createTestStaff, cleanupTenant } from './helpers/setup'

// S6 (gercek PG, api-test.sh yigini): gercek giris, yenileme dondurme, aile iptali ve anlik pasiflestirme.
const app = createApp({ rateLimitMax: 1000 })

function refreshCookie(res: request.Response): string {
  const raw = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('refreshToken='))!
  return raw.split(';')[0]
}

describe('S6: durumlu oturum (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenant: { id: string; slug: string }
  let owner: Awaited<ReturnType<typeof createTestOwner>>
  let staff: Awaited<ReturnType<typeof createTestStaff>>

  beforeAll(async () => {
    tenant = await createTestTenant(suffix)
    owner = await createTestOwner(tenant.id, tenant.slug, suffix)
    staff = await createTestStaff(tenant.id, tenant.slug, suffix)
  })

  afterAll(async () => {
    await cleanupTenant(tenant.id)
  })

  const login = (email: string, password: string) => request(app).post('/api/v1/auth/login').send({ email, password })

  it('K1: giris -> yenile -> eski cerez tekrar = 401 ve aile iptal; DB\'de ham token yok', async () => {
    const first = await login(`owner-${suffix}@test.local`, owner.password)
    expect(first.status).toBe(200)
    const c1 = refreshCookie(first)
    const stored = await db.session.findMany({ where: { userId: owner.user.id } })
    expect(stored.length).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(stored)).not.toContain(c1.split('=')[1])

    const second = await request(app).post('/api/v1/auth/refresh').set('Cookie', c1)
    expect(second.status).toBe(200)
    const c2 = refreshCookie(second)
    expect(c2).not.toBe(c1)

    // S6-1: 30 sn tolerans icinde eski cerez tekrar gelirse (yaniti kaybolan yenileme) oturum dusmez
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', c1)).status).toBe(200)
    expect(
      (await db.session.findMany({ where: { userId: owner.user.id, revokedAt: { not: null } } })).length,
    ).toBe(0)

    // Tolerans disinda (kullanim tarihi geri cekilir) ayni cerez calinma sayilir: 401 ve tum aile iptal
    await db.session.updateMany({ where: { userId: owner.user.id, usedAt: { not: null } }, data: { usedAt: new Date(Date.now() - 60_000) } })
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', c1)).status).toBe(401)
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', c2)).status).toBe(401)
    // iptal edilen ailenin erisim token'i da hemen duser
    expect((await request(app).get(`/api/v1/tenants/${tenant.slug}/settings`).set('Authorization', `Bearer ${second.body.token}`)).status).toBe(401)
  })

  it('K2/K3: personel pasiflestirilince acik erisim token\'i ve yenilemesi aninda 401', async () => {
    const res = await login(`staff-${suffix}@test.local`, staff.password)
    expect(res.status).toBe(200)
    const url = `/api/v1/tenants/${tenant.slug}/appointments`
    expect((await request(app).get(url).set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200)

    const del = await request(app).delete(`/api/v1/tenants/${tenant.slug}/staff/${staff.profile.id}`).set('Authorization', `Bearer ${owner.token}`)
    expect(del.status).toBe(200)

    expect((await request(app).get(url).set('Authorization', `Bearer ${res.body.token}`)).status).toBe(401)
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie(res))).status).toBe(401)
    // owner ayni anda etkilenmez (sid'siz yardimci token da gecerli)
    expect((await request(app).get(`/api/v1/tenants/${tenant.slug}/settings`).set('Authorization', `Bearer ${owner.token}`)).status).toBe(200)
  })

  it('K2: cikis oturumu kapatir; ayni cerezle yenileme 401', async () => {
    const res = await login(`owner-${suffix}@test.local`, owner.password)
    const cookie = refreshCookie(res)
    expect((await request(app).post('/api/v1/auth/logout').set('Cookie', cookie)).status).toBe(200)
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401)
    expect((await request(app).get(`/api/v1/tenants/${tenant.slug}/settings`).set('Authorization', `Bearer ${res.body.token}`)).status).toBe(401)
  })
})
