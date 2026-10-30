import { describe, expect, it } from 'vitest'
import { distributeBody, poolOf, shareOf, sourceLabel, tipBody, validateDistribute, validateTip, type TipValues } from './logic'

const valid: TipValues = { staffId: 's1', amountText: '50', source: 'cash', notes: '' }

describe('W26 bahşiş doğrulama', () => {
  it('K1: geçerli bahşiş hatasızdır; tutar zorunlu ve sıfırdan büyük', () => {
    expect(validateTip(valid)).toEqual({})
    expect(Object.keys(validateTip({ ...valid, amountText: '' }))).toEqual(['amountText'])
    expect(Object.keys(validateTip({ ...valid, amountText: '0' }))).toEqual(['amountText'])
    expect(Object.keys(validateTip({ ...valid, amountText: 'x' }))).toEqual(['amountText'])
    expect(Object.keys(validateTip({ ...valid, amountText: '1000001' }))).toEqual(['amountText'])
  })
  it('K1: not 500 karakteri aşamaz', () => {
    expect(Object.keys(validateTip({ ...valid, notes: 'x'.repeat(501) }))).toEqual(['notes'])
  })
  it('K2: gövde sunucu alanlarıyla; boş personel (havuz) ve boş not gönderilmez; virgüllü tutar', () => {
    expect(tipBody(valid)).toEqual({ amount: 50, source: 'cash', staffId: 's1' })
    expect(tipBody({ ...valid, staffId: '', amountText: '12,5', source: 'salon_pool', notes: ' Not ' })).toEqual({
      amount: 12.5,
      source: 'salon_pool',
      notes: 'Not',
    })
  })
  it('K3: kaynak etiketleri Türkçe', () => {
    expect(sourceLabel('cash')).toBe('Nakit')
    expect(sourceLabel('card')).toBe('Kart')
    expect(sourceLabel('salon_pool')).toBe('Salon havuzu')
    expect(sourceLabel('zzz')).toBe('Diğer')
  })
})

describe('W26 bahşiş dağıtımı', () => {
  it('K4: en az bir personel seçilmeli ve havuz boşsa dağıtılamaz', () => {
    expect(validateDistribute([], 100)).toBe('Dağıtılacak personeli seçin.')
    expect(validateDistribute(['a'], 0)).toBe('Dağıtılacak bahşiş yok.')
    expect(validateDistribute(['a'], 100)).toBeNull()
  })
  it('K5: gövde eşit ağırlıkla gider; tutarı sunucu böler', () => {
    expect(distributeBody(['a', 'b'], ['t1'])).toEqual({ tipIds: ['t1'], distributions: [{ staffId: 'a', shareWeight: 1 }, { staffId: 'b', shareWeight: 1 }] })
  })
  it('K5b: havuz yalnız kişiye bağlanmamış, dağıtılmamış kayıtlardır', () => {
    const tips = [
      { id: 'h1', amount: 40.1, isDistributed: false, staffId: null },
      { id: 'h2', amount: 20.2, isDistributed: false },
      { id: 'kisi', amount: 100, isDistributed: false, staffId: 's1' },
      { id: 'bitti', amount: 70, isDistributed: true, staffId: null },
    ]
    expect(poolOf(tips)).toEqual({ ids: ['h1', 'h2'], total: 60.3 })
    expect(poolOf([])).toEqual({ ids: [], total: 0 })
  })
  it('K5: kişi başı payın önizlemesi kuruşa yuvarlanır; seçim yoksa null', () => {
    expect(shareOf(100, 3)).toBe(33.33)
    expect(shareOf(100, 0)).toBeNull()
  })
})
