import { describe, expect, it } from 'vitest'
import {
  MAIN_BUSINESS_TYPES,
  OTHER_BUSINESS_TYPES,
  panelPathFor,
  resolveBusinessType,
  slugify,
  toRegisterBody,
  validateEmail,
  validateLogin,
  validateNewPassword,
  validateSlug,
  validateStep1,
  validateStep2,
} from './logic'

const valid2 = { fullName: 'Defne Kaya', phone: '5321234567', email: 'defne@ornek.com', password: 'sifre1234', acceptTerms: true, marketingOptIn: false }

describe('işletme türü', () => {
  it('K1: altı seçenek sunulur ve sonuncusu "Diğer"dir', () => {
    expect(MAIN_BUSINESS_TYPES).toHaveLength(6)
    expect(MAIN_BUSINESS_TYPES.at(-1)?.id).toBe('other')
  })

  it('K1: ana türler API enum değerine çözülür', () => {
    expect(MAIN_BUSINESS_TYPES.filter((t) => t.id !== 'other').map((t) => resolveBusinessType(t.id))).toEqual([
      'hair_salon',
      'barbershop',
      'beauty_center',
      'aesthetic_clinic',
      'dentist',
    ])
  })

  it('K1: "Diğer" seçilince alt tür belirler; saç ekimi salon modundaki türlerden biridir', () => {
    expect(resolveBusinessType('other', 'hair_transplant')).toBe('hair_transplant')
    expect(OTHER_BUSINESS_TYPES.map((t) => t.id)).toContain('hair_transplant')
  })

  it('K1: "Diğer" alt türsüz kalırsa güzellik merkezine düşer', () => {
    expect(resolveBusinessType('other')).toBe('beauty_center')
  })

  it('K1: bilinmeyen alt tür yok sayılır (istemci değeri enum dışına çıkamaz)', () => {
    expect(resolveBusinessType('other', 'superadmin')).toBe('beauty_center')
  })
})

describe('slugify', () => {
  it('K2: Türkçe harfleri sadeleştirir', () => {
    expect(slugify('Çiğdem Güzellik Salonu')).toBe('cigdem-guzellik-salonu')
  })

  it('K2: büyük I ve İ doğru çevrilir (Türk I sı)', () => {
    expect(slugify('IŞIL İPEK')).toBe('isil-ipek')
  })

  it('K2: sembolleri ve baştaki/sondaki tireleri atar, 30 karaktere keser', () => {
    expect(slugify('  --Defne & Ece!!  ')).toBe('defne-ece')
    expect(slugify('a'.repeat(50))).toHaveLength(30)
  })
})

describe('validateSlug', () => {
  it('K2: geçerli adres hata vermez', () => {
    expect(validateSlug('defne-guzellik')).toBeNull()
  })
  it('K2: yalnız uzunluk kuralını bozar: 2 karakter', () => {
    expect(validateSlug('ab')).toBe('Adres en az 3 karakter olmalı.')
  })
  it('K2: yalnız karakter kuralını bozar: büyük harf', () => {
    expect(validateSlug('Defne-guzellik')).toBe('Adreste yalnız küçük harf, rakam ve tire kullanabilirsiniz.')
  })
  it('K2: yalnız tire kuralını bozar: tire ile başlıyor', () => {
    expect(validateSlug('-defne')).toBe('Adres tire ile başlayıp bitemez.')
  })
  it('K2: 30 karakteri aşan adres reddedilir', () => {
    expect(validateSlug('a'.repeat(31))).toBe('Adres en çok 30 karakter olabilir.')
  })
})

describe('validateEmail / validateNewPassword', () => {
  it('K3: geçerli e-posta hata vermez, boş ve bozuk e-posta farklı mesaj verir', () => {
    expect(validateEmail('a@b.co')).toBeNull()
    expect(validateEmail('')).toBe('E-posta adresini yazın.')
    expect(validateEmail('a@b')).toBe('E-posta adresi geçerli görünmüyor. Örnek: ad@ornek.com')
  })

  it('K3: şifre yalnız uzunluktan reddedilir', () => {
    expect(validateNewPassword('abc12')).toBe('Şifre en az 8 karakter olmalı.')
  })
  it('K3: şifre yalnız rakam eksikliğinden reddedilir', () => {
    expect(validateNewPassword('sadeceharfler')).toBe('Şifrede en az bir rakam olmalı.')
  })
  it('K3: şifre yalnız harf eksikliğinden reddedilir', () => {
    expect(validateNewPassword('12345678')).toBe('Şifrede en az bir harf olmalı.')
  })
  it('K3: 128 karakteri aşan şifre reddedilir', () => {
    expect(validateNewPassword('a1'.repeat(65))).toBe('Şifre en çok 128 karakter olabilir.')
  })
  it('K3: geçerli şifre hata vermez', () => {
    expect(validateNewPassword('sifre1234')).toBeNull()
  })
})

