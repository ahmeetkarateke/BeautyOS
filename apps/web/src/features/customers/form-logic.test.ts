import { describe, expect, it } from 'vitest'
import { emptyValues, toCreatePayload, toFormValues, toUpdatePayload, validateCustomer, type CustomerValues } from './form-logic'

const valid: CustomerValues = { fullName: 'Ayşe Demir', phoneDigits: '5321234567', email: '', birthDate: '', preferenceNotes: '' }
const TODAY = '2026-10-29'

describe('W17 validateCustomer', () => {
  it('K1: geçerli minimum form (ad + telefon) hatasızdır', () => {
    expect(validateCustomer(valid, { today: TODAY, phoneRequired: true })).toEqual({})
  })
  it('K1: tek harfli ad reddedilir, yalnız ad alanı hatalı (telefon geçerli)', () => {
    expect(Object.keys(validateCustomer({ ...valid, fullName: 'A' }, { today: TODAY, phoneRequired: true }))).toEqual(['fullName'])
  })
  it('K1: 100 karakterden uzun ad reddedilir', () => {
    expect(validateCustomer({ ...valid, fullName: 'a'.repeat(101) }, { today: TODAY, phoneRequired: true }).fullName).toBeTruthy()
    expect(validateCustomer({ ...valid, fullName: 'a'.repeat(100) }, { today: TODAY, phoneRequired: true }).fullName).toBeUndefined()
  })
  it('K2: yeni kayıtta telefon zorunlu; 9 hane ve 5 ile başlamayan 10 hane reddedilir', () => {
    expect(Object.keys(validateCustomer({ ...valid, phoneDigits: '' }, { today: TODAY, phoneRequired: true }))).toEqual(['phoneDigits'])
    expect(Object.keys(validateCustomer({ ...valid, phoneDigits: '532123456' }, { today: TODAY, phoneRequired: true }))).toEqual(['phoneDigits'])
    expect(Object.keys(validateCustomer({ ...valid, phoneDigits: '2121234567' }, { today: TODAY, phoneRequired: true }))).toEqual(['phoneDigits'])
  })
  it('K2: telefonu olmayan kayıtta (Telegram) düzenlerken boş bırakılabilir, doluysa biçim yine denetlenir', () => {
    expect(validateCustomer({ ...valid, phoneDigits: '' }, { today: TODAY, phoneRequired: false })).toEqual({})
    expect(Object.keys(validateCustomer({ ...valid, phoneDigits: '53212' }, { today: TODAY, phoneRequired: false }))).toEqual(['phoneDigits'])
  })
  it('K3: e-posta isteğe bağlı; biçimi bozuksa reddedilir', () => {
    expect(validateCustomer({ ...valid, email: 'ayse@ornek.com' }, { today: TODAY, phoneRequired: true })).toEqual({})
    expect(Object.keys(validateCustomer({ ...valid, email: 'ayse@ornek' }, { today: TODAY, phoneRequired: true }))).toEqual(['email'])
  })
  it('K4: doğum tarihi geçmişte olmalı: gelecek, bugün ve olmayan gün (31 Şubat) reddedilir', () => {
    expect(validateCustomer({ ...valid, birthDate: '1990-05-17' }, { today: TODAY, phoneRequired: true })).toEqual({})
    expect(Object.keys(validateCustomer({ ...valid, birthDate: '2027-01-01' }, { today: TODAY, phoneRequired: true }))).toEqual(['birthDate'])
    expect(Object.keys(validateCustomer({ ...valid, birthDate: TODAY }, { today: TODAY, phoneRequired: true }))).toEqual(['birthDate'])
    expect(Object.keys(validateCustomer({ ...valid, birthDate: '1990-02-31' }, { today: TODAY, phoneRequired: true }))).toEqual(['birthDate'])
  })
  it('K5: tercih notu 500 karakteri geçemez', () => {
    expect(Object.keys(validateCustomer({ ...valid, preferenceNotes: 'x'.repeat(501) }, { today: TODAY, phoneRequired: true }))).toEqual(['preferenceNotes'])
  })
})

describe('W17 toCreatePayload', () => {
  it('K6: ulusal rakamlar 0 önekiyle gider, boş isteğe bağlı alanlar hiç gönderilmez', () => {
    expect(toCreatePayload(valid, false)).toEqual({ fullName: 'Ayşe Demir', phone: '05321234567' })
  })
  it('K6: dolu e-posta ve doğum tarihi gider, ad kırpılır', () => {
    expect(toCreatePayload({ ...valid, fullName: '  Ayşe Demir ', email: ' ayse@ornek.com ', birthDate: '1990-05-17' }, false)).toEqual({
      fullName: 'Ayşe Demir',
      phone: '05321234567',
      email: 'ayse@ornek.com',
      birthDate: '1990-05-17',
    })
  })
  it('K7: Yine de ekle allowSharedPhone: true gönderir; varsayılan göndermez', () => {
    expect(toCreatePayload(valid, true).allowSharedPhone).toBe(true)
    expect('allowSharedPhone' in toCreatePayload(valid, false)).toBe(false)
  })
})

describe('W17 toFormValues / toUpdatePayload', () => {
  const original = {
    id: 'c1',
    fullName: 'Ayşe Demir',
    phone: '+905321234567',
    email: 'ayse@ornek.com',
    birthDate: '1990-05-17T00:00:00.000Z',
    preferenceNotes: 'Sıcak su',
  }

  it('K8: sunucu kaydı forma çevrilir (+90 ulusal rakama, ISO tarih günlüğe)', () => {
    expect(toFormValues(original)).toEqual({
      fullName: 'Ayşe Demir',
      phoneDigits: '5321234567',
      email: 'ayse@ornek.com',
      birthDate: '1990-05-17',
      preferenceNotes: 'Sıcak su',
    })
  })
  it('K8: telefonu null olan kayıt boş telefonla açılır, boş formda emptyValues kullanılır', () => {
    expect(toFormValues({ ...original, phone: null, email: null, birthDate: null, preferenceNotes: null })).toEqual({
      ...emptyValues(),
      fullName: 'Ayşe Demir',
    })
    expect(emptyValues().phoneDigits).toBe('')
  })
  it('K9: değişmeyen alan gönderilmez; yalnız değişen gider', () => {
    expect(toUpdatePayload(toFormValues(original), original, false)).toEqual({})
    expect(toUpdatePayload({ ...toFormValues(original), fullName: 'Ayşe Demir Kaya' }, original, false)).toEqual({ fullName: 'Ayşe Demir Kaya' })
  })
  it('K9: telefon değişmediyse (aynı rakamlar) telefon gönderilmez; değiştiyse 0 önekiyle gider', () => {
    expect('phone' in toUpdatePayload(toFormValues(original), original, false)).toBe(false)
    expect(toUpdatePayload({ ...toFormValues(original), phoneDigits: '5329876543' }, original, false)).toEqual({ phone: '05329876543' })
  })
  it('K9: silinen e-posta, doğum tarihi ve not null gider (temizlenir)', () => {
    expect(toUpdatePayload({ ...toFormValues(original), email: '', birthDate: '', preferenceNotes: '' }, original, false)).toEqual({
      email: null,
      birthDate: null,
      preferenceNotes: null,
    })
  })
  it('K7: düzenlemede Yine de ekle yalnız telefon değişirken anlamlıdır ama bayrak her durumda iletilir', () => {
    expect(toUpdatePayload({ ...toFormValues(original), phoneDigits: '5329876543' }, original, true)).toEqual({ phone: '05329876543', allowSharedPhone: true })
  })
})
