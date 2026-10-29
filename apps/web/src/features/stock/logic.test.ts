import { describe, expect, it } from 'vitest'
import {
  emptyProduct,
  movementBody,
  movementLabel,
  productBody,
  sortItems,
  stockStatus,
  toProductValues,
  validateMovement,
  validateProduct,
  type Item,
  type ProductValues,
} from './logic'

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i1',
  name: 'Şampuan',
  sku: null,
  quantity: 10,
  lowStockThreshold: 3,
  unitCost: 50,
  sellingPrice: null,
  unit: 'adet',
  ...over,
})
const valid: ProductValues = { name: 'Şampuan', sku: ' SMP-01 ', unit: 'adet', quantityText: '12', thresholdText: '3', costText: '49,90', priceText: '' }

describe('W25 stockStatus', () => {
  it('K1: stok eşiğin üstündeyse ok; eşitse ya da altındaysa az; sıfırsa tükendi', () => {
    expect(stockStatus(item({ quantity: 10, lowStockThreshold: 3 }))).toBe('ok')
    expect(stockStatus(item({ quantity: 3, lowStockThreshold: 3 }))).toBe('low')
    expect(stockStatus(item({ quantity: 1, lowStockThreshold: 3 }))).toBe('low')
    expect(stockStatus(item({ quantity: 0, lowStockThreshold: 3 }))).toBe('out')
  })
  it('K1: eşik 0 iken yalnız sıfır stok uyarı verir (sunucu quantity <= eşik)', () => {
    expect(stockStatus(item({ quantity: 1, lowStockThreshold: 0 }))).toBe('ok')
    expect(stockStatus(item({ quantity: 0, lowStockThreshold: 0 }))).toBe('out')
  })
})

describe('W25 sortItems', () => {
  it('K2: tükenenler, sonra azalanlar, sonra tamamı ada göre Türkçe sırayla', () => {
    const sorted = sortItems([
      item({ id: 'a', name: 'Zeytin' }),
      item({ id: 'b', name: 'Çay', quantity: 1 }),
      item({ id: 'c', name: 'Boya', quantity: 0 }),
      item({ id: 'd', name: 'Ağda' }),
    ])
    expect(sorted.map((i) => i.id)).toEqual(['c', 'b', 'd', 'a'])
  })
})

describe('W25 validateProduct', () => {
  it('K3: geçerli ürün hatasızdır', () => {
    expect(validateProduct(valid)).toEqual({})
  })
  it('K3: ad 1-120, SKU ≤60, birim 1-20: her biri tek başına işaretlenir', () => {
    expect(Object.keys(validateProduct({ ...valid, name: ' ' }))).toEqual(['name'])
    expect(Object.keys(validateProduct({ ...valid, name: 'a'.repeat(121) }))).toEqual(['name'])
    expect(Object.keys(validateProduct({ ...valid, sku: 's'.repeat(61) }))).toEqual(['sku'])
    expect(Object.keys(validateProduct({ ...valid, unit: '' }))).toEqual(['unit'])
  })
  it('K3: miktar ve eşik tam sayı 0..1.000.000; ondalık ve eksi reddedilir', () => {
    expect(Object.keys(validateProduct({ ...valid, quantityText: '1,5' }))).toEqual(['quantityText'])
    expect(Object.keys(validateProduct({ ...valid, thresholdText: '-1' }))).toEqual(['thresholdText'])
    expect(Object.keys(validateProduct({ ...valid, quantityText: '1000001' }))).toEqual(['quantityText'])
    expect(validateProduct({ ...valid, quantityText: '0', thresholdText: '0' })).toEqual({})
  })
  it('K3: maliyet zorunlu ve ≥0 (0 kabul); satış fiyatı isteğe bağlı ≥0', () => {
    expect(Object.keys(validateProduct({ ...valid, costText: '' }))).toEqual(['costText'])
    expect(validateProduct({ ...valid, costText: '0' })).toEqual({})
    expect(Object.keys(validateProduct({ ...valid, priceText: 'x' }))).toEqual(['priceText'])
    expect(validateProduct({ ...valid, priceText: '120,50' })).toEqual({})
  })
})

describe('W25 productBody', () => {
  it('K4: oluşturma gövdesi sayıları çevirir; boş SKU/fiyat gönderilmez, SKU kırpılır', () => {
    expect(productBody(valid)).toEqual({ name: 'Şampuan', sku: 'SMP-01', unit: 'adet', quantity: 12, lowStockThreshold: 3, unitCost: 49.9 })
    expect(productBody({ ...valid, priceText: '120,5' }).sellingPrice).toBe(120.5)
  })
  it('K4: forma çevirme (sunucu kaydı) ve boş ürün başlangıcı', () => {
    expect(toProductValues(item({ sku: 'X', sellingPrice: 99.9, unitCost: 5 }))).toMatchObject({
      sku: 'X',
      priceText: '99,9',
      costText: '5',
      thresholdText: '3',
      unit: 'adet',
    })
    expect(emptyProduct().unit).toBe('adet')
  })
})

describe('W25 hareket', () => {
  it('K5: hareket türleri Türkçe', () => {
    expect(movementLabel('in')).toBe('Alım')
    expect(movementLabel('out')).toBe('Kullanım / satış')
    expect(movementLabel('waste')).toBe('Fire')
    expect(movementLabel('zzz')).toBe('Diğer')
  })
  it('K5: adet pozitif tam sayı ≤1.000.000; çıkışta mevcut stoktan fazla olamaz (neden yazılır)', () => {
    expect(validateMovement({ type: 'in', quantityText: '5', notes: '' }, 3)).toEqual({})
    expect(Object.keys(validateMovement({ type: 'in', quantityText: '0', notes: '' }, 3))).toEqual(['quantityText'])
    expect(validateMovement({ type: 'out', quantityText: '5', notes: '' }, 3).quantityText).toBe('Mevcut stok 3; bundan fazlasını çıkaramazsınız.')
    expect(validateMovement({ type: 'waste', quantityText: '3', notes: '' }, 3)).toEqual({})
    expect(validateMovement({ type: 'in', quantityText: '999999', notes: '' }, 3)).toEqual({})
  })
  it('K5: not 500 karakteri geçemez', () => {
    expect(Object.keys(validateMovement({ type: 'in', quantityText: '1', notes: 'x'.repeat(501) }, 0))).toEqual(['notes'])
  })
  it('K6: gövde yalnız dolu alanları taşır', () => {
    expect(movementBody({ type: 'in', quantityText: '5', notes: '  Yeni sevkiyat ' })).toEqual({ type: 'in', quantity: 5, notes: 'Yeni sevkiyat' })
    expect(movementBody({ type: 'out', quantityText: '2', notes: '' })).toEqual({ type: 'out', quantity: 2 })
  })
})
