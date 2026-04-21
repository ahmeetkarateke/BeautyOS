import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  cleanupTenant,
} from './helpers/setup'

const app = createApp({ rateLimitMax: 1000 })

describe('POST /api/v1/auth/login', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let userEmail: string
  let userPassword: string

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    const owner = await createTestOwner(tenant.id, tenant.slug, suffix)
    userEmail = owner.user.email
    userPassword = owner.password
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  it('doğru şifre → 200 + JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userEmail, password: userPassword })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(typeof res.body.token).toBe('string')
    expect(res.body.user).toMatchObject({
      email: userEmail,
      role: 'owner',
    })
  })

  it('yanlış şifre → 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userEmail, password: 'WrongPass99!' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('var olmayan e-posta → 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@nowhere.test', password: 'SomePass1!' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('eksik body (geçersiz e-posta) → 400 Zod validation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'pass' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('boş body → 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('Rate limiting', () => {
  it('11. istek → 429', async () => {
    const limitedApp = createApp({ rateLimitMax: 10 })

    for (let i = 0; i < 10; i++) {
      await request(limitedApp)
        .post('/api/v1/auth/login')
        .send({ email: `req${i}@rate.test`, password: 'pass' })
    }

    const res = await request(limitedApp)
      .post('/api/v1/auth/login')
      .send({ email: 'blocked@rate.test', password: 'pass' })

    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMIT')
  })
})

describe('Devre dışı kullanıcı', () => {
  const suffix = uniqueSuffix()
  let tenantId: string

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    const { user } = await createTestOwner(tenant.id, tenant.slug, suffix)
    await db.user.update({ where: { id: user.id }, data: { isActive: false } })
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  it('devre dışı kullanıcı → 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: `owner-${suffix}@test.local`, password: 'TestPass12!' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })
})