describe('validateLogin', () => {
  it('K4: iki alan da boşsa her ikisi için hata döner', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({ email: 'E-posta adresini yazın.', password: 'Şifrenizi yazın.' })
  })
  it('K4: kayıtlı eski şifreler kural denetimine takılmaz (yalnız boşluk denetlenir)', () => {
    expect(validateLogin({ email: 'a@b.co', password: 'kisa' })).toEqual({})
  })
})

describe('validateStep1', () => {
  const ok = { salonName: 'Defne Güzellik', slug: 'defne-guzellik', type: 'hair_salon', otherType: '' }
  it('K5: geçerli birinci adım hata vermez', () => {
    expect(validateStep1(ok)).toEqual({})
  })
  it('K5: yalnız işletme adı kısa', () => {
    expect(validateStep1({ ...ok, salonName: 'D' })).toEqual({ salonName: 'İşletme adı en az 2 karakter olmalı.' })
  })
  it('K5: yalnız adres hatalı', () => {
    expect(validateStep1({ ...ok, slug: 'ab' })).toEqual({ slug: 'Adres en az 3 karakter olmalı.' })
  })
  it('K5: tür seçilmemişse tür hatası döner', () => {
    expect(validateStep1({ ...ok, type: '' })).toEqual({ type: 'İşletme türünü seçin.' })
  })
})

describe('validateStep2', () => {
  it('K6: geçerli ikinci adım hata vermez', () => {
    expect(validateStep2(valid2)).toEqual({})
  })
  it('K6: yalnız kullanım koşulu işaretsiz: rıza kutusu zorunludur', () => {
    expect(validateStep2({ ...valid2, acceptTerms: false })).toEqual({
      acceptTerms: 'Devam etmek için kullanım şartları ve gizlilik belgelerini kabul etmelisiniz.',
    })
  })
  it('K6: yalnız telefon 5 ile başlamıyor', () => {
    expect(validateStep2({ ...valid2, phone: '4321234567' })).toEqual({ phone: 'Telefon numarasını 5xx xxx xx xx biçiminde yazın.' })
  })
  it('K6: yalnız ad soyad kısa', () => {
    expect(validateStep2({ ...valid2, fullName: 'D' })).toEqual({ fullName: 'Ad soyad en az 2 karakter olmalı.' })
  })
  it('K6: yalnız şifre zayıf', () => {
    expect(validateStep2({ ...valid2, password: '12345678' })).toEqual({ password: 'Şifrede en az bir harf olmalı.' })
  })
})

describe('toRegisterBody', () => {
  it('K7: API gövdesini kurar, telefona +90 ekler, e-postayı kırpar', () => {
    const body = toRegisterBody({ salonName: ' Defne ', slug: 'defne', type: 'other', otherType: 'spa' }, { ...valid2, email: ' defne@ornek.com ' })
    expect(body).toEqual({
      salonName: 'Defne',
      slug: 'defne',
      ownerFullName: 'Defne Kaya',
      phone: '+905321234567',
      email: 'defne@ornek.com',
      password: 'sifre1234',
      businessType: 'spa',
      consents: { terms: true },
    })
  })

  it('K7: ticari ileti izni işaretliyse consents.marketingEmail true gider; işaretsizse alan hiç gitmez', () => {
    const step1 = { salonName: 'Defne', slug: 'defne', type: 'hair_salon', otherType: '' }
    expect(toRegisterBody(step1, { ...valid2, marketingOptIn: true }).consents).toEqual({ terms: true, marketingEmail: true })
    expect(toRegisterBody(step1, valid2).consents).toEqual({ terms: true })
  })
})

describe('panelPathFor', () => {
  it('K8: girişten sonra salonun Bugün ekranına gider; kısaltma kodlanır', () => {
    expect(panelPathFor('defne')).toBe('/panel/defne/bugun')
    expect(panelPathFor('a/b')).toBe('/panel/a%2Fb/bugun')
  })
})
