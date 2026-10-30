import { describe, expect, it } from 'vitest'
import { MODULES, moduleToggle, onlinePatch, salonPatch, sectionsFor, validateOnline, validateSalon, type OnlineValues, type SalonValues } from './logic'

const salon: SalonValues = { name: 'Defne Güzellik', phone: '0532 111 22 33', address: 'Bahçelievler Mah. 12. Sok. No:4' }
const online: OnlineValues = { enabled: true, approval: 'manual', whatsapp: '', about: '' }

describe('W27 sectionsFor (yalnız sahipte Terimler/Modüller)', () => {
  it('K1: sahip tüm bölümleri görür; Modüller ve Terimler dahil', () => {
    const keys = sectionsFor('owner').map((s) => s.key)
    expect(keys).toContain('moduller')
    expect(keys).toContain('terimler')
    expect(keys).toContain('salon')
  })
  it('K1: müdür Modüller ve Terimler bölümlerini görmez', () => {
    const keys = sectionsFor('manager').map((s) => s.key)
    expect(keys).not.toContain('moduller')
    expect(keys).not.toContain('terimler')
    expect(keys).toEqual(expect.arrayContaining(['salon', 'calisma-saatleri', 'online-randevu']))
  })
  it('K1: resepsiyon ve uzman hiçbir bölüm görmez', () => {
    expect(sectionsFor('receptionist')).toEqual([])
    expect(sectionsFor('staff')).toEqual([])
  })
})

describe('W27 validateSalon', () => {
  it('K2: geçerli bilgi hatasızdır', () => {
    expect(validateSalon(salon)).toEqual({})
  })
  it('K2: ad 2-100, telefon 7-20, adres 5-255 (sunucu şeması); her biri tek başına işaretlenir', () => {
    expect(Object.keys(validateSalon({ ...salon, name: 'A' }))).toEqual(['name'])
    expect(Object.keys(validateSalon({ ...salon, phone: '123' }))).toEqual(['phone'])
    expect(Object.keys(validateSalon({ ...salon, address: 'Ev' }))).toEqual(['address'])
    expect(Object.keys(validateSalon({ ...salon, name: 'a'.repeat(101) }))).toEqual(['name'])
  })
})

describe('Telefon isteğe bağlı', () => {
  it('H3: telefon boşsa hata yok; doluysa 7-20 kuralı sürer', () => {
    expect(validateSalon({ ...salon, phone: '' })).toEqual({})
    expect(validateSalon({ ...salon, phone: '   ' })).toEqual({})
    expect(Object.keys(validateSalon({ ...salon, phone: '123' }))).toEqual(['phone'])
  })
  it('H3: kayıtlı telefon boşaltılırsa null gider; hiç telefonu olmayan salonda boş telefon gönderilmez', () => {
    expect(salonPatch({ ...salon, phone: '', name: 'Yeni' }, salon)).toEqual({ name: 'Yeni', phone: null })
    expect(salonPatch({ ...salon, phone: '  ' }, salon)).toEqual({ phone: null })
    expect(salonPatch({ ...salon, phone: '' }, { ...salon, phone: '' })).toEqual({})
  })
})

describe('W27 salonPatch', () => {
  it('K3: yalnız değişen alan gider; kırpılır', () => {
    expect(salonPatch(salon, salon)).toEqual({})
    expect(salonPatch({ ...salon, name: ' Yeni Ad ' }, salon)).toEqual({ name: 'Yeni Ad' })
  })
})

describe('W27 online randevu (T3 onay ayarı)', () => {
  it('K4: WhatsApp boş bırakılabilir; doluysa 7-20 karakter; hakkında 500', () => {
    expect(validateOnline(online)).toEqual({})
    expect(Object.keys(validateOnline({ ...online, whatsapp: '123' }))).toEqual(['whatsapp'])
    expect(Object.keys(validateOnline({ ...online, about: 'x'.repeat(501) }))).toEqual(['about'])
  })
  it('K4: onay kipi auto/manual gövdeye aynen gider; değişmeyen alan gitmez', () => {
    expect(onlinePatch(online, online)).toEqual({})
    expect(onlinePatch({ ...online, approval: 'auto' }, online)).toEqual({ onlineBookingApproval: 'auto' })
    expect(onlinePatch({ ...online, enabled: false }, online)).toEqual({ publicBookingEnabled: false })
  })
  it('K4: WhatsApp temizlenince boş dize gönderilir (sunucu temizler)', () => {
    expect(onlinePatch({ ...online, whatsapp: '' }, { ...online, whatsapp: '0532 111 22 33' })).toEqual({ whatsappNumber: '' })
  })
})

describe('W27 Modüller', () => {
  it('K5: Ayarlar ve Bugün kapatılamaz (kilitli); diğerleri açılıp kapanır', () => {
    expect(MODULES.find((m) => m.key === 'settings')?.locked).toBe(true)
    expect(MODULES.find((m) => m.key === 'dashboard')?.locked).toBe(true)
    expect(MODULES.find((m) => m.key === 'inventory')?.locked).toBe(false)
  })
  it('K5: moduleToggle listeyi değiştirir, kilitli modülü kapatmaz, sırayı korur ve tekrar eklemez', () => {
    expect(moduleToggle(['dashboard', 'settings', 'stock'], 'inventory', true)).toEqual(['dashboard', 'settings', 'stock', 'inventory'])
    expect(moduleToggle(['dashboard', 'inventory', 'settings'], 'inventory', false)).toEqual(['dashboard', 'settings'])
    expect(moduleToggle(['dashboard', 'settings'], 'settings', false)).toEqual(['dashboard', 'settings'])
    expect(moduleToggle(['dashboard', 'inventory'], 'inventory', true)).toEqual(['dashboard', 'inventory'])
  })
})

describe('H3 kayıtlı telefon', () => {
  it('H3b: kayıtlı telefon boşaltılabilir; doğrulama hata vermez', () => {
    expect(validateSalon({ ...salon, phone: '' }, salon)).toEqual({})
  })
})
