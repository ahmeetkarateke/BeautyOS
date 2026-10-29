// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { GENERIC_ERROR, KNOWN_ERROR_CODES, NETWORK_ERROR, errorText } from './errors'

// metin-rehberi.md §6 tablosundaki tüm kodlar (FORBIDDEN, INVALID_TOKEN vb. bağlama göre birden çok metin taşır).
const SECTION_6_CODES = [
  'VALIDATION_ERROR', 'NOT_FOUND', 'UNAUTHORIZED', 'INVALID_TOKEN', 'FORBIDDEN', 'TENANT_DELETED', 'SUBSCRIPTION_REQUIRED',
  'CONFIG_ERROR', 'INTERNAL_ERROR', 'RATE_LIMIT', 'INVALID_CREDENTIALS', 'DUPLICATE_EMAIL', 'DUPLICATE_SLUG', 'DUPLICATE_PHONE',
  'INVALID_ACCOUNT', 'INVALID_CUSTOMER', 'INVALID_SUPPLIER', 'INVALID_INVENTORY', 'INVALID_PASSWORD', 'INVALID_PHONE',
  'PHONE_NOT_VERIFIED', 'CAPTCHA_FAILED', 'BOOKING_DISABLED', 'PAST_TIME', 'SLOT_TAKEN', 'SLOT_CONFLICT', 'APPOINTMENT_CONFLICT',
  'STAFF_NOT_SKILLED', 'STATUS_LOCKED', 'APPOINTMENT_LOCKED', 'PACKAGE_NOT_ACTIVE', 'NO_SESSIONS_LEFT', 'PACKAGE_EXPIRED',
  'ALREADY_POSTED', 'ALREADY_PAID', 'CANCELLED', 'INSUFFICIENT_STOCK', 'CONFLICT',
]

