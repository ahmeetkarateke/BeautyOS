import { describe, expect, it } from 'vitest'
import { quickSaleBody, validateQuickSale, type QuickSaleValues } from './quick-sale-logic'

const TODAY = '2026-10-29'
const valid: QuickSaleValues = { description: 'Ürün satışı', amountText: '250', method: 'cash', date: TODAY }

describe('W16b validateQuickSale', () => {
  it('K1: geçerli form hatasızdır', () => {
    expect(validateQuickSale(valid, { today: TODAY, canPickDate: true })).toEqual({})
  })
  it('K1: boş açıklama yalnız açıklamayı işaretler', () => {
    expect(Object.keys(validateQuickSale({ ...valid, description: '  ' }, { today: TODAY, canPickDate: true }))).toEqual(['description'])
  })
  it('K2: tutar boş, sıfır ve harfli iken yalnız tutar alanı hatalı (neden metni parseAmount’tan)', () => {
    expect(validateQuickSale({ ...valid, amountText: '' }, { today: TODAY, canPickDate: true }).amountText).toBe('Tutarı yazın.')
    expect(validateQuickSale({ ...valid, amountText: '0' }, { today: TODAY, canPickDate: true }).amountText).toBe('Tutar 0’dan büyük olmalı.')
    expect(Object.keys(validateQuickSale({ ...valid, amountText: '2x' }, { today: TODAY, canPickDate: true }))).toEqual(['amountText'])
  })
  it('K3: tarih seçebilen rolde ileri tarih reddedilir, geçmiş kabul edilir', () => {
    expect(Object.keys(validateQuickSale({ ...valid, date: '2026-10-30' }, { today: TODAY, canPickDate: true }))).toEqual(['date'])
    expect(validateQuickSale({ ...valid, date: '2026-10-20' }, { today: TODAY, canPickDate: true })).toEqual({})
  })
  it('K3: tarih seçemeyen rolde (resepsiyon) tarih alanı hiç doğrulanmaz, bugün kullanılır', () => {
    expect(validateQuickSale({ ...valid, date: '2020-01-01' }, { today: TODAY, canPickDate: false })).toEqual({})
  })
  it('K3: bozuk tarih biçimi reddedilir', () => {
    expect(Object.keys(validateQuickSale({ ...valid, date: '29.10.2026' }, { today: TODAY, canPickDate: true }))).toEqual(['date'])
  })
})

describe('W16b quickSaleBody', () => {
  it('K4: sunucu alanları: description kırpılır, amount sayı, paymentMethod, revenueDate', () => {
    expect(quickSaleBody({ ...valid, description: ' Ürün satışı ', amountText: '1.250,50', method: 'card' }, { today: TODAY, canPickDate: true })).toEqual({
      description: 'Ürün satışı',
      amount: 1250.5,
      paymentMethod: 'card',
      revenueDate: TODAY,
    })
  })
  it('K4: tarih seçemeyen rolde revenueDate her zaman bugündür (formdaki eski tarih gönderilmez)', () => {
    expect(quickSaleBody({ ...valid, date: '2020-01-01' }, { today: TODAY, canPickDate: false }).revenueDate).toBe(TODAY)
  })
})
