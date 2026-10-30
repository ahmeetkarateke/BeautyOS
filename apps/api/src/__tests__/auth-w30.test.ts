import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import bcrypt from 'bcryptjs'
import { createFakeSessionDb, matches } from './helpers/fake-session-db'

// W30 / ADR-0046, ADR-0048: #token ile sifre sifirlama, kayitta rizalar, slug uygunluk. db bellek ici sahte.
const state = vi.hoisted(() => ({
  store: null as unknown,
  users: [] as Array<Record<string, unknown>>,
  tenants: [] as Array<Record<string, unknown>>,
  resetTokens: [] as Array<Record<string, unknown>>,
  acceptances: [] as Array<Record<string, unknown>>,
  marketing: [] as Array<Record<string, unknown>>,
  mails: [] as string[],
}))

vi.mock('../lib/email', () => ({
  sendWelcomeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(async (_to: string, link: string) => {
    state.mails.push(link)
    return true
  }),
}))
vi.mock('../lib/anamnesis-seeder', () => ({ seedDefaultAnamnesisQuestions: vi.fn() }))
vi.mock('../lib/db', () => {
  const sessionStore = () => state.store as ReturnType<typeof createFakeSessionDb>
  const db: Record<string, unknown> = {
    get session() {
      return sessionStore().session
    },
    tenant: {
      findUnique: async ({ where }: { where: { slug: string } }) => state.tenants.find((t) => t.slug === where.slug) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const t = { id: `t${state.tenants.length + 1}`, ...data }
        state.tenants.push(t)
        return t
      },
    },
    user: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => state.users.find((u) => matches(u, where as never)) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const u = { id: `u${state.users.length + 1}`, ...data }
        state.users.push(u)
        return u
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const u = state.users.find((x) => x.id === where.id)!
        Object.assign(u, data)
        return u
      },
    },
    legalAcceptance: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        state.acceptances.push(...data)
        return { count: data.length }
      },
    },
    marketingConsent: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        state.marketing.push(...data)
        return { count: data.length }
      },
    },
    passwordResetToken: {
      findUnique: async ({ where }: { where: { token: string } }) => state.resetTokens.find((t) => t.token === where.token) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const t = state.resetTokens.find((x) => x.id === where.id)!
        Object.assign(t, data)
        return t
      },
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.resetTokens.push({ id: `r${state.resetTokens.length + 1}`, usedAt: null, ...data })
        return data
      },
    },
    $transaction: (arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)(db)),
  }
  return { db }
})

import { createAuthRouter } from '../routes/auth.route'

const PASSWORD = 'Guclu1234!'
const REGISTER = {
  salonName: 'Yeni Salon',
  slug: 'yeni-salon',
  ownerFullName: 'Sahip Kisi',
  email: 'yeni@test.local',
  password: PASSWORD,
}

function makeApp(options?: { resetLimitMax?: number; slugCheckLimitMax?: number }) {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/auth', createAuthRouter({ registerLimitMax: 1000, resetLimitMax: 1000, slugCheckLimitMax: 1000, ...options }))
  return app
}

beforeEach(async () => {
  process.env.JWT_SECRET = 'k'.repeat(40)
  process.env.FRONTEND_URL = 'https://yeni.test'
  state.store = createFakeSessionDb()
  state.resetTokens = []
  state.acceptances = []
  state.marketing = []
  state.mails = []
  state.tenants = [{ id: 't0', slug: 'dolu-salon' }]
  state.users = [
    { id: 'u0', email: 'sahip@test.local', passwordHash: await bcrypt.hash(PASSWORD, 4), role: 'owner', tenantId: 't0', fullName: 'Sahip', isActive: true },
  ]
})

