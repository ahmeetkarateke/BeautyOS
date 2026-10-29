import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import bcrypt from 'bcryptjs'

// Bu dosya veritabani ve Redis gerektirmez: db sahtelenir.
const dbMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  tenant: { findUnique: vi.fn() },
}))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn() } }))

import { createAuthRouter } from '../routes/auth.route'
import { normalizeEmail, getDummyHash, comparePassword } from '../lib/credentials'
import { strongPassword } from '../lib/password-policy'

beforeEach(() => {
  process.env.JWT_SECRET = 'j'.repeat(40)
  dbMock.user.findFirst.mockReset().mockResolvedValue(null)
})

describe('S7-K2: e-posta normalizasyonu', () => {
  it('bosluk kirpilir ve kucuk harfe cevrilir; buyuk I "i" olur (Turk I tuzagi yok)', () => {
    expect(normalizeEmail('  ISIK.Yilmaz@EXAMPLE.COM ')).toBe('isik.yilmaz@example.com')
    expect(normalizeEmail('INFO@IZMIR.ORG')).toBe('info@izmir.org')
  })
})

describe('S7-K1: sahte hash', () => {
  it('sahte hash gecerli bir bcrypt ozetidir ve gercek kullanici ozetiyle ayni maliyettedir (12)', async () => {
    const hash = await getDummyHash()
    expect(hash).toMatch(/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/)
    expect(bcrypt.getRounds(hash)).toBe(12)
    expect(await getDummyHash()).toBe(hash)
  })

  it('kullanici yoksa gercek bcrypt karsilastirmasi calisir (gecerli sahte hash ile) ve false doner', async () => {
    const spy = vi.spyOn(bcrypt, 'compare')
    expect(await comparePassword('Sifre123', undefined)).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
    const usedHash = spy.mock.calls[0][1] as string
    expect(bcrypt.getRounds(usedHash)).toBe(12)
    spy.mockRestore()
  })

  it('dogru ozetle dogru sifre true doner', async () => {
    const hash = await bcrypt.hash('Sifre123', 12)
    expect(await comparePassword('Sifre123', hash)).toBe(true)
    expect(await comparePassword('Yanlis123', hash)).toBe(false)
  })
})

describe('S7: giris ucu (sahte db)', () => {
  function makeApp() {
    const app = express()
    app.use(express.json())
    app.use('/api/v1/auth', createAuthRouter())
    return app
  }

  it('K1: kayitsiz e-posta ile yanlis sifre ayni yaniti verir ve ikisinde de bcrypt karsilastirmasi yapilir', async () => {
    const real = await bcrypt.hash('DogruSifre1', 12)
    const spy = vi.spyOn(bcrypt, 'compare')
    dbMock.user.findFirst.mockResolvedValueOnce(null)
    const unknown = await request(makeApp()).post('/api/v1/auth/login').send({ email: 'yok@ornek.com', password: 'YanlisSifre1' })
    dbMock.user.findFirst.mockResolvedValueOnce({ id: 'u1', passwordHash: real, tenantId: 't1', tenant: { slug: 's' }, role: 'owner', email: 'var@ornek.com', fullName: 'A' })
    const wrong = await request(makeApp()).post('/api/v1/auth/login').send({ email: 'var@ornek.com', password: 'YanlisSifre1' })
    expect(unknown.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(unknown.body).toEqual(wrong.body)
    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })

  it('K2: giriste e-posta kucuk harfe cevrilir ve buyuk/kucuk harf duyarsiz aranir', async () => {
    await request(makeApp()).post('/api/v1/auth/login').send({ email: 'ISIK@Ornek.COM', password: 'YanlisSifre1' })
    const where = dbMock.user.findFirst.mock.calls[0][0].where
    expect(where.email).toEqual({ equals: 'isik@ornek.com', mode: 'insensitive' })
    expect(where.isActive).toBe(true)
  })

  it('K1: admin-login de kayitsiz kullanicida bcrypt karsilastirmasi yapar ve ayni 401 verir', async () => {
    const spy = vi.spyOn(bcrypt, 'compare')
    const res = await request(makeApp()).post('/api/v1/auth/admin-login').send({ email: 'yok@ornek.com', password: 'YanlisSifre1' })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('K2: sifre sifirlama istegi e-postayi kucuk harfle arar, kayitsizda da 200 doner', async () => {
    const res = await request(makeApp()).post('/api/v1/auth/forgot-password').send({ email: 'YOK@Ornek.com' })
    expect(res.status).toBe(200)
    expect(dbMock.user.findFirst.mock.calls[0][0].where.email).toEqual({ equals: 'yok@ornek.com', mode: 'insensitive' })
  })
})

describe('S7-K4: guclu sifre kurali tek yerde', () => {
  it.each([
    ['Kisa1a', 'en az 8'],
    ['sadeceharfler', 'rakam'],
    ['12345678901', 'harf'],
    ['a1'.repeat(70), 'cok uzun'],
  ])('%s reddedilir (%s)', (value) => {
    expect(strongPassword.safeParse(value).success).toBe(false)
  })

  it('harf ve rakam iceren 8+ karakter kabul edilir', () => {
    expect(strongPassword.safeParse('Sifre1234').success).toBe(true)
  })
})
