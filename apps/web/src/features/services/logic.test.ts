import { describe, expect, it } from 'vitest'
import {
  emptyService,
  groupByCategory,
  serviceMeta,
  toCreateBody,
  toFormValues,
  toUpdateBody,
  validateService,
  type ServiceRow,
  type ServiceValues,
} from './logic'

const row = (over: Partial<ServiceRow> = {}): ServiceRow => ({
  id: 's1',
  name: 'Fön',
  category: 'Saç',
  durationMinutes: 45,
  price: 850,
  bufferMinutes: 0,
  isActive: true,
  isOnlineBookable: true,
  ...over,
})
const valid: ServiceValues = { name: 'Fön', category: 'Saç', durationText: '45', priceText: '850', bufferText: '0', isOnlineBookable: true, isActive: true }

describe('W20 groupByCategory', () => {
  it('K1: kategoriler Türkçe sıraya göre (Ç, İ, Ş doğru yerde), kategorisiz "Diğer" en sonda', () => {
    const groups = groupByCategory([
      row({ id: '1', category: 'Şekillendirme' }),
      row({ id: '2', category: 'Cilt' }),
      row({ id: '3', category: '' }),
      row({ id: '4', category: 'İğne' }),
      row({ id: '5', category: null }),
      row({ id: '6', category: 'Çocuk' }),
    ])
    expect(groups.map((g) => g.category)).toEqual(['Cilt', 'Çocuk', 'İğne', 'Şekillendirme', 'Diğer'])
    expect(groups.at(-1)?.services.map((s) => s.id)).toEqual(['3', '5'])
  })
  it('K1: grupta etkin hizmetler önce, pasifler sonda; kendi içinde ada göre', () => {
    const groups = groupByCategory([row({ id: 'a', name: 'Zeta' }), row({ id: 'b', name: 'Alfa', isActive: false }), row({ id: 'c', name: 'Beta' })])
    expect(groups[0].services.map((s) => s.id)).toEqual(['c', 'a', 'b'])
  })
  it('K1: "ı/I" büyük küçük harf tuzağı: Irmak ve ısı doğru sırada (tr)', () => {
    const groups = groupByCategory([row({ id: '1', name: 'Işık' }), row({ id: '2', name: 'Ilık' }), row({ id: '3', name: 'İpek' })])
    expect(groups[0].services.map((s) => s.name)).toEqual(['Ilık', 'Işık', 'İpek'])
  })
  it('K1: boş liste boş grup verir', () => {
    expect(groupByCategory([])).toEqual([])
  })
})

describe('W20 serviceMeta', () => {
  it('K2: süre ve fiyat Türkçe biçimde; 0 ₺ "Ücretsiz" yazar', () => {
    expect(serviceMeta(row())).toBe('45 dk · ₺850')
    expect(serviceMeta(row({ price: 1250.5 }))).toBe('45 dk · ₺1.250,50')
    expect(serviceMeta(row({ price: 0 }))).toBe('45 dk · Ücretsiz')
  })
  it('K2: 60 dakika ve üstü saat+dakika yazar (90 dk -> 1 sa 30 dk)', () => {
    expect(serviceMeta(row({ durationMinutes: 90 }))).toBe('1 sa 30 dk · ₺850')
    expect(serviceMeta(row({ durationMinutes: 120 }))).toBe('2 sa · ₺850')
  })
})

describe('W20 validateService', () => {
  it('K3: geçerli form hatasızdır', () => {
    expect(validateService(valid)).toEqual({})
  })
  it('K3: boş ad, yalnız ad alanını işaretler', () => {
    expect(Object.keys(validateService({ ...valid, name: '  ' }))).toEqual(['name'])
  })
  it('K3: süre en az 5 dakika ve tam sayı: 4, 45,5 ve harf reddedilir; 5 kabul', () => {
    expect(Object.keys(validateService({ ...valid, durationText: '4' }))).toEqual(['durationText'])
    expect(Object.keys(validateService({ ...valid, durationText: '45,5' }))).toEqual(['durationText'])
    expect(Object.keys(validateService({ ...valid, durationText: 'iki' }))).toEqual(['durationText'])
    expect(validateService({ ...valid, durationText: '5' })).toEqual({})
  })
  it('K3: fiyat 0 kabul (ücretsiz), eksi ve harf reddedilir, virgüllü kuruş kabul', () => {
    expect(validateService({ ...valid, priceText: '0' })).toEqual({})
    expect(validateService({ ...valid, priceText: '99,90' })).toEqual({})
    expect(Object.keys(validateService({ ...valid, priceText: '-1' }))).toEqual(['priceText'])
    expect(Object.keys(validateService({ ...valid, priceText: 'x' }))).toEqual(['priceText'])
  })
  it('K3: ara süre 0 ve üstü tam sayı; kategori 50 karakteri geçemez', () => {
    expect(Object.keys(validateService({ ...valid, bufferText: '-5' }))).toEqual(['bufferText'])
    expect(Object.keys(validateService({ ...valid, category: 'k'.repeat(51) }))).toEqual(['category'])
  })
})

describe('W20 gövdeler', () => {
  it('K4: oluşturma gövdesi sayıları sayıya çevirir; boş kategori gönderilmez', () => {
    expect(toCreateBody({ ...valid, category: '' })).toEqual({ name: 'Fön', durationMinutes: 45, price: 850, bufferMinutes: 0, isOnlineBookable: true })
    expect(toCreateBody(valid)).toEqual({ name: 'Fön', category: 'Saç', durationMinutes: 45, price: 850, bufferMinutes: 0, isOnlineBookable: true })
  })
  it('K4: oluşturma gövdesi isOnlineBookable bayrağını taşır (sunucu POST /services artık alır)', () => {
    expect(toCreateBody({ ...valid, isOnlineBookable: false }).isOnlineBookable).toBe(false)
    expect(toCreateBody(valid).isOnlineBookable).toBe(true)
  })
  it('K5: sunucu kaydı forma çevrilir', () => {
    expect(toFormValues(row({ price: 99.9, category: null }))).toEqual({
      name: 'Fön',
      category: '',
      durationText: '45',
      priceText: '99,9',
      bufferText: '0',
      isOnlineBookable: true,
      isActive: true,
    })
    expect(emptyService().isActive).toBe(true)
  })
  it('K6: güncelleme yalnız değişen alanı gönderir', () => {
    const original = row()
    expect(toUpdateBody(toFormValues(original), original)).toEqual({})
    expect(toUpdateBody({ ...toFormValues(original), priceText: '900' }, original)).toEqual({ price: 900 })
    expect(toUpdateBody({ ...toFormValues(original), isOnlineBookable: false, isActive: false }, original)).toEqual({
      isOnlineBookable: false,
      isActive: false,
    })
  })
})

describe('W20-1 üst sınırlar', () => {
  it('K7: süre en çok 12 saat (720 dk, sunucu sınırı), ara süre en çok 240 dk; sınır değerler kabul', () => {
    expect(Object.keys(validateService({ ...valid, durationText: '721' }))).toEqual(['durationText'])
    expect(validateService({ ...valid, durationText: '720' })).toEqual({})
    expect(Object.keys(validateService({ ...valid, bufferText: '241' }))).toEqual(['bufferText'])
    expect(validateService({ ...valid, bufferText: '240' })).toEqual({})
  })
})
