import { describe, it, expect } from 'vitest'
import { istanbulDayRange, MAX_RANGE_DAYS } from '../lib/time'

// A4: gun sinirlari Europe/Istanbul (UTC+3) gunune gore; UTC gunune gore degil.
describe('A4: istanbulDayRange', () => {
  it('tek gun: Istanbul 00:00 = onceki gun 21:00Z, bitis (haric) ertesi Istanbul 00:00', () => {
    const r = istanbulDayRange('2026-12-01', '2026-12-01')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.gte.toISOString()).toBe('2026-11-30T21:00:00.000Z')
    expect(r.lt.toISOString()).toBe('2026-12-01T21:00:00.000Z')
  })

  it('UTC 22:30 olan randevu Istanbul gunu olarak ertesi gune dusar', () => {
    const r = istanbulDayRange('2026-12-02', '2026-12-02')
    if (!r.ok) throw new Error('beklenmeyen')
    const lateUtc = new Date('2026-12-01T22:30:00Z')
    expect(lateUtc >= r.gte && lateUtc < r.lt).toBe(true)
    const r1 = istanbulDayRange('2026-12-01', '2026-12-01')
    if (!r1.ok) throw new Error('beklenmeyen')
    expect(lateUtc >= r1.gte && lateUtc < r1.lt).toBe(false)
  })

  it('aralik: dateTo gunu dahil (Istanbul gunu sonuna kadar)', () => {
    const r = istanbulDayRange('2026-12-01', '2026-12-03')
    if (!r.ok) throw new Error('beklenmeyen')
    expect(r.lt.toISOString()).toBe('2026-12-03T21:00:00.000Z')
  })

  it('en cok 31 gun: 31 kabul, 32 reddedilir (RANGE_TOO_LARGE)', () => {
    expect(MAX_RANGE_DAYS).toBe(31)
    expect(istanbulDayRange('2026-12-01', '2026-12-31').ok).toBe(true)
    expect(istanbulDayRange('2026-12-01', '2027-01-01')).toEqual({ ok: false, reason: 'RANGE_TOO_LARGE' })
  })

  it('baslangic bitisten sonraysa INVALID_RANGE', () => {
    expect(istanbulDayRange('2026-12-05', '2026-12-04')).toEqual({ ok: false, reason: 'INVALID_RANGE' })
  })

  it('olmayan tarih (2026-02-30) INVALID_RANGE', () => {
    expect(istanbulDayRange('2026-02-30', '2026-02-30')).toEqual({ ok: false, reason: 'INVALID_RANGE' })
  })

  it('yil sinirini asan aralik dogru hesaplanir (2026-12-31 .. 2027-01-01)', () => {
    const r = istanbulDayRange('2026-12-31', '2027-01-01')
    if (!r.ok) throw new Error('beklenmeyen')
    expect(r.gte.toISOString()).toBe('2026-12-30T21:00:00.000Z')
    expect(r.lt.toISOString()).toBe('2027-01-01T21:00:00.000Z')
  })
})
