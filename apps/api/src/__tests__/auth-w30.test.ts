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
  state.mails = []
  state.tenants = [{ id: 't0', slug: 'dolu-salon' }]
  state.users = [
    { id: 'u0', email: 'sahip@test.local', passwordHash: await bcrypt.hash(PASSWORD, 4), role: 'owner', tenantId: 't0', fullName: 'Sahip', isActive: true },
  ]
})

describe('K-sifre: token # parcasinda (ADR-0046)', () => {
  it('K-sifre: yeni istek ucu baglantiyi #token= ile gonderir, ?token= icermez', async () => {
    const res = await request(makeApp()).post('/api/v1/auth/password-reset/request').send({ email: 'sahip@test.local' })
    expect(res.status).toBe(200)
    expect(state.mails).toHaveLength(1)
    expect(state.mails[0]).toMatch(/^https:\/\/yeni\.test\/reset-password#token=[0-9a-f]{64}$/)
    expect(state.mails[0]).not.toContain('?token=')
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
    const token = state.mails[0].split('#token=')[1]
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

describe('K1/K3: kayitta rizalar (ADR-0048)', () => {
  it('K1: consents.terms false ise 400 ve tenant/kullanici olusmaz', async () => {
    const res = await request(makeApp()).post('/api/v1/auth/register').send({ ...REGISTER, consents: { terms: false } })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.message).toContain('kabul etmeniz gerekir')
    expect(state.tenants).toHaveLength(1)
    expect(state.acceptances).toHaveLength(0)
  })

  it('K1: terms true ise Kullanim Sartlari ve DPA icin ayri kabul satirlari yazilir; K3 verilmediyse pazarlama satiri yok', async () => {
    const res = await request(makeApp()).post('/api/v1/auth/register').send({ ...REGISTER, consents: { terms: true } })
    expect(res.status).toBe(201)
    expect(state.acceptances.map((a) => a.document).sort()).toEqual(['dpa', 'terms'])
    for (const a of state.acceptances) {
      expect(a.tenantId).toBe(state.tenants[1].id)
      expect(a.userId).toBe(state.users[1].id)
      expect(typeof a.version).toBe('string')
    }
  })

  it('K3: marketingEmail true ise ayri marketing_email satiri yazilir', async () => {
    const res = await request(makeApp()).post('/api/v1/auth/register').send({ ...REGISTER, consents: { terms: true, marketingEmail: true } })
    expect(res.status).toBe(201)
    expect(state.acceptances.map((a) => a.document).sort()).toEqual(['dpa', 'marketing_email', 'terms'])
  })

  it('K3: marketingEmail false ise pazarlama satiri yazilmaz', async () => {
    await request(makeApp()).post('/api/v1/auth/register').send({ ...REGISTER, consents: { terms: true, marketingEmail: false } })
    expect(state.acceptances.map((a) => a.document)).not.toContain('marketing_email')
  })

  it('K1: consents alani olmayan eski arayuz kaydi 201 doner, kabul satiri yazmaz', async () => {
    const res = await request(makeApp()).post('/api/v1/auth/register').send(REGISTER)
    expect(res.status).toBe(201)
    expect(state.acceptances).toHaveLength(0)
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