describe('hata kodu -> metin (W5-K4, metin-rehberi §6)', () => {
  it.each(SECTION_6_CODES)('K4: %s tablodadır ve genel hata metnine düşmez', (code) => {
    expect(KNOWN_ERROR_CODES).toContain(code)
    const text = errorText(code)
    expect(text.length).toBeGreaterThan(5)
    if (code !== 'INTERNAL_ERROR' && code !== 'CONFIG_ERROR') expect(text).not.toBe(GENERIC_ERROR)
  })

  it('K4: hiçbir metin teknik sözcük (slug, tenant, token, trial, rezervasyon, muhasebe) içermez', () => {
    for (const code of KNOWN_ERROR_CODES) {
      expect(errorText(code)).not.toMatch(/slug|tenant|token|trial|rezervasyon|muhasebe|owner|manager|seed/i)
    }
  })

  it('K4: bilinmeyen ve boş kod genel metni verir', () => {
    expect(errorText('BILINMEYEN_KOD')).toBe(GENERIC_ERROR)
    expect(errorText(undefined)).toBe(GENERIC_ERROR)
    expect(GENERIC_ERROR).toBe('Beklenmeyen bir sorun oluştu. Birkaç dakika sonra tekrar deneyin. Sürerse destek ekibine yazın.')
  })

  it('K4: bağlama göre iki metni olan kodlar', () => {
    expect(errorText('INVALID_TOKEN')).toBe('Oturumunuzun süresi doldu. Yeniden giriş yapın.')
    expect(errorText('INVALID_TOKEN', { context: 'password-reset' })).toBe('Bu bağlantının süresi dolmuş. Yeni bir bağlantı isteyin.')
    expect(errorText('SUBSCRIPTION_REQUIRED', { context: 'trial' })).toBe('Deneme süreniz doldu. Devam etmek için bir plan seçin.')
    expect(errorText('SUBSCRIPTION_REQUIRED', { context: 'inactive' })).toBe('Planınız aktif değil. Devam etmek için planınızı yenileyin.')
    expect(errorText('FORBIDDEN', { context: 'admin' })).toBe('Bu sayfa yalnız BeautyOS yönetimine açık.')
    expect(errorText('FORBIDDEN', { context: 'tenant' })).toBe('Bu salona erişiminiz yok. Doğru hesapla giriş yaptığınızdan emin olun.')
    expect(errorText('FORBIDDEN')).toBe('Bu işlem için yetkiniz yok. Gerekiyorsa salon sahibinden yetki isteyin.')
    expect(errorText('STATUS_LOCKED', { context: 'appointment' })).toBe('Tamamlanan veya iptal edilen randevu değiştirilemez.')
    expect(errorText('CONFLICT', { context: 'tip-edit' })).toBe('Dağıtılmış bahşiş düzenlenemez.')
    expect(errorText('CONFLICT', { context: 'tip-delete' })).toBe('Dağıtılmış bahşiş silinemez.')
    expect(errorText('CONFLICT', { context: 'service-product' })).toBe('Bu ürün bu hizmete zaten bağlı.')
  })

  it('K4: uzman adı yer tutucusu doldurulur; verilmezse "Seçilen uzman" kullanılır', () => {
    expect(errorText('SLOT_CONFLICT', { expert: 'Defne' })).toBe('Defne için bu saatte başka bir randevu var. Başka bir saat ya da uzman seçin.')
    expect(errorText('APPOINTMENT_CONFLICT')).toBe('Seçilen uzman için bu saatte başka bir randevu var. Başka bir saat ya da uzman seçin.')
    expect(errorText('STAFF_NOT_SKILLED', { expert: 'Defne' })).toBe('Defne bu hizmeti vermiyor. Başka bir uzman seçin.')
  })

  it('K4: INTERNAL_ERROR referansı yalnız verilince yazılır', () => {
    expect(errorText('INTERNAL_ERROR', { reference: 'req-9' })).toBe(
      'Beklenmeyen bir sorun oluştu. Birkaç dakika sonra tekrar deneyin. Sürerse destek ekibine yazın. Referans: req-9',
    )
    expect(errorText('INTERNAL_ERROR')).not.toContain('Referans')
  })

  it('K4: hız sınırı gerçek süreyi bağlama göre yazar (§4.8)', () => {
    expect(errorText('RATE_LIMIT', { context: 'login' })).toContain('Çok fazla yanlış giriş denemesi. 15 dakika sonra tekrar deneyin.')
    expect(errorText('RATE_LIMIT', { context: 'register' })).toBe('Çok fazla kayıt denemesi yapıldı. 1 saat sonra tekrar deneyin.')
    expect(errorText('RATE_LIMIT', { context: 'booking' })).toBe('Çok fazla randevu denemesi yapıldı. 1 saat sonra tekrar deneyin.')
    expect(errorText('RATE_LIMIT', { context: 'phone-verification' })).toBe('Çok fazla doğrulama isteği gönderildi. 1 saat sonra tekrar deneyin.')
    expect(errorText('RATE_LIMIT', { context: 'search' })).toBe('Çok hızlı işlem yapıyorsunuz. 1 dakika sonra tekrar deneyin.')
    expect(errorText('RATE_LIMIT')).toBe('Çok fazla istek gönderildi. 15 dakika sonra tekrar deneyin.')
  })

  it('K4: sunucudan gelen gerçek bekleme süresi bağlam sabitinin yerine geçer', () => {
    expect(errorText('RATE_LIMIT', { retryAfterSec: 120 })).toBe('Çok fazla istek gönderildi. 2 dakika sonra tekrar deneyin.')
    expect(errorText('RATE_LIMIT', { retryAfterSec: 3600 })).toBe('Çok fazla istek gönderildi. 1 saat sonra tekrar deneyin.')
    expect(errorText('RATE_LIMIT', { retryAfterSec: 30 })).toBe('Çok fazla istek gönderildi. 30 saniye sonra tekrar deneyin.')
  })

  it('K4: ağ hatası metni (§4.7) ve kayıt bulunamadı metni', () => {
    expect(NETWORK_ERROR).toBe('Bağlantı kurulamadı. Değişiklikler kaydedilmedi. Bağlantınızı kontrol edip tekrar deneyin.')
    expect(errorText('NOT_FOUND')).toBe('Bu kayıt bulunamadı. Silinmiş olabilir.')
  })
})
