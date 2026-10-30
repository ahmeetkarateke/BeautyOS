import { describe, expect, it } from 'vitest'
import { emptyItem, invoiceActions, invoiceBody, invoiceStatusLabel, invoiceTotals, itemTotals, validateInvoice, type InvoiceValues, type ItemValues } from './logic'

const item = (over: Partial<ItemValues> = {}): ItemValues => ({ ...emptyItem(), name: 'Şampuan', quantityText: '10', priceText: '100', taxText: '20', discountText: '0', ...over })
const values = (over: Partial<InvoiceValues> = {}): InvoiceValues => ({ supplierId: 's1', invoiceNumber: '', invoiceDate: '2026-10-29', dueDate: '', notes: '', items: [item()], postNow: false, ...over })

describe('W25 itemTotals (sunucu formülü: brüt - indirim, üstüne KDV)', () => {
  it('K1: 10 x 100, %20 KDV: ara toplam 1000, KDV 200, toplam 1200', () => {
    expect(itemTotals(item())).toEqual({ net: 1000, tax: 200, total: 1200 })
  })
  it('K1: indirim brüt tutardan düşer, KDV indirimli tutar üzerinden hesaplanır', () => {
    expect(itemTotals(item({ discountText: '100' }))).toEqual({ net: 900, tax: 180, total: 1080 })
  })
  it('K1: indirim brütten büyükse net 0 (negatif olmaz)', () => {
    expect(itemTotals(item({ discountText: '5000' }))).toEqual({ net: 0, tax: 0, total: 0 })
  })
  it('K1: kuruş hesabı yuvarlama hatası vermez (3 x 0,10 = 0,30; %18 KDV)', () => {
    expect(itemTotals(item({ quantityText: '3', priceText: '0,10', taxText: '18' }))).toEqual({ net: 0.3, tax: 0.05, total: 0.35 })
  })
  it('K1: geçersiz girdide toplamlar 0 (NaN olmaz)', () => {
    expect(itemTotals(item({ quantityText: 'x' }))).toEqual({ net: 0, tax: 0, total: 0 })
  })
})

describe('W25 invoiceTotals', () => {
  it('K2: kalemlerin toplamı: ara toplam, KDV, genel toplam', () => {
    expect(invoiceTotals([item(), item({ quantityText: '1', priceText: '50', taxText: '0' })])).toEqual({ net: 1050, tax: 200, total: 1250 })
  })
})

describe('W25 validateInvoice', () => {
  it('K3: geçerli fatura hatasızdır', () => {
    expect(validateInvoice(values())).toEqual({ fields: {}, items: [] })
  })
  it('K3: tedarikçi ve fatura tarihi zorunlu; vade tarihi fatura tarihinden önce olamaz', () => {
    expect(Object.keys(validateInvoice(values({ supplierId: '' })).fields)).toEqual(['supplierId'])
    expect(Object.keys(validateInvoice(values({ invoiceDate: '' })).fields)).toEqual(['invoiceDate'])
    expect(validateInvoice(values({ dueDate: '2026-10-01' })).fields.dueDate).toBe('Vade tarihi fatura tarihinden önce olamaz.')
    expect(validateInvoice(values({ dueDate: '2026-10-29' })).fields).toEqual({})
  })
  it('K3: fatura numarası 50, not 1000 karakteri geçemez', () => {
    expect(Object.keys(validateInvoice(values({ invoiceNumber: 'x'.repeat(51) })).fields)).toEqual(['invoiceNumber'])
    expect(Object.keys(validateInvoice(values({ notes: 'x'.repeat(1001) })).fields)).toEqual(['notes'])
  })
  it('K4: en az bir kalem; kalem hataları kalem sırasıyla döner (ad, adet 1-100000 tam sayı, fiyat ≥0, KDV 0-100, indirim ≥0)', () => {
    expect(validateInvoice(values({ items: [] })).fields.items).toBe('En az bir kalem ekleyin.')
    const result = validateInvoice(values({ items: [item(), item({ name: ' ', quantityText: '0', taxText: '101' })] }))
    expect(result.items[0]).toEqual({})
    expect(Object.keys(result.items[1]).sort()).toEqual(['name', 'quantityText', 'taxText'])
  })
})

describe('W25 invoiceBody', () => {
  it('K5: sunucu alanları: sayılar çevrilir, boş isteğe bağlılar gönderilmez, post yalnız işaretliyse', () => {
    expect(invoiceBody(values())).toEqual({ supplierId: 's1', invoiceDate: '2026-10-29', items: [{ name: 'Şampuan', quantity: 10, unitPrice: 100, taxRate: 20, discount: 0 }] })
    const full = invoiceBody(values({ invoiceNumber: ' A-1 ', dueDate: '2026-11-15', notes: ' Not ', postNow: true }))
    expect(full).toMatchObject({ invoiceNumber: 'A-1', dueDate: '2026-11-15', notes: 'Not', post: true })
  })
})

describe('W25 durum ve eylemler', () => {
  it('K6: durum metinleri', () => {
    expect(invoiceStatusLabel('draft')).toBe('Taslak')
    expect(invoiceStatusLabel('posted')).toBe('İşlendi')
    expect(invoiceStatusLabel('cancelled')).toBe('İptal edildi')
    expect(invoiceStatusLabel('zzz')).toBe('Bilinmiyor')
  })
  it('K6: taslak işlenir ve silinir; işlenmiş fatura yalnız iptal edilir; iptal edilmişte eylem yok', () => {
    expect(invoiceActions('draft')).toEqual(['post', 'delete'])
    expect(invoiceActions('posted')).toEqual(['cancel'])
    expect(invoiceActions('cancelled')).toEqual([])
  })
})
