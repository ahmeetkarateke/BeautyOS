import { describe, expect, it } from 'vitest'
import { periodRange, sortCommissions, validateRange, type CommissionRow } from './logic'

const TODAY = '2026-10-29'

describe('W23 periodRange', () => {
  it('K1: bugün tek gündür', () => {
    expect(periodRange('today', TODAY)).toEqual({ from: TODAY, to: TODAY })
  })
  it('K1: hafta son 7 gündür (bugün dahil), ay ayın ilk gününden bugüne', () => {
    expect(periodRange('week', TODAY)).toEqual({ from: '2026-10-23', to: TODAY })
    expect(periodRange('month', TODAY)).toEqual({ from: '2026-10-01', to: TODAY })
  })
  it('K1: ay başı ve yıl başı sınırlarında doğru: 1 Ocak haftası önceki yıla taşar', () => {
    expect(periodRange('week', '2026-01-03')).toEqual({ from: '2025-12-28', to: '2026-01-03' })
    expect(periodRange('month', '2026-03-01')).toEqual({ from: '2026-03-01', to: '2026-03-01' })
  })
})

describe('W23 validateRange', () => {
  it('K2: geçerli aralık hatasızdır (tek gün dahil)', () => {
    expect(validateRange('2026-10-01', '2026-10-29', TODAY)).toBeNull()
    expect(validateRange(TODAY, TODAY, TODAY)).toBeNull()
  })
  it('K2: başlangıç bitişten sonra olamaz', () => {
    expect(validateRange('2026-10-29', '2026-10-01', TODAY)).toBe('Başlangıç tarihi bitişten sonra olamaz.')
  })
  it('K2: gelecek tarih reddedilir', () => {
    expect(validateRange('2026-10-01', '2026-10-30', TODAY)).toBe('Rapor için gelecek bir tarih seçilemez.')
  })
  it('K2: boş ya da bozuk tarih reddedilir', () => {
    expect(validateRange('', TODAY, TODAY)).toBe('Başlangıç ve bitiş tarihini seçin.')
    expect(validateRange('29.10.2026', TODAY, TODAY)).toBe('Başlangıç ve bitiş tarihini seçin.')
  })
  it('K2: 31 günden uzun aralık reddedilir (sunucu RANGE_TOO_LARGE: iki uç dahil en çok 31 gün); sınır kabul', () => {
    expect(validateRange('2025-01-01', TODAY, TODAY)).toBe('En çok 31 günlük aralık seçebilirsiniz.')
    expect(validateRange('2026-09-28', TODAY, TODAY)).toBe('En çok 31 günlük aralık seçebilirsiniz.')
    expect(validateRange('2026-09-29', TODAY, TODAY)).toBeNull()
  })
})

describe('W23 sortCommissions', () => {
  const row = (staffName: string, commission: number): CommissionRow => ({ staffId: staffName, staffName, completedAppointments: 1, revenue: 100, commission })
  it('K3: prim büyükten küçüğe, eşitse ada göre Türkçe sırayla', () => {
    const sorted = sortCommissions([row('Zeynep', 100), row('Çiğdem', 100), row('Ali', 300)])
    expect(sorted.map((r) => r.staffName)).toEqual(['Ali', 'Çiğdem', 'Zeynep'])
  })
  it('K3: girdi dizisini değiştirmez', () => {
    const input = [row('B', 1), row('A', 2)]
    sortCommissions(input)
    expect(input.map((r) => r.staffName)).toEqual(['B', 'A'])
  })
})
