import { describe, expect, it } from 'vitest'
import type { DayAppointment } from '@/features/appointments/day-logic'
import { countByDay, countByStaffDay, layoutColumn, monthGrid, parseView, parseDateParam, rangeFor, weekDays, weekStart } from './calendar-logic'

const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+03:00`)
function appt(id: string, from: string, to: string, over: Partial<DayAppointment> = {}, day = '2026-10-28'): DayAppointment {
  return {
    id, staffKey: 'p1', staffName: 'Derya', customerId: 'c', serviceId: 's', customerName: id, customerPhone: '', unverified: false, serviceName: 'Fön',
    start: at(day, from), end: at(day, to), status: 'confirmed', price: 0, notes: '', ...over,
  }
}

describe('W12 tarih yardımcıları', () => {
  it('K-hafta: hafta pazartesi başlar; pazar önceki pazartesiye aittir', () => {
    expect(weekStart('2026-10-28')).toBe('2026-10-26') // Çarşamba
    expect(weekStart('2026-10-26')).toBe('2026-10-26') // Pazartesi
    expect(weekStart('2026-11-01')).toBe('2026-10-26') // Pazar
    expect(weekDays('2026-10-28')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
  })

  it('K-ay: ay ızgarası pazartesi hizalıdır, başındaki boşluk sayısı ve gün sayısı doğrudur', () => {
    const grid = monthGrid('2026-10-15')
    expect(grid.first).toBe('2026-10-01')
    expect(grid.last).toBe('2026-10-31')
    expect(grid.leading).toBe(3) // 1 Ekim 2026 Perşembe
    expect(grid.days).toHaveLength(31)
    expect(monthGrid('2026-02-10').days).toHaveLength(28)
    expect(monthGrid('2028-02-10').days).toHaveLength(29)
  })

  it('K-aralık: görünüme göre istenen tarih aralığı (iki uç dahil, en çok 31 gün)', () => {
    expect(rangeFor('gun', '2026-10-28')).toEqual({ from: '2026-10-28', to: '2026-10-28' })
    expect(rangeFor('hafta', '2026-10-28')).toEqual({ from: '2026-10-26', to: '2026-11-01' })
    expect(rangeFor('ay', '2026-10-28')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('K-adres: geçersiz görünüm ve tarih parametresi güvenli varsayılana düşer', () => {
    expect(parseView('hafta')).toBe('hafta')
    expect(parseView('<script>')).toBe('gun')
    expect(parseView(null)).toBe('gun')
    expect(parseDateParam('2026-10-28', '2026-01-01')).toBe('2026-10-28')
    expect(parseDateParam('2026-13-45', '2026-01-01')).toBe('2026-01-01')
    expect(parseDateParam('dün', '2026-01-01')).toBe('2026-01-01')
    expect(parseDateParam('2026-02-30', '2026-01-01')).toBe('2026-01-01')
  })
})

describe('W12 örtüşme yerleşimi (saf fonksiyon)', () => {
  it('K-yerleşim: örtüşmeyen randevular tek şeritte, tam genişliktedir', () => {
    const items = layoutColumn([appt('a', '10:00', '11:00'), appt('b', '11:00', '12:00')])
    expect(items.map((i) => [i.appointment.id, i.lane, i.lanes])).toEqual([['a', 0, 1], ['b', 0, 1]])
  })

  it('K-yerleşim: örtüşen iki randevu yan yana iki şeride bölünür', () => {
    const items = layoutColumn([appt('a', '10:00', '11:00'), appt('b', '10:30', '11:30')])
    expect(items.map((i) => [i.appointment.id, i.lane, i.lanes])).toEqual([['a', 0, 2], ['b', 1, 2]])
  })

  it('K-yerleşim: zincirleme örtüşmede şerit boşalınca yeniden kullanılır, grup genişliği ortaktır', () => {
    // a 10-11, b 10:30-11:30, c 11-12 (a bitince şerit 0'a girer); üçü aynı grupta, en çok 2 şerit
    const items = layoutColumn([appt('a', '10:00', '11:00'), appt('b', '10:30', '11:30'), appt('c', '11:00', '12:00')])
    expect(items.map((i) => [i.appointment.id, i.lane, i.lanes])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 0, 2]])
  })

  it('K-yerleşim: ayrı gruplar bağımsız genişlik alır; iptal edilen randevu yer kaplamaz', () => {
    const items = layoutColumn([appt('a', '10:00', '11:00'), appt('b', '10:00', '11:00'), appt('x', '10:00', '11:00', { status: 'cancelled' }), appt('c', '14:00', '15:00')])
    expect(items.map((i) => [i.appointment.id, i.lanes])).toEqual([['a', 2], ['b', 2], ['c', 1]])
  })

  it('K-konum: üst ve yükseklik dakika cinsinden, şerit aralığına göre', () => {
    const [item] = layoutColumn([appt('a', '10:30', '11:15')])
    expect(item.startMin).toBe(630)
    expect(item.endMin).toBe(675)
  })
})

describe('W12 sayımlar', () => {
  const list = [
    appt('a', '10:00', '11:00', {}, '2026-10-28'),
    appt('b', '12:00', '13:00', { staffKey: 'p2' }, '2026-10-28'),
    appt('c', '10:00', '11:00', { status: 'cancelled' }, '2026-10-28'),
    appt('d', '10:00', '11:00', {}, '2026-10-29'),
  ]

  it('K-sayım: gün başına randevu sayısı iptalleri saymaz ve İstanbul gününe göre gruplar', () => {
    expect(countByDay(list)).toEqual({ '2026-10-28': 2, '2026-10-29': 1 })
  })

  it('K-sayım: gece yarısına yakın randevu İstanbul gününe yazılır (UTC değil)', () => {
    const late = appt('l', '23:30', '23:45', {}, '2026-10-28')
    expect(countByDay([late])).toEqual({ '2026-10-28': 1 })
  })

  it('K-sayım: personel ve gün başına sayı', () => {
    expect(countByStaffDay(list)).toEqual({ p1: { '2026-10-28': 1, '2026-10-29': 1 }, p2: { '2026-10-28': 1 } })
  })
})
