import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Bu dosya veritabanı ve Redis gerektirmez: db, sms ve kuyruk sahtelenir.
const dbMock = vi.hoisted(() => ({
  phoneVerification: {
    findFirst: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  tenant: { findUnique: vi.fn() },
}))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn() } }))
vi.mock('../lib/sms', () => ({
  normalizePhoneTR: (p: string) => (/^\+?[0-9]{10,13}$/.test(p) ? '+905551112233' : null),
  sendSms: vi.fn().mockResolvedValue({ result: { success: true } }),
  getSmsProvider: () => ({ send: vi.fn().mockResolvedValue({ success: true }) }),
}))

import { sendVerificationCode } from '../lib/phone-verification'
import { allowedTurnstileHosts, isTurnstileUnavailable, verifyTurnstile } from '../lib/turnstile'
import { createPublicRouter } from '../routes/public.route'

const ENV_KEYS = ['NODE_ENV', 'NETGSM_USERCODE', 'TURNSTILE_SECRET_KEY', 'ALLOWED_ORIGINS', 'FRONTEND_URL', 'JWT_SECRET'] as const
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  dbMock.phoneVerification.findFirst.mockReset().mockResolvedValue(null)
  dbMock.phoneVerification.create.mockReset().mockResolvedValue({})
  dbMock.phoneVerification.count.mockReset().mockResolvedValue(0)
  process.env.JWT_SECRET = 'j'.repeat(40)
  dbMock.tenant.findUnique.mockReset().mockResolvedValue({ id: 't1', name: 'Salon', settings: {}, isActive: true })
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
  vi.unstubAllGlobals()
})

describe('Telefon doğrulama kodu: üretimde devCode yok', () => {
  it('sağlayıcı yokken üretimde SMS_UNAVAILABLE döner, kod kaydı oluşturulmaz', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.NETGSM_USERCODE

    const result = await sendVerificationCode({ phone: '05551112233', tenantId: 't1' })

    expect(result).toMatchObject({ ok: false, error: 'SMS_UNAVAILABLE' })
    expect(JSON.stringify(result)).not.toMatch(/devCode/)
    expect(dbMock.phoneVerification.create).not.toHaveBeenCalled()
  })

  it('üretimde sağlayıcı varsa devCode döndürmez', async () => {
    process.env.NODE_ENV = 'production'
    process.env.NETGSM_USERCODE = 'x'

    const result = await sendVerificationCode({ phone: '05551112233', tenantId: 't1' })

    expect(result).toEqual({ ok: true, devCode: undefined })
  })

  it('geliştirmede sahte sağlayıcıyla devCode döner', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.NETGSM_USERCODE

    const result = await sendVerificationCode({ phone: '05551112233', tenantId: 't1' })

    expect(result).toMatchObject({ ok: true })
    expect((result as { devCode?: string }).devCode).toMatch(/^\d{6}$/)
  })

  it('/verify/send üretimde sağlayıcısız 503 döner ve gövdede devCode yoktur', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.NETGSM_USERCODE
    const app = express()
    app.use(express.json())
    app.use('/api/v1/tenants/:slug/public', createPublicRouter())

    const res = await request(app).post('/api/v1/tenants/salon/public/verify/send').send({ phone: '05551112233' })

    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('SMS_UNAVAILABLE')
    expect(res.body.error.message).toMatch(/kullanılamıyor/)
    expect(JSON.stringify(res.body)).not.toMatch(/devCode/)
  })
})

describe('Turnstile siteverify hostname denetimi', () => {
  function stubSiteverify(body: object) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => body }))
  }

  beforeEach(() => {
    process.env.NODE_ENV = 'production'
    process.env.TURNSTILE_SECRET_KEY = 'gizli'
    process.env.ALLOWED_ORIGINS = 'https://app.beautyossapp.com, https://www.beautyossapp.com'
    process.env.FRONTEND_URL = 'https://beautyossapp.com'
  })

  it('izinli host ile çözülen token kabul edilir (büyük I içeren host dahil)', async () => {
    stubSiteverify({ success: true, hostname: 'APP.BEAUTYOSSAPP.COM' })
    expect(await verifyTurnstile('tok', '1.2.3.4')).toBe(true)
  })

  it('başka ortamın hostunda çözülen token reddedilir (yeni. staging)', async () => {
    stubSiteverify({ success: true, hostname: 'yeni.beautyossapp.com' })
    expect(await verifyTurnstile('tok', undefined)).toBe(false)
  })

  it('hostname yanıtta yoksa reddedilir', async () => {
    stubSiteverify({ success: true })
    expect(await verifyTurnstile('tok', undefined)).toBe(false)
  })

  it('success false ise izinli host olsa da reddedilir', async () => {
    stubSiteverify({ success: false, hostname: 'app.beautyossapp.com' })
    expect(await verifyTurnstile('tok', undefined)).toBe(false)
  })

  it('izinli host listesi üretimde boşsa reddedilir', async () => {
    delete process.env.ALLOWED_ORIGINS
    delete process.env.FRONTEND_URL
    stubSiteverify({ success: true, hostname: 'app.beautyossapp.com' })
    expect(await verifyTurnstile('tok', undefined)).toBe(false)
  })

  it('S2-K4: siteverify 5 sn icinde yanit vermezse istek iptal edilir ve dogrulama basarisiz sayilir', async () => {
    let seenSignal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: { signal: AbortSignal }) => {
        seenSignal = init.signal
        return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
      }),
    )
    expect(await verifyTurnstile('tok', undefined, 20)).toBe(false)
    expect(seenSignal?.aborted).toBe(true)
  })

  it('S2-K4: isTurnstileUnavailable yalniz uretimde gizli anahtar yokken true', () => {
    delete process.env.TURNSTILE_SECRET_KEY
    expect(isTurnstileUnavailable()).toBe(true)
    process.env.NODE_ENV = 'development'
    expect(isTurnstileUnavailable()).toBe(false)
    process.env.NODE_ENV = 'production'
    process.env.TURNSTILE_SECRET_KEY = 'gizli'
    expect(isTurnstileUnavailable()).toBe(false)
  })

  it('allowedTurnstileHosts adresleri host adına çevirir, geçersizleri atlar', () => {
    expect(
      allowedTurnstileHosts({ ALLOWED_ORIGINS: 'https://A.example.com:3000,not a url,', FRONTEND_URL: 'https://b.example.com/x' } as NodeJS.ProcessEnv).sort(),
    ).toEqual(['a.example.com', 'b.example.com'])
  })
})
