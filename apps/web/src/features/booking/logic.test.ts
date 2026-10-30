import { describe, expect, it } from 'vitest'
import { apiPhone, bookFailure, doneCopy, icsFileName, manageErrorText, safeBrandColor, shareMessage, slotDate, slotLabel, validateCode, validateInfo } from './logic'

const base = { salonName: 'Defne', referenceCode: 'BK-123', when: '2 Kasım 10:00', serviceName: 'Diş beyazlatma' }

describe('W32 hazır mesaj', () => {
  it('K1: sağlık mevzuatına tabi işletmede hizmet adı geçmez', () => {
    expect(shareMessage({ ...base, isHealthRegulated: true })).not.toContain('Diş beyazlatma')
  })
  it('K1: bayrak yoksa da hizmet adı geçmez (güvenli varsayılan)', () => {
    expect(shareMessage(base)).not.toContain('Diş beyazlatma')
  })
  it('K1: salonda hizmet adı yazılır; referans kodu her durumda vardır', () => {
    const text = shareMessage({ ...base, serviceName: 'Saç kesimi', isHealthRegulated: false })
    expect(text).toContain('Saç kesimi')
    expect(text).toContain('BK-123')
  })
})

describe('W32 salon rengi', () => {
  it('K2: yalnız #rrggbb kabul edilir; CSS enjeksiyonu reddedilir', () => {
    expect(safeBrandColor('#1A2b3C')).toBe('#1A2b3C')
    expect(safeBrandColor('red; background:url(x)')).toBeNull()
    expect(safeBrandColor('#12345')).toBeNull()
    expect(safeBrandColor(null)).toBeNull()
  })
})

describe('W32 onay metni', () => {
  it('K3: onay bekleyen talebe "alındı" değil "talebiniz alındı" denir; SMS vaadi yoktur', () => {
    const wait = doneCopy(true)
    expect(wait.title).toBe('Randevu talebiniz alındı')
    expect(wait.lead).toContain('onayladığında')
    expect(`${wait.title}${wait.lead}`.toLowerCase()).not.toContain('sms')
    expect(doneCopy(false).title).toBe('Randevunuz alındı')
  })
})

describe('W32 form ve slot', () => {
  it('K4: ad ve 10 haneli telefon zorunlu; < ve > reddedilir', () => {
    expect(validateInfo({ fullName: 'Ayşe Yılmaz', phone: '5321112233' })).toEqual({})
    expect(Object.keys(validateInfo({ fullName: 'A', phone: '5321112233' }))).toEqual(['fullName'])
    expect(Object.keys(validateInfo({ fullName: 'Ayşe <b>', phone: '5321112233' }))).toEqual(['fullName'])
    expect(Object.keys(validateInfo({ fullName: 'Ayşe Yılmaz', phone: '532111' }))).toEqual(['phone'])
  })
  it('K4: doğrulama kodu tam 6 rakamdır', () => {
    expect(validateCode('123456')).toBeNull()
    expect(validateCode('12345')).not.toBeNull()
    expect(validateCode('12345a')).not.toBeNull()
  })
  it('K5: slot kimliğinden saat ve gün okunur; telefon 0 önekiyle gider', () => {
    expect(slotLabel('2026-11-02T09:30:00')).toBe('09:30')
    expect(slotDate('2026-11-02T09:30:00')).toBe('2026-11-02')
    expect(apiPhone('5321112233')).toBe('05321112233')
  })
})

describe('W32 hata yönlendirmesi', () => {
  it('K6: dolu saat zamana, doğrulanmamış telefon koda, geçersiz telefon bilgiye döner; bilinmeyen hata yerinde kalır', () => {
    expect(bookFailure('SLOT_TAKEN')).toEqual({ step: 'time', clearSlot: true })
    expect(bookFailure('PHONE_NOT_VERIFIED').step).toBe('verify')
    expect(bookFailure('INVALID_PHONE').step).toBe('info')
    expect(bookFailure('CAPTCHA_FAILED').step).toBe('stay')
  })
  it('K7: yönetim hata kodları Türkçe metne çevrilir; bilinmeyen kod null döner', () => {
    expect(manageErrorText('MODIFY_WINDOW_CLOSED')).toContain('2 saatten az')
    expect(manageErrorText('BOOKING_NOT_FOUND')).toContain('geçersiz')
    expect(manageErrorText('constructor')).toBeNull()
  })
  it('K8: takvim dosya adı güvenli karakterlerden oluşur', () => {
    expect(icsFileName('BK-1/../x')).toBe('randevu-BK-1x.ics')
  })
})
