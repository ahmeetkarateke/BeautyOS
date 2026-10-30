import { describe, expect, it } from 'vitest'
import { createBody, methodLabel, netAmount, payoutStatusLabel, validatePayout, type PayoutValues } from './logic'

const TODAY = '2026-10-29'
const valid: PayoutValues = { staffId: 's1', from: '2026-10-01', to: '2026-10-28', bonusText: '', deductionsText: '', notes: '' }

describe('W26 netAmount (sunucu: prim + ek - kesinti)', () => {
  it('K1: net = hak ediş + ek ödeme - kesinti; kuruş tam sayıyla', () => {
    expect(netAmount(1000, '250', '100')).toBe(1150)
    expect(netAmount(0.1, '0,2', '')).toBe(0.3)
  })
  it('K1: boş ek ve kesinti 0 sayılır; geçersiz girdide null (net uydurulmaz)', () => {
    expect(netAmount(500, '', '')).toBe(500)
    expect(netAmount(500, 'x', '')).toBeNull()
  })
  it('K1: net eksiye düşebilir (kesinti büyük): olduğu gibi gösterilir', () => {
    expect(netAmount(100, '', '250')).toBe(-150)
  })
})

describe('W26 validatePayout', () => {
  it('K2: geçerli ödeme hatasızdır', () => {
    expect(validatePayout(valid, TODAY)).toEqual({})
  })
  it('K2: personel zorunlu; dönem başı bitişten sonra olamaz; gelecek dönem sonu reddedilir', () => {
    expect(Object.keys(validatePayout({ ...valid, staffId: '' }, TODAY))).toEqual(['staffId'])
    expect(validatePayout({ ...valid, from: '2026-10-28', to: '2026-10-01' }, TODAY).to).toBe('Dönem sonu başlangıçtan önce olamaz.')
    expect(validatePayout({ ...valid, to: '2026-11-30' }, TODAY).to).toBe('Dönem sonu bugünden ileri olamaz.')
  })
  it('K2: ek ödeme ve kesinti eksi olamaz; not 500', () => {
    expect(Object.keys(validatePayout({ ...valid, bonusText: '-5' }, TODAY))).toEqual(['bonusText'])
    expect(Object.keys(validatePayout({ ...valid, deductionsText: 'x' }, TODAY))).toEqual(['deductionsText'])
    expect(Object.keys(validatePayout({ ...valid, notes: 'x'.repeat(501) }, TODAY))).toEqual(['notes'])
  })
})

describe('W26 createBody / etiketler', () => {
  it('K3: gövde sunucu alanlarıyla; boş ek/kesinti/not gönderilmez', () => {
    expect(createBody(valid)).toEqual({ staffId: 's1', periodStart: '2026-10-01', periodEnd: '2026-10-28' })
    expect(createBody({ ...valid, bonusText: '250', deductionsText: '10,5', notes: ' Not ' })).toEqual({
      staffId: 's1',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-28',
      bonus: 250,
      deductions: 10.5,
      notes: 'Not',
    })
  })
  it('K4: durum ve yöntem metinleri Türkçe', () => {
    expect(payoutStatusLabel('pending')).toBe('Bekliyor')
    expect(payoutStatusLabel('paid')).toBe('Ödendi')
    expect(payoutStatusLabel('cancelled')).toBe('İptal edildi')
    expect(methodLabel('cash')).toBe('Nakit')
    expect(methodLabel('card')).toBe('Kart')
    expect(methodLabel('online')).toBe('Havale / online')
  })
})
