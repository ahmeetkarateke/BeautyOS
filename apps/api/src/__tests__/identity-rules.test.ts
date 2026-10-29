import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import { uniqueSuffix, createTestTenant, createTestOwner, cleanupTenant } from './helpers/setup'

// Gercek PostgreSQL ister (api-test.sh yigini). S7: e-posta kucuk harf, kuresel personel kontrolu, guclu sifre.
const app = createApp({ rateLimitMax: 1000 })

describe('S7: kimlik kurallari (gercek PG)', () => {
  const suffix = uniqueSuffix()
  const suffixB = `${uniqueSuffix()}b`
  let tenantA: { id: string; slug: string }
  let tenantB: { id: string; slug: string }
  let ownerA: string
  let ownerBEmail: string
  const registeredTenantIds: string[] = []

  beforeAll(async () => {
    tenantA = await createTestTenant(suffix)
    tenantB = await createTestTenant(suffixB)
    ownerA = (await createTestOwner(tenantA.id, tenantA.slug, suffix)).token
    ownerBEmail = (await createTestOwner(tenantB.id, tenantB.slug, suffixB)).user.email
  })

  afterAll(async () => {
    for (const id of registeredTenantIds) await cleanupTenant(id)
    await cleanupTenant(tenantA.id)
    await cleanupTenant(tenantB.id)
  })

  const addStaff = (body: object) =>
    request(app).post(`/api/v1/tenants/${tenantA.slug}/staff`).set('Authorization', `Bearer ${ownerA}`).send(body)
  const staffBody = (email: string, password = 'Guclu1234') => ({ email, password, fullName: 'Yeni Uzman', title: 'Uzman' })

  it('K2: baska kiracida kayitli e-posta (buyuk/kucuk harf farkli olsa da) personel olarak eklenemez: 409', async () => {
    const res = await addStaff(staffBody(ownerBEmail.toUpperCase()))
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL')
  })

  it('K2: personel e-postasi kucuk harfle saklanir', async () => {
    const res = await addStaff(staffBody(`Karma.Harf-${suffix}@TEST.local`))
    expect(res.status).toBe(201)
    const stored = await db.user.findFirst({ where: { email: { equals: `karma.harf-${suffix}@test.local`, mode: 'insensitive' } } })
    expect(stored?.email).toBe(`karma.harf-${suffix}@test.local`)
  })

  it('K4: personel eklerken zayif sifre (rakamsiz, harfsiz, kisa) 400', async () => {
    for (const password of ['sadeceharfler', '123456789', 'Kisa1']) {
      const res = await addStaff(staffBody(`zayif-${suffix}-${password.length}@test.local`, password))
      expect(res.status).toBe(400)
    }
  })

  it('K4: sifre degistirmede zayif yeni sifre 400', async () => {
    const owner = await db.user.findFirstOrThrow({ where: { tenantId: tenantA.id, role: 'owner' } })
    const res = await request(app)
      .patch(`/api/v1/tenants/${tenantA.slug}/users/${owner.id}/password`)
      .set('Authorization', `Bearer ${ownerA}`)
      .send({ currentPassword: 'TestPass12!', newPassword: 'sadeceharfler' })
    expect(res.status).toBe(400)
  })

  it('K2: kayit e-postayi kucuk harfle saklar; farkli harf bicimiyle giris ve ikinci kayit denemesi (409) calisir', async () => {
    const email = `Kayit.Karma-${suffix}@Test.LOCAL`
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ salonName: `Karma ${suffix}`, slug: `karma-${suffix.replace(/\W/g, '').slice(0, 10)}`, ownerFullName: 'Sahip Kisi', email, password: 'Guclu1234' })
    expect(register.status).toBe(201)
    registeredTenantIds.push((await db.tenant.findFirstOrThrow({ where: { slug: register.body.user.tenantSlug } })).id)
    expect(register.body.user.email).toBe(email.toLowerCase())

    const login = await request(app).post('/api/v1/auth/login').send({ email: email.toUpperCase(), password: 'Guclu1234' })
    expect(login.status).toBe(200)

    const again = await request(app)
      .post('/api/v1/auth/register')
      .send({ salonName: `Karma2 ${suffix}`, slug: `karma2-${suffix.replace(/\W/g, '').slice(0, 9)}`, ownerFullName: 'Sahip Kisi', email: email.toUpperCase(), password: 'Guclu1234' })
    expect(again.status).toBe(409)
  })
})
