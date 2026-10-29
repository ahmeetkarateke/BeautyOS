import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import { uniqueSuffix, createTestTenant, createTestOwner, createTestManager, cleanupTenant } from './helpers/setup'

// A3 / ADR-0042 (gercek PG): davet akisi bastan sona, es zamanli kabul, kiracı izolasyonu, token duz metin degil.
// invitations-owner / invitations-public testleri ayni davranislari sahte db ile sinar.
const app = createApp({ rateLimitMax: 1000 })

describe('A3: personel daveti (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let a: { id: string; slug: string }
  let b: { id: string; slug: string }
  let ownerA: string
  let ownerB: string
  let managerA: string
  const email = `davetli-${suffix}@test.local`

  const invite = (slug: string, token: string, body: object) =>
    request(app).post(`/api/v1/tenants/${slug}/invitations`).set('Authorization', `Bearer ${token}`).send(body)
  const tokenOf = (link: string) => link.split('/invite/')[1]

  beforeAll(async () => {
    a = await createTestTenant(`${suffix}a`)
    b = await createTestTenant(`${suffix}b`)
    ownerA = (await createTestOwner(a.id, a.slug, `${suffix}a`)).token
    ownerB = (await createTestOwner(b.id, b.slug, `${suffix}b`)).token
    managerA = (await createTestManager(a.id, a.slug, `${suffix}a`)).token
  })

  afterAll(async () => {
    await db.invitation.deleteMany({ where: { tenantId: { in: [a.id, b.id] } } })
    await cleanupTenant(a.id)
    await cleanupTenant(b.id)
  })

  it('K-mutlu: davet -> kabul -> giris; rol ve unvan davetteki gibi, token veritabaninda duz metin degil', async () => {
    const created = await invite(a.slug, ownerA, { email, fullName: 'Davetli Uzman', role: 'staff', title: 'Kuafor' })
    expect(created.status).toBe(201)
    const token = tokenOf(created.body.link)
    const stored = await db.invitation.findUniqueOrThrow({ where: { id: created.body.id } })
    expect(stored.tokenHash).not.toBe(token)
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/)

    const accepted = await request(app).post(`/api/v1/auth/invitations/${token}/accept`).send({ password: 'DavetSifre12' })
    expect(accepted.status).toBe(200)
    expect(accepted.body.user).toMatchObject({ email, role: 'staff', tenantSlug: a.slug })

    const profile = await db.staffProfile.findFirstOrThrow({ where: { user: { email } } })
    expect(profile.title).toBe('Kuafor')
    expect(profile.tenantId).toBe(a.id)

    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'DavetSifre12' })
    expect(login.status).toBe(200)
  })

  it('K-tek-kullanim: ayni token ikinci kez 404 INVITATION_INVALID', async () => {
    const second = `ikinci-${suffix}@test.local`
    const created = await invite(a.slug, ownerA, { email: second, fullName: 'Ikinci Kisi', role: 'manager' })
    const token = tokenOf(created.body.link)
    expect((await request(app).post(`/api/v1/auth/invitations/${token}/accept`).send({ password: 'DavetSifre12' })).status).toBe(200)
    const again = await request(app).post(`/api/v1/auth/invitations/${token}/accept`).send({ password: 'DavetSifre12' })
    expect(again.status).toBe(404)
    expect(again.body.error.code).toBe('INVITATION_INVALID')
  })

  it('K-yaris: ayni token ile iki es zamanli kabulden yalniz biri basarili, tek kullanici olusur', async () => {
    const racer = `yaris-${suffix}@test.local`
    const created = await invite(a.slug, ownerA, { email: racer, fullName: 'Yaris Kisi', role: 'receptionist' })
    const token = tokenOf(created.body.link)
    const results = await Promise.all([
      request(app).post(`/api/v1/auth/invitations/${token}/accept`).send({ password: 'DavetSifre12' }),
      request(app).post(`/api/v1/auth/invitations/${token}/accept`).send({ password: 'DavetSifre12' }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 404].sort())
    expect(await db.user.count({ where: { email: racer } })).toBe(1)
  })

  it('K-sure: suresi dolmus ve iptal edilmis bag, gecersiz bagla ayni 404 govdeyi doner', async () => {
    const expired = await invite(a.slug, ownerA, { email: `sure-${suffix}@test.local`, fullName: 'Sure Kisi', role: 'staff' })
    await db.invitation.update({ where: { id: expired.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    const revoked = await invite(a.slug, ownerA, { email: `iptal-${suffix}@test.local`, fullName: 'Iptal Kisi', role: 'staff' })
    expect((await request(app).delete(`/api/v1/tenants/${a.slug}/invitations/${revoked.body.id}`).set('Authorization', `Bearer ${ownerA}`)).status).toBe(200)

    const unknown = await request(app).get(`/api/v1/auth/invitations/${'Z'.repeat(43)}`)
    for (const link of [expired.body.link, revoked.body.link]) {
      const res = await request(app).get(`/api/v1/auth/invitations/${tokenOf(link)}`)
      expect(res.status).toBe(404)
      expect(res.body).toEqual(unknown.body)
    }
  })

  it('K-izolasyon: kiracı B, A\'nin davetini iptal edemez ve goremez (A\'da var oldugu dogrulanir)', async () => {
    const created = await invite(a.slug, ownerA, { email: `izole-${suffix}@test.local`, fullName: 'Izole Kisi', role: 'staff' })
    expect(await db.invitation.count({ where: { id: created.body.id, tenantId: a.id } })).toBe(1)
    const del = await request(app).delete(`/api/v1/tenants/${b.slug}/invitations/${created.body.id}`).set('Authorization', `Bearer ${ownerB}`)
    expect(del.status).toBe(404)
    const list = await request(app).get(`/api/v1/tenants/${b.slug}/invitations`).set('Authorization', `Bearer ${ownerB}`)
    expect(list.body.data.map((i: { id: string }) => i.id)).not.toContain(created.body.id)
    expect((await db.invitation.findUniqueOrThrow({ where: { id: created.body.id } })).revokedAt).toBeNull()
  })

  it('K-yetki: manager davet acamaz (403), owner rolu davet edilemez (400)', async () => {
    const forbidden = await invite(a.slug, managerA, { email: `yetki-${suffix}@test.local`, fullName: 'Yetki Kisi', role: 'staff' })
    expect(forbidden.status).toBe(403)
    const owner = await invite(a.slug, ownerA, { email: `sahip-${suffix}@test.local`, fullName: 'Sahip Kisi', role: 'owner' })
    expect(owner.status).toBe(400)
  })

  it('K-baska-kiraci-eposta: e-posta baska kiracida kayitliysa kabul 409 INVITATION_EMAIL_IN_USE', async () => {
    const shared = `ortak-${suffix}@test.local`
    const created = await invite(a.slug, ownerA, { email: shared, fullName: 'Ortak Kisi', role: 'staff' })
    await db.user.create({ data: { tenantId: b.id, email: shared, passwordHash: 'x', fullName: 'Baska Kiraci', role: 'staff' } })
    const res = await request(app).post(`/api/v1/auth/invitations/${tokenOf(created.body.link)}/accept`).send({ password: 'DavetSifre12' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INVITATION_EMAIL_IN_USE')
  })
})
