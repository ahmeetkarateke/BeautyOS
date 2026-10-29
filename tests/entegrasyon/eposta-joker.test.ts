import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import { uniqueSuffix, createTestTenant, cleanupTenant } from './helpers/setup'

// Gerçek PostgreSQL ister. Bu dosya tests/entegrasyon altındadır; api-test.sh yığını koşudan önce
// bunu apps/api/src/__tests__/ içine kopyalar (göreli içe aktarmalar oradan çözülür).
// S7 doğrulaması: LIKE joker karakterleri ('_' ve '%') e-posta aramasında joker olarak çalışmamalı.
const app = createApp({ rateLimitMax: 1000 })

describe('S7 doğrulaması: e-posta aramasında joker karakter yok (gerçek PG)', () => {
  const suffix = uniqueSuffix()
  const domain = `ornek-${suffix}.test`
  const victimEmail = `axb@${domain}`
  const password = 'TestPass12!'
  let tenantId: string
  let victimId: string

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    const victim = await db.user.create({
      data: {
        tenantId,
        email: victimEmail,
        passwordHash: await bcrypt.hash(password, 10),
        fullName: 'Test Kurban',
        role: 'owner',
        isActive: true,
      },
    })
    victimId = victim.id
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  const tokenCount = () => db.passwordResetToken.count({ where: { userId: victimId } })

  it('olumlu eşleme: tam e-postayla sıfırlama isteği kullanıcı için token üretir (veri gerçekten var)', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: victimEmail })
    expect(res.status).toBe(200)
    expect(await tokenCount()).toBe(1)
  })

  it('forgot-password a_b@alan ("_" joker): axb@alan kullanıcısı için token OLUŞMAZ, yanıt yine 200', async () => {
    const before = await tokenCount()
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: `a_b@${domain}` })
    expect(res.status).toBe(200)
    expect(await tokenCount()).toBe(before)
  })

  it('login a_b@alan + axb kullanıcısının doğru şifresi: 401 (200 ve token DÖNMEZ)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: `a_b@${domain}`, password })
    expect(res.status).toBe(401)
    expect(res.body.token).toBeUndefined()
  })

  it('olumlu eşleme: aynı şifreyle tam e-posta girişi 200 döner', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: victimEmail, password })
    expect(res.status).toBe(200)
    expect(typeof res.body.token).toBe('string')
  })

  it('"%" joker: a%b@alan ile giriş axb kullanıcısına ulaşmaz (200 olmaz)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: `a%b@${domain}`, password })
    expect(res.status).not.toBe(200)
  })

  it('büyük harfli tam e-posta aynı kullanıcıya çözülür: 200', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: victimEmail.toUpperCase(), password })
    expect(res.status).toBe(200)
  })
})
