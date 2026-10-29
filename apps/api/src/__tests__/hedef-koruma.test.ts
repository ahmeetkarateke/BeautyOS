import { describe, it, expect } from 'vitest'
import { assertSafeTestDatabaseUrl } from './helpers/hedef-koruma'

describe('test hedef koruması (beyaz liste)', () => {
  it('geçici test veritabanına izin verir', () => {
    expect(() => assertSafeTestDatabaseUrl('postgresql://postgres:x@postgres:5432/beautyos_test')).not.toThrow()
  })

  it('canlı postgres:5432/beautyos adresini reddeder (kara listede olmayan ad)', () => {
    expect(() => assertSafeTestDatabaseUrl('postgresql://app_user:x@postgres:5432/beautyos')).toThrow(/_test/)
  })

  it('staging veritabanını reddeder', () => {
    expect(() => assertSafeTestDatabaseUrl('postgresql://app_user:x@postgres:5432/beautyos_staging')).toThrow(/_test/)
  })

  it('paylaşılan Supabase ana bilgisayarını _test adıyla bile reddeder', () => {
    expect(() => assertSafeTestDatabaseUrl('postgresql://u:x@db.abc.supabase.co:5432/beautyos_test')).toThrow(/paylaşılan|canlı/)
  })

  it('büyük I içeren ad (Türk I vakası) büyük harfle yazılsa da ayni karar verilir', () => {
    expect(() => assertSafeTestDatabaseUrl('postgresql://u:x@postgres:5432/BEAUTYOS_TEST')).not.toThrow()
    expect(() => assertSafeTestDatabaseUrl('postgresql://u:x@postgres:5432/BEAUTYOS_STAGING')).toThrow(/_test/)
  })

  it('çözümlenemeyen adresi reddeder', () => {
    expect(() => assertSafeTestDatabaseUrl('bozuk')).toThrow(/çözümlenemedi/)
  })
})
