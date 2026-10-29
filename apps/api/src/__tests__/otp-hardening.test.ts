import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Veritabani ve Redis gerektirmez: db, sms ve kuyruk sahtelenir.
const dbMock = vi.hoisted(() => ({
  phoneVerification: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  tenant: { findUnique: vi.fn() },
}))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn() } }))
vi.mock('../lib/sms', () => ({
  normalizePhoneTR: (p: string) => (/^\+?[0-9]{10,13}$/.test(p) ? '+905551112233' : null),
  sendSms: vi.fn().mockResolvedValue({ result: { success: true } }),
  getSmsProvider: () => ({ send: vi.fn().mockResolvedValue({ success: true }) }),
}))

import { sendVerificationCode, verifyCode, hashCode } from '../lib/phone-verification'
import { createPublicRouter } from '../routes/public.route'

const ENV_KEYS = ['NODE_ENV', 'NETGSM_USERCODE', 'JWT_SECRET'] as const
let saved: Record<string, string | undefined>
const PHONE = '+905551112233'

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  process.env.JWT_SECRET = 'j'.repeat(40)
  process.env.NODE_ENV = 'development'
  delete process.env.NETGSM_USERCODE
  dbMock.phoneVerification.findFirst.mockReset().mockResolvedValue(null)
  dbMock.phoneVerification.create.mockReset().mockResolvedValue({})
  dbMock.phoneVerification.count.mockReset().mockResolvedValue(0)
  dbMock.phoneVerification.updateMany.mockReset().mockResolvedValue({ count: 1 })
  dbMock.tenant.findUnique.mockReset().mockResolvedValue({ id: 't1', name: 'Salon', settings: {}, isActive: true })
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

function storedRecord(code: string, overrides: Record<string, unknown> = {}) {
  return { id: 'pv1', code: hashCode(PHONE, code), expiresAt: new Date(Date.now() + 60_000), attempts: 0, ...overrides }
}

describe('S2-K7: OTP saklama ve uretim', () => {
  it('kod veritabanina duz metin degil HMAC ozeti olarak yazilir', async () => {
    const result = await sendVerificationCode({ phone: '05551112233', tenantId: 't1' })
    expect(result).toMatchObject({ ok: true })
    const code = (result as { devCode: string }).devCode
    const stored = dbMock.phoneVerification.create.mock.calls[0][0].data.code
    expect(stored).not.toBe(code)
    expect(stored).toBe(hashCode(PHONE, code))
    expect(stored).toMatch(/^[0-9a-f]{64}$/)
  })

  it('ozet telefona ve gizli anahtara baglidir (baska telefonun ozeti ayni kodla farkli)', () => {
    expect(hashCode(PHONE, '123456')).not.toBe(hashCode('+905550000000', '123456'))
    const before = hashCode(PHONE, '123456')
    process.env.JWT_SECRET = 'k'.repeat(40)
    expect(hashCode(PHONE, '123456')).not.toBe(before)
  })

  it('kod 6 haneli ve kriptografik rastgeledir (ilk hane 0 olmaz, 200 uretim hepsi 6 hane)', async () => {
    for (let i = 0; i < 200; i++) {
      dbMock.phoneVerification.create.mockClear()
      const r = (await sendVerificationCode({ phone: '05551112233', tenantId: 't1' })) as { devCode: string }
      expect(r.devCode).toMatch(/^[1-9][0-9]{5}$/)
    }
  })

  it('telefon basina saatte 5 gonderim: 6. istek TOO_SOON, kod uretilmez', async () => {
    dbMock.phoneVerification.count.mockResolvedValue(5)
    const result = await sendVerificationCode({ phone: '05551112233', tenantId: 't1' })
    expect(result).toMatchObject({ ok: false, error: 'TOO_SOON' })
    expect(dbMock.phoneVerification.create).not.toHaveBeenCalled()
    const where = dbMock.phoneVerification.count.mock.calls[0][0].where
    expect(where.phone).toBe(PHONE)
    expect(where.createdAt.gte.getTime()).toBeGreaterThan(Date.now() - 60 * 60 * 1000 - 5000)
  })

  it('saatte 4 gonderimde (sinirin hemen alti) gonderim yapilir', async () => {
    dbMock.phoneVerification.count.mockResolvedValue(4)
    expect(await sendVerificationCode({ phone: '05551112233', tenantId: 't1' })).toMatchObject({ ok: true })
  })
})

