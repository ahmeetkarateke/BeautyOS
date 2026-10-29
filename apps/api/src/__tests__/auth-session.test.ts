import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createFakeSessionDb, matches } from './helpers/fake-session-db'

// S6: giris / yenileme / cikis / sifirlama uclari sunucu tarafli oturumla. db bellek ici sahte; DB/Redis gerekmez.
const state = vi.hoisted(() => ({
  store: null as unknown,
  users: [] as Array<Record<string, unknown>>,
  resetTokens: [] as Array<Record<string, unknown>>,
  chain: Promise.resolve() as Promise<void>,
}))

vi.mock('../lib/email', () => ({ sendWelcomeEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }))
vi.mock('../lib/anamnesis-seeder', () => ({ seedDefaultAnamnesisQuestions: vi.fn() }))
vi.mock('../lib/db', () => {
  type Store = ReturnType<typeof createFakeSessionDb>
  const sessionStore = () => state.store as Store
  const db = {
    get session() {
      return sessionStore().session
    },
    user: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => state.users.find((u) => matches(u, where as never)) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const u = state.users.find((x) => x.id === where.id)!
        Object.assign(u, data)
        return u
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
    $transaction: (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg)
      const run = state.chain.then(() => (arg as (tx: unknown) => Promise<unknown>)(db))
      state.chain = run.then(() => undefined, () => undefined)
      return run
    },
  }
  return { db }
})

import { createAuthRouter } from '../routes/auth.route'

const SECRET = 'k'.repeat(40)
const PASSWORD = 'Guclu1234!'
let hash: string

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/auth', createAuthRouter({ registerLimitMax: 1000 }))
  return app
}
const store = () => state.store as ReturnType<typeof createFakeSessionDb>
const cookieOf = (res: request.Response): string => {
  const raw = (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith('refreshToken=')) ?? ''
  return raw
}
const tokenFrom = (setCookie: string) => decodeURIComponent(setCookie.split(';')[0].slice('refreshToken='.length))
const withCookie = (t: string) => ({ Cookie: `refreshToken=${encodeURIComponent(t)}` })

