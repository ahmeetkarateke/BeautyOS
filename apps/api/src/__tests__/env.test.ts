import { describe, it, expect } from 'vitest'
import { checkEnv, describeEnvProblems } from '../lib/env'

const full = {
  DATABASE_URL: 'postgresql://u:p@db:5432/x',
  REDIS_URL: 'redis://redis:6379',
  JWT_SECRET: 'x'.repeat(32),
  ALLOWED_ORIGINS: 'https://app.beautyossapp.com',
  PUBLIC_URL: 'https://api.beautyossapp.com',
  FRONTEND_URL: 'https://app.beautyossapp.com',
}

describe('G5-K1: uretimde zorunlu ortam degiskenleri', () => {
  it('K1: hepsi tamamsa sorun yok', () => {
    expect(describeEnvProblems(checkEnv(full, true))).toBeNull()
  })

  it.each(Object.keys(full))('K1: %s eksikse yalniz adi raporlanir (deger yazilmaz)', (name) => {
    const env = { ...full, [name]: undefined }
    const report = checkEnv(env, true)
    expect(report.missing).toEqual([name])
    const text = describeEnvProblems(report)!
    expect(text).toContain(name)
    expect(text).not.toContain('postgresql://')
  })

  it('K1: bosluktan olusan deger eksik sayilir', () => {
    expect(checkEnv({ ...full, PUBLIC_URL: '   ' }, true).missing).toEqual(['PUBLIC_URL'])
  })

  it('K1: JWT_SECRET 32 karakterden kisaysa zayif (31 reddedilir, 32 kabul)', () => {
    expect(checkEnv({ ...full, JWT_SECRET: 'x'.repeat(31) }, true).weak).toEqual(['JWT_SECRET'])
    expect(checkEnv({ ...full, JWT_SECRET: 'x'.repeat(32) }, true).weak).toEqual([])
  })

  it('K1: zayif sirrin degeri hata metnine girmez', () => {
    const text = describeEnvProblems(checkEnv({ ...full, JWT_SECRET: 'kisa-gizli-DEGER' }, true))!
    expect(text).not.toContain('kisa-gizli-DEGER')
  })

  it('K1: uretim disinda zorunlu kontrol yok', () => {
    const report = checkEnv({}, false)
    expect(report.missing).toEqual([])
    expect(report.weak).toEqual([])
  })
})

describe('G5-K2: bos kanal degiskenleri', () => {
  it('K2: TELEGRAM_BOT_TOKEN, NETGSM_USERCODE, RESEND_API_KEY bossa kapali listesine girer; API acilir (sorun yok)', () => {
    const report = checkEnv(full, true)
    expect(report.disabled).toEqual(['TELEGRAM_BOT_TOKEN', 'NETGSM_USERCODE', 'RESEND_API_KEY'])
    expect(describeEnvProblems(report)).toBeNull()
  })

  it('K2: dolu kanal kapali listesinde yok', () => {
    expect(checkEnv({ ...full, NETGSM_USERCODE: 'kod', RESEND_API_KEY: 're_x' }, true).disabled).toEqual(['TELEGRAM_BOT_TOKEN'])
  })
})