describe('S2-K7: OTP dogrulama', () => {
  it('dogru kod kabul edilir ve tek kullanimlik isaretlenir (atomik, consumedAt null kosulu)', async () => {
    dbMock.phoneVerification.findFirst.mockResolvedValue(storedRecord('654321'))
    const result = await verifyCode({ phone: '05551112233', code: '654321' })
    expect(result).toEqual({ ok: true, phone: PHONE })
    const consume = dbMock.phoneVerification.updateMany.mock.calls.find((c) => c[0].data.consumedAt)
    expect(consume![0].where).toMatchObject({ id: 'pv1', consumedAt: null })
  })

  it('iki es zamanli dogru istekten ikincisi reddedilir (tuketme 0 satir etkiler)', async () => {
    dbMock.phoneVerification.findFirst.mockResolvedValue(storedRecord('654321'))
    dbMock.phoneVerification.updateMany
      .mockResolvedValueOnce({ count: 1 }) // deneme sayaci
      .mockResolvedValueOnce({ count: 0 }) // baska istek kodu zaten tuketti
    const result = await verifyCode({ phone: '05551112233', code: '654321' })
    expect(result).toMatchObject({ ok: false, error: 'NO_CODE' })
  })

  it('yanlis kod INVALID_CODE doner; sayac deneme yapilmadan once atomik artar (attempts < 5 kosuluyla)', async () => {
    dbMock.phoneVerification.findFirst.mockResolvedValue(storedRecord('654321'))
    const result = await verifyCode({ phone: '05551112233', code: '111111' })
    expect(result).toMatchObject({ ok: false, error: 'INVALID_CODE' })
    const counter = dbMock.phoneVerification.updateMany.mock.calls[0][0]
    expect(counter.where).toMatchObject({ id: 'pv1', attempts: { lt: 5 } })
    expect(counter.data).toEqual({ attempts: { increment: 1 } })
  })

  it('es zamanli yanlis denemelerde sayac sinirina ulasmissa (guncellenen satir 0) dogru kod bile TOO_MANY_ATTEMPTS alir', async () => {
    dbMock.phoneVerification.findFirst.mockResolvedValue(storedRecord('654321'))
    dbMock.phoneVerification.updateMany.mockResolvedValueOnce({ count: 0 })
    const result = await verifyCode({ phone: '05551112233', code: '654321' })
    expect(result).toMatchObject({ ok: false, error: 'TOO_MANY_ATTEMPTS' })
    expect(dbMock.phoneVerification.updateMany).toHaveBeenCalledTimes(1)
  })

  it('suresi dolmus kod EXPIRED, sayac artirilmaz', async () => {
    dbMock.phoneVerification.findFirst.mockResolvedValue(storedRecord('654321', { expiresAt: new Date(Date.now() - 1000) }))
    expect(await verifyCode({ phone: '05551112233', code: '654321' })).toMatchObject({ ok: false, error: 'EXPIRED' })
    expect(dbMock.phoneVerification.updateMany).not.toHaveBeenCalled()
  })

  it('ozet uzunlugu farkli ya da bozuk saklanmis deger hata vermez, INVALID_CODE doner', async () => {
    dbMock.phoneVerification.findFirst.mockResolvedValue(storedRecord('654321', { code: '123456' }))
    expect(await verifyCode({ phone: '05551112233', code: '123456' })).toMatchObject({ ok: false, error: 'INVALID_CODE' })
  })
})

describe('S2-K7: /verify/confirm hiz siniri', () => {
  function makeApp() {
    const app = express()
    app.set('trust proxy', 1)
    app.use(express.json())
    app.use('/api/v1/tenants/:slug/public', createPublicRouter())
    return app
  }

  it('ayni IP 15 dakikada 20 confirm denemesi yapabilir, 21. istek 429 RATE_LIMIT', async () => {
    dbMock.phoneVerification.findFirst.mockResolvedValue(null)
    const app = makeApp()
    for (let i = 0; i < 20; i++) {
      const res = await request(app).post('/api/v1/tenants/salon/public/verify/confirm').send({ phone: '05551112233', code: '123456' })
      expect(res.status).toBe(400)
    }
    const res = await request(app).post('/api/v1/tenants/salon/public/verify/confirm').send({ phone: '05551112233', code: '123456' })
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMIT')
  })
})
