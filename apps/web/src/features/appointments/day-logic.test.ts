import { describe, expect, it } from 'vitest'
import {
  addDaysToDateStr,
  clockLabel,
  istanbulDateStr,
  istanbulMinutes,
  nameKey,
  occupancyPercent,
  parseDayAppointment,
  pendingRequests,
  percentOf,
  periodRange,
  staffState,
  stripRange,
  upNext,
  type DayAppointment,
} from './day-logic'

const at = (hhmm: string) => new Date(`2026-10-28T${hhmm}:00+03:00`)

function appt(over: Partial<DayAppointment> & { id: string; from: string; to: string }): DayAppointment {
  const { from, to, ...rest } = over
  return {
    staffKey: 'p1',
    staffName: 'Derya Aksoy',
    customerId: 'c1',
    serviceId: 'sv1',
    customerName: 'Müşteri',
    customerPhone: '',
    unverified: false,
    serviceName: 'Fön',
    start: at(from),
    end: at(to),
    status: 'confirmed',
    price: 450,
    notes: '',
    ...rest,
  }
}

describe('W10: İstanbul saati', () => {
  it('K-saat: gece yarısını geçen UTC anı İstanbul’da ertesi gündür', () => {
    expect(istanbulDateStr(new Date('2026-10-28T21:30:00Z'))).toBe('2026-10-29')
    expect(istanbulDateStr(new Date('2026-10-28T20:59:00Z'))).toBe('2026-10-28')
  })

  it('K-saat: gün içi dakika İstanbul saatine göre hesaplanır (UTC+3)', () => {
    expect(istanbulMinutes(new Date('2026-10-28T11:20:00Z'))).toBe(14 * 60 + 20)
    expect(istanbulMinutes(new Date('2026-10-28T21:05:00Z'))).toBe(5)
  })

  it('K-saat: saat etiketi 24 saatlik HH:mm', () => {
    expect(clockLabel(at('09:05'))).toBe('09:05')
    expect(clockLabel(new Date('2026-10-28T21:00:00Z'))).toBe('00:00')
  })

  it('K-saat: gün ekleme ay ve yıl sınırını geçer', () => {
    expect(addDaysToDateStr('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDaysToDateStr('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('K-saat: ad anahtarı boşlukları sadeleştirir ve dil bağımsız küçültür (büyük I -> i, Türk I’sı tuzağı yok)', () => {
    expect(nameKey('  Elif   ŞAHIN ')).toBe('elif şahin')
    expect(nameKey('IRMAK Çelik')).toBe('irmak çelik')
  })
})

describe('W10: API satırı -> gün randevusu', () => {
  const row = {
    id: 'a1',
    customerName: 'Hande Polat',
    customerPhone: '05000000027',
    unverified: true,
    serviceName: 'Kadın saç kesimi',
    staffName: 'Elif Şahin',
    startTime: '2026-10-28T11:30:00.000Z',
    endTime: '2026-10-28T12:15:00.000Z',
    status: 'pending',
    priceCharged: 850,
    notes: 'Kısa kesim',
  }

  it('alanları eşler; staffId yoksa kişi anahtarı adın anahtarıdır', () => {
    const a = parseDayAppointment(row)
    expect(a.staffKey).toBe(nameKey('Elif Şahin'))
    expect(a.unverified).toBe(true)
    expect(a.start.toISOString()).toBe('2026-10-28T11:30:00.000Z')
  })

  it('staffId varsa kişi anahtarı staffId’dir', () => {
    expect(parseDayAppointment({ ...row, staffId: 'uuid-1' }).staffKey).toBe('uuid-1')
  })

  it('bilinmeyen durum ve bozuk tarih kapalı başarısızlıkla reddedilir', () => {
    expect(() => parseDayAppointment({ ...row, status: 'weird' })).toThrow()
    expect(() => parseDayAppointment({ ...row, startTime: 'dün' })).toThrow()
  })
})

describe('W10: şerit aralığı ve konum', () => {
  it('varsayılan 09:00-20:00', () => {
    expect(stripRange([])).toEqual({ startMin: 540, endMin: 1200 })
  })

  it('aralık dışı randevu şeridi tam saate yuvarlayarak genişletir', () => {
    const early = appt({ id: 'e', from: '08:15', to: '09:00' })
    const late = appt({ id: 'l', from: '20:30', to: '21:10' })
    expect(stripRange([early, late])).toEqual({ startMin: 480, endMin: 1320 })
  })

  it('iptal edilen randevu aralığı genişletmez', () => {
    expect(stripRange([appt({ id: 'c', from: '07:00', to: '08:00', status: 'cancelled' })])).toEqual({ startMin: 540, endMin: 1200 })
  })

  it('yüzde konumu aralığa göre hesaplanır', () => {
    expect(percentOf(540, { startMin: 540, endMin: 1200 })).toBe(0)
    expect(percentOf(870, { startMin: 540, endMin: 1200 })).toBe(50)
    expect(percentOf(2000, { startMin: 540, endMin: 1200 })).toBe(100)
    expect(percentOf(100, { startMin: 540, endMin: 1200 })).toBe(0)
  })
})

describe('W10: şu an boş / meşgul', () => {
  const range = { startMin: 540, endMin: 1200 }
  const now = 14 * 60 + 20

  it('devam eden randevu varsa meşgul ve bitişi söylenir', () => {
    const list = [appt({ id: '1', from: '13:30', to: '16:30', status: 'in_progress' })]
    expect(staffState(list, 'p1', now, range)).toEqual({ kind: 'busy', until: '16:30' })
  })

  it('saati gelmiş onaylı randevu da kişiyi meşgul sayar', () => {
    const list = [appt({ id: '1', from: '14:00', to: '15:00' })]
    expect(staffState(list, 'p1', now, range)).toEqual({ kind: 'busy', until: '15:00' })
  })

  it('boşsa bir sonraki randevuya kadar boş', () => {
    const list = [appt({ id: '1', from: '14:30', to: '15:15' })]
    expect(staffState(list, 'p1', now, range)).toEqual({ kind: 'free', until: '14:30' })
  })

  it('sonraki randevu yoksa mesai bitişine kadar boş', () => {
    expect(staffState([], 'p1', now, range)).toEqual({ kind: 'free', until: '20:00' })
  })

  it('iptal ve gelmedi randevular kişiyi meşgul saymaz', () => {
    const list = [
      appt({ id: '1', from: '14:00', to: '15:00', status: 'cancelled' }),
      appt({ id: '2', from: '14:10', to: '14:50', status: 'no_show' }),
    ]
    expect(staffState(list, 'p1', now, range)).toEqual({ kind: 'free', until: '20:00' })
  })

  it('başka kişinin randevusu sayılmaz', () => {
    const list = [appt({ id: '1', from: '14:00', to: '15:00', staffKey: 'p2' })]
    expect(staffState(list, 'p1', now, range).kind).toBe('free')
  })

  it('çalışma aralığı dışında kapalı', () => {
    expect(staffState([], 'p1', 8 * 60, range)).toEqual({ kind: 'closed' })
    expect(staffState([], 'p1', 20 * 60, range)).toEqual({ kind: 'closed' })
  })
})

describe('W10: şimdi ve sırada', () => {
  const now = 14 * 60 + 20

  it('devam edenler önce, sonra saati gelmemiş en yakın üç randevu', () => {
    const list = [
      appt({ id: 'bitti', from: '09:30', to: '11:00', status: 'completed' }),
      appt({ id: 'suruyor', from: '13:30', to: '16:30', status: 'in_progress' }),
      appt({ id: 'a', from: '17:00', to: '17:45' }),
      appt({ id: 'b', from: '14:30', to: '15:15', staffKey: 'p2' }),
      appt({ id: 'c', from: '15:30', to: '16:00', status: 'pending', staffKey: 'p2' }),
      appt({ id: 'd', from: '18:00', to: '18:30' }),
    ]
    expect(upNext(list, now).map((a) => a.id)).toEqual(['suruyor', 'b', 'c', 'a'])
  })

  it('geç kalan ama bitmemiş onaylı randevu listede kalır (Başlat denebilsin)', () => {
    const list = [appt({ id: 'gec', from: '14:00', to: '15:00' })]
    expect(upNext(list, now).map((a) => a.id)).toEqual(['gec'])
  })

  it('tamamlanan, iptal ve gelmedi listeye girmez', () => {
    const list = [
      appt({ id: '1', from: '15:00', to: '16:00', status: 'completed' }),
      appt({ id: '2', from: '15:00', to: '16:00', status: 'cancelled' }),
      appt({ id: '3', from: '15:00', to: '16:00', status: 'no_show' }),
    ]
    expect(upNext(list, now)).toEqual([])
  })
})

describe('W10: doluluk ve bekleyen talepler', () => {
  const range = { startMin: 540, endMin: 1200 }

  it('doluluk iptal dışı sürelerin toplamı / (kişi x aralık)', () => {
    const list = [
      appt({ id: '1', from: '09:00', to: '12:00' }),
      appt({ id: '2', from: '13:00', to: '14:00', status: 'cancelled' }),
      appt({ id: '3', from: '13:00', to: '16:30', staffKey: 'p2' }),
    ]
    // (180 + 210) / (2 x 660) = %29,5 -> 30
    expect(occupancyPercent(list, 2, range)).toBe(30)
  })

  it('kişi sayısı sıfırsa 0 (sıfıra bölme yok)', () => {
    expect(occupancyPercent([appt({ id: '1', from: '09:00', to: '10:00' })], 0, range)).toBe(0)
  })

  it('bekleyen talepler: yalnız pending, saate göre sıralı', () => {
    const list = [
      appt({ id: 'b', from: '17:00', to: '18:00', status: 'pending' }),
      appt({ id: 'x', from: '10:00', to: '11:00' }),
      appt({ id: 'a', from: '15:30', to: '16:00', status: 'pending' }),
    ]
    expect(pendingRequests(list).map((a) => a.id)).toEqual(['a', 'b'])
  })
})

describe('W10: dönem aralığı', () => {
  it('bugün: aynı gün', () => {
    expect(periodRange('today', '2026-10-28')).toEqual({ from: '2026-10-28', to: '2026-10-28' })
  })

  it('hafta: pazartesi-pazar (çarşamba için)', () => {
    expect(periodRange('week', '2026-10-28')).toEqual({ from: '2026-10-26', to: '2026-11-01' })
  })

  it('hafta: pazar günü kendi haftasının sonudur', () => {
    expect(periodRange('week', '2026-11-01')).toEqual({ from: '2026-10-26', to: '2026-11-01' })
  })

  it('ay: ayın ilk ve son günü (şubat, artık yıl)', () => {
    expect(periodRange('month', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(periodRange('month', '2026-10-28')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })
})
