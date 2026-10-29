import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Resend ve logger sahtelenir: ag ve Redis gerekmez.
const sendMock = vi.hoisted(() => vi.fn())
const logMock = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))
vi.mock('../lib/logger', () => ({ logger: logMock }))

import { sendPasswordResetEmail, sendWelcomeEmail } from '../lib/email'

const ADDRESS = 'IŞIK.Yılmaz@Örnek.com'
const TOKEN = 'gizli-sifirlama-jetonu-0123456789'
const LINK = `https://app.beautyossapp.com/reset-password?token=${TOKEN}`

const ENV_KEYS = ['RESEND_API_KEY', 'NODE_ENV'] as const
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  process.env.RESEND_API_KEY = 're_test'
  process.env.NODE_ENV = 'test'
  sendMock.mockReset().mockResolvedValue({ data: { id: 'e1' }, error: null })
  logMock.error.mockReset()
  logMock.warn.mockReset()
  logMock.info.mockReset()
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

function allLogged(): string {
  return JSON.stringify([logMock.error.mock.calls, logMock.warn.mock.calls, logMock.info.mock.calls])
}

describe('S4-K2: e-posta gonderim hatasi yutulmaz', () => {
  it('basarili gonderim true doner ve error loglanmaz', async () => {
    expect(await sendPasswordResetEmail(ADDRESS, LINK)).toBe(true)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(logMock.error).not.toHaveBeenCalled()
  })

  it('Resend hata dondurunce (throw etmeden) false doner ve error duzeyinde loglanir', async () => {
    sendMock.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'domain not verified', statusCode: 403 } })
    expect(await sendPasswordResetEmail(ADDRESS, LINK)).toBe(false)
    expect(logMock.error).toHaveBeenCalledTimes(1)
    const [fields] = logMock.error.mock.calls[0]
    expect(fields).toMatchObject({ kind: 'password_reset', code: 'validation_error', status: 403 })
  })

  it('ag hatasi (throw) yutulmaz: false doner ve error loglanir', async () => {
    sendMock.mockRejectedValue(new Error('ECONNRESET'))
    expect(await sendWelcomeEmail(ADDRESS, 'Salon', new Date('2026-12-01T00:00:00Z'))).toBe(false)
    expect(logMock.error).toHaveBeenCalledTimes(1)
    expect(logMock.error.mock.calls[0][0]).toMatchObject({ kind: 'welcome' })
  })

  it('log hicbir durumda adres ya da sifirlama jetonu icermez (buyuk I ve Turkce harfli adres dahil)', async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { name: 'x', message: `invalid to ${ADDRESS} ${LINK}`, statusCode: 422 } })
    await sendPasswordResetEmail(ADDRESS, LINK)
    sendMock.mockRejectedValueOnce(new Error(`failed for ${ADDRESS} at ${LINK}`))
    await sendPasswordResetEmail(ADDRESS, LINK)
    await sendWelcomeEmail(ADDRESS, 'Salon', new Date())
    const logged = allLogged()
    expect(logged).not.toContain('Örnek')
    expect(logged.toLowerCase()).not.toContain('ışık')
    expect(logged).not.toContain(TOKEN)
    expect(logged).not.toContain('reset-password')
  })

  it('anahtar yokken false doner; uretimde error, digerinde warn duzeyinde (adresi yazmadan)', async () => {
    delete process.env.RESEND_API_KEY
    process.env.NODE_ENV = 'production'
    expect(await sendPasswordResetEmail(ADDRESS, LINK)).toBe(false)
    expect(logMock.error).toHaveBeenCalledTimes(1)
    expect(sendMock).not.toHaveBeenCalled()

    logMock.error.mockReset()
    process.env.NODE_ENV = 'development'
    expect(await sendPasswordResetEmail(ADDRESS, LINK)).toBe(false)
    expect(logMock.error).not.toHaveBeenCalled()
    expect(logMock.warn).toHaveBeenCalledTimes(1)
    expect(allLogged()).not.toContain('Örnek')
  })
})