describe('K-sifre: token # parcasinda (ADR-0046)', () => {
  it('K-sifre: yeni istek ucu baglantiyi #<token> ile gonderir, ?token= icermez', async () => {
    const res = await request(makeApp()).post('/api/v1/auth/password-reset/request').send({ email: 'sahip@test.local' })
    expect(res.status).toBe(200)
    expect(state.mails).toHaveLength(1)
    expect(state.mails[0]).toMatch(/^https:\/\/yeni\.test\/reset-password#[0-9a-f]{64}$/)
    expect(state.mails[0]).not.toContain('?token=')
    expect(state.mails[0]).not.toContain('#token=')
  })

  it('K-sifre: eski forgot-password ucu ?token= baglantisini korur (canli eski arayuz)', async () => {
    await request(makeApp()).post('/api/v1/auth/forgot-password').send({ email: 'sahip@test.local' })
    expect(state.mails[0]).toMatch(/\/reset-password\?token=[0-9a-f]{64}$/)
  })

  it('K-sifre: kayitsiz e-posta ayni 200 govdeyi alir ve e-posta gitmez', async () => {
    const known = await request(makeApp()).post('/api/v1/auth/password-reset/request').send({ email: 'sahip@test.local' })
    const unknown = await request(makeApp()).post('/api/v1/auth/password-reset/request').send({ email: 'yok@test.local' })
    expect(unknown.status).toBe(known.status)
    expect(unknown.body).toEqual(known.body)
    expect(state.mails).toHaveLength(1)
  })

  it('K-sifre: confirm gövdedeki token ile sifreyi degistirir; ayni token ikinci kez 400 INVALID_TOKEN', async () => {
    const app = makeApp()
    await request(app).post('/api/v1/auth/password-reset/request').send({ email: 'sahip@test.local' })
    const token = state.mails[0].split('#')[1]
    const ok = await request(app).post('/api/v1/auth/password-reset/confirm').send({ token, password: 'Yepyeni1234' })
    expect(ok.status).toBe(200)
    expect(await bcrypt.compare('Yepyeni1234', state.users[0].passwordHash as string)).toBe(true)
    const again = await request(app).post('/api/v1/auth/password-reset/confirm').send({ token, password: 'Baska1234567' })
    expect(again.status).toBe(400)
    expect(again.body.error.code).toBe('INVALID_TOKEN')
  })

  it('K-sifre: confirm tanimsiz token ile 400 INVALID_TOKEN', async () => {
    const res = await request(makeApp()).post('/api/v1/auth/password-reset/confirm').send({ token: 'x'.repeat(64), password: PASSWORD })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('K-sifre: request ucu hiz sinirina takilir (429 RATE_LIMIT)', async () => {
    const app = makeApp({ resetLimitMax: 2 })
    const send = () => request(app).post('/api/v1/auth/password-reset/request').send({ email: 'sahip@test.local' })
    await send()
    await send()
    const third = await send()
    expect(third.status).toBe(429)
    expect(third.body.error.code).toBe('RATE_LIMIT')
  })
})

const V = { termsVersion: '2026-10-30', dpaVersion: '2026-10-30', labelVersion: '2026-10-30' }
const consentsOf = (extra: Record<string, unknown> = {}) => ({ terms: true, ...V, ...extra })
const register = (consents: unknown, ua = 'TestAgent/1.0') =>
  request(makeApp()).post('/api/v1/auth/register').set('User-Agent', ua).send({ ...REGISTER, consents })

describe('K1/K3: kayitta rizalar (ADR-0048, hukuk-uyum W30-1)', () => {
  it('K1: consents.terms false ise 400 ve tenant/kullanici olusmaz', async () => {
    const res = await register(consentsOf({ terms: false }))
    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('kabul etmeniz gerekir')
    expect(state.tenants).toHaveLength(1)
    expect(state.acceptances).toHaveLength(0)
  })

  it('K1: eski sartlar surumuyle gelen istek 400 LEGAL_VERSION_MISMATCH, kayit olusmaz', async () => {
    const res = await register(consentsOf({ termsVersion: '2020-01-01' }))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('LEGAL_VERSION_MISMATCH')
    expect(state.tenants).toHaveLength(1)
  })

  it('K1: eski DPA surumuyle gelen istek 400 LEGAL_VERSION_MISMATCH', async () => {
    const res = await register(consentsOf({ dpaVersion: '2020-01-01' }))
    expect(res.body.error.code).toBe('LEGAL_VERSION_MISMATCH')
  })

  it('K1: surum alanlari eksikse 400', async () => {
    const res = await register({ terms: true })
    expect(res.status).toBe(400)
    expect(state.tenants).toHaveLength(1)
  })

  it('K1: basarili kayitta terms ve dpa icin iki kabul satiri, sunucu alanlariyla (kanal, ip, user-agent, etiket surumu)', async () => {
    const res = await register(consentsOf())
    expect(res.status).toBe(201)
    expect(state.acceptances).toHaveLength(2)
    expect(state.acceptances.map((a) => a.documentType).sort()).toEqual(['dpa', 'terms'])
    for (const a of state.acceptances) {
      expect(a).toMatchObject({ tenantId: state.tenants[1].id, userId: state.users[1].id, documentVersion: V.termsVersion, channel: 'signup', labelVersion: V.labelVersion, userAgent: 'TestAgent/1.0' })
      expect(typeof a.ipAddress).toBe('string')
    }
  })

  it('K3: marketingEmail true ise marketing_consents tablosuna tek granted satiri', async () => {
    const res = await register(consentsOf({ marketingEmail: true }))
    expect(res.status).toBe(201)
    expect(state.marketing).toHaveLength(1)
    expect(state.marketing[0]).toMatchObject({ userId: state.users[1].id, channel: 'email', status: 'granted', source: 'signup_form', userAgent: 'TestAgent/1.0' })
    expect(typeof state.marketing[0].consentTextVersion).toBe('string')
    expect(state.acceptances.map((a) => a.documentType)).not.toContain('marketing_email')
  })

  it('K3: marketingEmail false ise 0 izin satiri', async () => {
    await register(consentsOf({ marketingEmail: false }))
    expect(state.marketing).toHaveLength(0)
  })

  it('K1: consents alani olmayan eski arayuz kaydi 201 doner, kabul ve izin satiri yazmaz', async () => {
    const res = await request(makeApp()).post('/api/v1/auth/register').send(REGISTER)
    expect(res.status).toBe(201)
    expect(state.acceptances).toHaveLength(0)
    expect(state.marketing).toHaveLength(0)
  })

  it('K-surum: GET /legal-versions guncel surum sabitlerini kimliksiz doner', async () => {
    const res = await request(makeApp()).get('/api/v1/auth/legal-versions')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject(V)
    expect(typeof res.body.marketingTextVersion).toBe('string')
  })
})

describe('K-slug: salon adresi uygunluk ucu', () => {
  it('K-slug: bos adres available true doner (kimliksiz)', async () => {
    const res = await request(makeApp()).get('/api/v1/auth/slug-available').query({ slug: 'bos-salon' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ available: true })
  })

  it('K-slug: kayitli adres taken doner', async () => {
    const res = await request(makeApp()).get('/api/v1/auth/slug-available').query({ slug: 'dolu-salon' })
    expect(res.body).toEqual({ available: false, reason: 'taken' })
  })

  it('K-slug: bicimi bozuk adres (buyuk I dahil) invalid doner, sorguya gitmez', async () => {
    const res = await request(makeApp()).get('/api/v1/auth/slug-available').query({ slug: 'DOLU-SALoN' })
    expect(res.body).toEqual({ available: false, reason: 'invalid' })
  })

  it('K-slug: slug parametresi yoksa invalid', async () => {
    const res = await request(makeApp()).get('/api/v1/auth/slug-available')
    expect(res.body).toEqual({ available: false, reason: 'invalid' })
  })

  it('K-slug: hiz sinirina takilir (429 RATE_LIMIT)', async () => {
    const app = makeApp({ slugCheckLimitMax: 2 })
    const get = () => request(app).get('/api/v1/auth/slug-available').query({ slug: 'bos-salon' })
    await get()
    await get()
    const third = await get()
    expect(third.status).toBe(429)
    expect(third.body.error.code).toBe('RATE_LIMIT')
  })
})