beforeEach(async () => {
  process.env.JWT_SECRET = SECRET
  state.store = createFakeSessionDb()
  state.resetTokens = []
  hash ??= await bcrypt.hash(PASSWORD, 4)
  state.users = [
    { id: 'u1', email: 'sahip@test.local', passwordHash: hash, role: 'owner', tenantId: 't1', fullName: 'Sahip', isActive: true, tenant: { slug: 'salon' } },
    { id: 'u2', email: 'root@test.local', passwordHash: hash, role: 'superadmin', tenantId: null, fullName: 'Root', isActive: true, tenant: null },
  ]
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const login = (app: express.Express) => request(app).post('/api/v1/auth/login').send({ email: 'sahip@test.local', password: PASSWORD })

describe('K1/K4: giris', () => {
  it('K1: giris opak (JWT olmayan) yenileme token\'i ve hash\'li oturum satiri olusturur; erisim token\'inda sid claim\'i var', async () => {
    const res = await login(makeApp())
    expect(res.status).toBe(200)
    const cookie = tokenFrom(cookieOf(res))
    expect(cookie.split('.').length).toBe(1)
    expect(store().rows).toHaveLength(1)
    expect(store().rows[0].tokenHash).not.toBe(cookie)
    const payload = jwt.decode(res.body.token) as Record<string, unknown>
    expect(payload.sid).toBe(store().rows[0].familyId)
    expect(payload).toMatchObject({ userId: 'u1', tenantSlug: 'salon', role: 'owner' })
  })

  it('K4: cerez HttpOnly, SameSite=Lax ve yolu /api/v1/auth (uretimde de Lax, Secure)', async () => {
    for (const env of ['test', 'production']) {
      vi.stubEnv('NODE_ENV', env)
      const c = cookieOf(await login(makeApp()))
      expect(c, env).toMatch(/HttpOnly/i)
      expect(c, env).toMatch(/SameSite=Lax/i)
      expect(c, env).not.toMatch(/SameSite=None/i)
      expect(c, env).toMatch(/Path=\/api\/v1\/auth/)
      if (env === 'production') expect(c).toMatch(/Secure/i)
    }
  })

  it('K6: erisim token\'i ayni yuzeyden donen bicimde (token + user) kalir (eski ve v2 istemci sozlesmesi)', async () => {
    const res = await login(makeApp())
    expect(res.body).toMatchObject({ user: { id: 'u1', role: 'owner', tenantSlug: 'salon' } })
    expect(typeof res.body.token).toBe('string')
  })
})

describe('K1: yenileme', () => {
  it('K1: yenileme token\'i dondurur ve yeni erisim token\'i ayni sid\'i tasir', async () => {
    const app = makeApp()
    const first = await login(app)
    const t1 = tokenFrom(cookieOf(first))
    const res = await request(app).post('/api/v1/auth/refresh').set(withCookie(t1))
    expect(res.status).toBe(200)
    const t2 = tokenFrom(cookieOf(res))
    expect(t2).not.toBe(t1)
    expect((jwt.decode(res.body.token) as Record<string, unknown>).sid).toBe((jwt.decode(first.body.token) as Record<string, unknown>).sid)
  })

  it('K1: eski token yeniden kullanilirsa 401 ve yeni token da olur (aile iptali)', async () => {
    const app = makeApp()
    const t1 = tokenFrom(cookieOf(await login(app)))
    const second = await request(app).post('/api/v1/auth/refresh').set(withCookie(t1))
    const t2 = tokenFrom(cookieOf(second))
    expect((await request(app).post('/api/v1/auth/refresh').set(withCookie(t1))).status).toBe(401)
    expect((await request(app).post('/api/v1/auth/refresh').set(withCookie(t2))).status).toBe(401)
  })

  it('K1: eski bicim (imzali JWT) yenileme cerezi kabul edilmez', async () => {
    const legacy = jwt.sign({ userId: 'u1', type: 'refresh' }, SECRET, { expiresIn: '30d' })
    const res = await request(makeApp()).post('/api/v1/auth/refresh').set(withCookie(legacy))
    expect(res.status).toBe(401)
  })

  it('K1: cerezsiz istek 401', async () => {
    expect((await request(makeApp()).post('/api/v1/auth/refresh')).status).toBe(401)
  })

  it('K3: pasiflestirilmis kullanici yenileme yapamaz ve ailesi kapanir', async () => {
    const app = makeApp()
    const t1 = tokenFrom(cookieOf(await login(app)))
    state.users[0].isActive = false
    expect((await request(app).post('/api/v1/auth/refresh').set(withCookie(t1))).status).toBe(401)
    expect(store().rows.every((r) => r.revokedAt !== null)).toBe(true)
  })
})

describe('K2: cikis ve sifirlama', () => {
  it('K2: cikis ailesini kapatir; cerez ayni yol ve SameSite=Lax ile silinir', async () => {
    const app = makeApp()
    const t1 = tokenFrom(cookieOf(await login(app)))
    const out = await request(app).post('/api/v1/auth/logout').set(withCookie(t1))
    expect(out.status).toBe(200)
    expect(cookieOf(out)).toMatch(/Path=\/api\/v1\/auth/)
    expect(cookieOf(out)).toMatch(/SameSite=Lax/i)
    expect((await request(app).post('/api/v1/auth/refresh').set(withCookie(t1))).status).toBe(401)
  })

  it('K2: sifre sifirlama kullanicinin tum oturumlarini kapatir (diger kullaniciya dokunmaz)', async () => {
    const app = makeApp()
    const t1 = tokenFrom(cookieOf(await login(app)))
    const adminToken = tokenFrom(cookieOf(await request(app).post('/api/v1/auth/admin-login').send({ email: 'root@test.local', password: PASSWORD })))
    state.resetTokens.push({ id: 'r1', token: (await import('node:crypto')).createHash('sha256').update('ham-token').digest('hex'), userId: 'u1', expiresAt: new Date(Date.now() + 3600_000), usedAt: null })
    const res = await request(app).post('/api/v1/auth/reset-password').send({ token: 'ham-token', password: 'YeniGuclu123!' })
    expect(res.status).toBe(200)
    expect((await request(app).post('/api/v1/auth/refresh').set(withCookie(t1))).status).toBe(401)
    expect((await request(app).post('/api/v1/auth/refresh').set(withCookie(adminToken))).status).toBe(200)
  })
})

describe('K5: superadmin 15 dakika', () => {
  it('K5: admin-login erisim token\'i 15 dakika (7 gun degil), oturum kiraciya bagli degil', async () => {
    const res = await request(makeApp()).post('/api/v1/auth/admin-login').send({ email: 'root@test.local', password: PASSWORD })
    expect(res.status).toBe(200)
    const p = jwt.decode(res.body.token) as { exp: number; iat: number; sid: string }
    expect(p.exp - p.iat).toBe(15 * 60)
    expect(store().rows[0].tenantId).toBeNull()
    expect(p.sid).toBe(store().rows[0].familyId)
  })

  it('K5: superadmin yenilemesi de 15 dakikalik token verir ve kiraci alani yoktur', async () => {
    const app = makeApp()
    const t = tokenFrom(cookieOf(await request(app).post('/api/v1/auth/admin-login').send({ email: 'root@test.local', password: PASSWORD })))
    const res = await request(app).post('/api/v1/auth/refresh').set(withCookie(t))
    const p = jwt.decode(res.body.token) as Record<string, number | string | undefined>
    expect((p.exp as number) - (p.iat as number)).toBe(15 * 60)
    expect(p.role).toBe('superadmin')
    expect(p.tenantId).toBeUndefined()
  })
})
