import { describe, expect, it } from 'vitest'
import { canEditAmount, completeBody, parseAmount, payLabel } from './payment-logic'

describe('W16 parseAmount', () => {
  it('K1: tam tutar, virgüllü kuruş, binlik noktalı Türkçe biçim ve noktalı ondalık okunur', () => {
    expect(parseAmount('850')).toEqual({ ok: true, value: 850 })
    expect(parseAmount('850,5')).toEqual({ ok: true, value: 850.5 })
    expect(parseAmount('1.250,50')).toEqual({ ok: true, value: 1250.5 })
    expect(parseAmount('1.250')).toEqual({ ok: true, value: 1250 })
    expect(parseAmount('850.50')).toEqual({ ok: true, value: 850.5 })
    expect(parseAmount(' 850 ')).toEqual({ ok: true, value: 850 })
  })
  it('K1: boş tutar "Tutarı yazın." hatası verir', () => {
    expect(parseAmount('')).toEqual({ ok: false, error: 'Tutarı yazın.' })
  })
  it('K1: sıfır ve eksi tutar reddedilir (neden: 0’dan büyük olmalı)', () => {
    expect(parseAmount('0')).toEqual({ ok: false, error: 'Tutar 0’dan büyük olmalı.' })
    expect(parseAmount('-5')).toEqual({ ok: false, error: 'Tutarı yalnız rakamlarla yazın. Örnek: 850 ya da 850,50' })
  })
  it('K1: harf içeren ve 2 haneden fazla kuruşlu tutar reddedilir', () => {
    expect(parseAmount('85a')).toEqual({ ok: false, error: 'Tutarı yalnız rakamlarla yazın. Örnek: 850 ya da 850,50' })
    expect(parseAmount('850,505')).toEqual({ ok: false, error: 'Tutarı yalnız rakamlarla yazın. Örnek: 850 ya da 850,50' })
  })
  it('K1: 1.000.000 üstü reddedilir, tam sınır kabul edilir', () => {
    expect(parseAmount('1000000').ok).toBe(true)
    expect(parseAmount('1000001')).toEqual({ ok: false, error: 'Tutar çok yüksek. Rakamı kontrol edin.' })
  })
})

describe('W16 canEditAmount (R3)', () => {
  it('K2: uzman (staff) tutarı değiştiremez; sahip, müdür, resepsiyon değiştirir', () => {
    expect(canEditAmount('staff')).toBe(false)
    expect(canEditAmount('owner')).toBe(true)
    expect(canEditAmount('manager')).toBe(true)
    expect(canEditAmount('receptionist')).toBe(true)
  })
})

describe('W16 completeBody', () => {
  it('K3: fiyat değişmediyse priceCharged gönderilmez (sunucu randevu fiyatını yazar)', () => {
    expect(completeBody({ method: 'cash', amount: 850, listPrice: 850, canEdit: true })).toEqual({ status: 'completed', paymentMethod: 'cash' })
  })
  it('K3: fiyat değiştiyse (indirim = yeni tutar) priceCharged gider', () => {
    expect(completeBody({ method: 'card', amount: 700, listPrice: 850, canEdit: true })).toEqual({ status: 'completed', paymentMethod: 'card', priceCharged: 700 })
  })
  it('K2: uzman değiştirilmiş tutar bile gelse priceCharged göndermez', () => {
    expect(completeBody({ method: 'cash', amount: 700, listPrice: 850, canEdit: false })).toEqual({ status: 'completed', paymentMethod: 'cash' })
  })
})

describe('W16 payLabel', () => {
  it('K4: düğme etiketi tutarı Türkçe para biçiminde yazar', () => {
    expect(payLabel(850)).toBe('Ödeme al · ₺850')
    expect(payLabel(1250.5)).toBe('Ödeme al · ₺1.250,50')
  })
})
