import { describe, expect, it } from 'vitest'
import type { DayAppointment } from '@/features/appointments/day-logic'
import { dropTarget, isMovable, moveToast } from './drag-logic'

const RANGE = { startMin: 9 * 60, endMin: 19 * 60 }
const HOUR_PX = 72
const at = (hhmm: string, day = '2026-10-28') => new Date(`${day}T${hhmm}:00+03:00`)
const NOW = at('11:30')

function appt(over: Partial<DayAppointment> = {}): DayAppointment {
  return {
    id: 'a1',
    staffKey: 'p1',
    staffName: 'Derya Aksoy',
    customerId: 'c1',
    serviceId: 'sv1',
    customerName: 'Ayşe',
    customerPhone: '0532 000 00 00',
    unverified: false,
    serviceName: 'Fön',
    start: at('14:00'),
    end: at('14:45'),
    status: 'confirmed',
    price: 500,
    notes: '',
    ...over,
  }
}

describe('W15 isMovable', () => {
  const can = { canReschedule: true, now: NOW }
  it('K1: ileri tarihli onaylı randevu taşınabilir', () => {
    expect(isMovable(appt(), can)).toBe(true)
  })
  it('K1: geçmiş saatteki randevu taşınamaz (başlangıç şimdiden önce)', () => {
    expect(isMovable(appt({ start: at('10:00'), end: at('10:45') }), can)).toBe(false)
  })
  it.each(['completed', 'cancelled', 'no_show', 'in_progress'] as const)('K1: %s durumundaki randevu taşınamaz', (status) => {
    expect(isMovable(appt({ status }), can)).toBe(false)
  })
  it('K2: saati değiştirme izni yoksa taşınamaz', () => {
    expect(isMovable(appt(), { ...can, canReschedule: false })).toBe(false)
  })
  it('K1: hizmeti silinmiş randevu taşınamaz (ayrıntı katmanındaki kuralla aynı)', () => {
    expect(isMovable(appt({ serviceId: null }), can)).toBe(false)
  })
})

describe('W15 dropTarget', () => {
  const base = {
    startMin: 14 * 60,
    durationMin: 45,
    hourPx: HOUR_PX,
    range: RANGE,
    date: '2026-10-28',
    nowMs: NOW.getTime(),
  }

  it('K3: kaydırma 15 dakikaya yuvarlanır (1 saat = 72 px)', () => {
    const t = dropTarget({ ...base, deltaPx: 72 })
    expect(t.startMin).toBe(15 * 60)
    expect(t.endMin).toBe(15 * 60 + 45)
    expect(t.startAt).toBe(at('15:00').toISOString())
    expect(t.valid).toBe(true)
    expect(t.changed).toBe(true)
  })
  it('K3: 7 dk çıkması en yakın dilime (15 dk) iner, 8 dk yukarı yuvarlanır', () => {
    expect(dropTarget({ ...base, deltaPx: (7 / 60) * HOUR_PX }).startMin).toBe(14 * 60)
    expect(dropTarget({ ...base, deltaPx: (8 / 60) * HOUR_PX }).startMin).toBe(14 * 60 + 15)
  })
  it('K3: aralığın dışına taşmaz: son bitiş aralığın sonunu geçmez', () => {
    const t = dropTarget({ ...base, deltaPx: 10 * HOUR_PX })
    expect(t.endMin).toBe(RANGE.endMin)
    expect(t.startMin).toBe(RANGE.endMin - 45)
  })
  it('K3: aralığın başından önceye gidemez', () => {
    expect(dropTarget({ ...base, deltaPx: -10 * HOUR_PX }).startMin).toBe(RANGE.startMin)
  })
  it('K4: şimdiden önceki bir saat geçersizdir (neden: past)', () => {
    const t = dropTarget({ ...base, deltaPx: -3 * HOUR_PX })
    expect(t.startMin).toBe(11 * 60)
    expect(t.valid).toBe(false)
    expect(t.reason).toBe('past')
  })
  it('K4: yalnız 11:15 (şimdi 11:30) geçersiz, 11:45 geçerli', () => {
    expect(dropTarget({ ...base, deltaPx: -(165 / 60) * HOUR_PX }).valid).toBe(false)
    expect(dropTarget({ ...base, deltaPx: -(135 / 60) * HOUR_PX }).valid).toBe(true)
  })
  it('K3: dilime oturmayan randevu (14:10) yarım dilimden az kaydırmada yerinde kalır', () => {
    const t = dropTarget({ ...base, startMin: 14 * 60 + 10, deltaPx: 3 })
    expect(t.startMin).toBe(14 * 60 + 10)
    expect(t.changed).toBe(false)
  })
  it('K3: aynı yere bırakmak değişiklik sayılmaz', () => {
    const t = dropTarget({ ...base, deltaPx: 2 })
    expect(t.changed).toBe(false)
  })
})

describe('W15 moveToast', () => {
  it('K5: yeni saat yönelme ekiyle yazılır (otuz -> a, on beş -> e)', () => {
    expect(moveToast('15:30')).toBe('Randevu 15:30’a taşındı.')
    expect(moveToast('15:15')).toBe('Randevu 15:15’e taşındı.')
  })
})
