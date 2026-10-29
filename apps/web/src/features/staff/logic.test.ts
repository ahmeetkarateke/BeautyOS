import { describe, expect, it } from 'vitest'
import { commissionLine, hoursBody, leaveTypeLabel, sortLeaves, validateHours, validateProfile, weekRows, type HourRow } from './logic'

describe('W21 weekRows', () => {
  it("K1: yedi gün Pazartesi'den başlar, Türkçe adlarla; çalışılmayan gün (null) kapalı görünür", () => {
    const rows = weekRows({ monday: { start: '09:00', end: '18:00' }, sunday: null })
    expect(rows.map((r) => r.label)).toEqual(['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'])
    expect(rows[0]).toEqual({ key: 'monday', label: 'Pazartesi', open: true, start: '09:00', end: '18:00' })
    expect(rows[6].open).toBe(false)
  })
  it('K1: hiç saat tanımı yoksa (null/boş) hepsi kapalı ve varsayılan saatler hazır gelir', () => {
    const rows = weekRows(null)
    expect(rows.every((r) => !r.open)).toBe(true)
    expect(rows[0].start).toBe('09:00')
    expect(rows[0].end).toBe('18:00')
  })
  it('K1: beklenmeyen biçim (dize, sayı) çökertmez, kapalı sayılır', () => {
    expect(weekRows({ monday: 'x', tuesday: { start: 5 } }).filter((r) => r.open)).toHaveLength(0)
  })
})

describe('W21 validateHours', () => {
  const rows = (over: Partial<HourRow> = {}): HourRow[] =>
    weekRows({ monday: { start: '09:00', end: '18:00' } }).map((r) => (r.key === 'monday' ? { ...r, ...over } : r))
  it('K2: geçerli program hatasızdır; kapalı günler doğrulanmaz', () => {
    expect(validateHours(rows())).toEqual({})
    expect(validateHours(rows({ open: false, start: '18:00', end: '09:00' }))).toEqual({})
  })
  it('K2: bitiş başlangıçtan önce ya da eşitse yalnız o gün hatalı (neden: saat sırası)', () => {
    expect(Object.keys(validateHours(rows({ start: '18:00', end: '09:00' })))).toEqual(['monday'])
    expect(Object.keys(validateHours(rows({ start: '10:00', end: '10:00' })))).toEqual(['monday'])
  })
  it('K2: HH:MM dışı biçim reddedilir', () => {
    expect(Object.keys(validateHours(rows({ start: '9:00' })))).toEqual(['monday'])
    expect(Object.keys(validateHours(rows({ end: '25:00' })))).toEqual(['monday'])
  })
})

describe('W21 hoursBody', () => {
  it('K3: açık gün {start,end}, kapalı gün null gönderilir; yedi anahtar hep vardır', () => {
    const body = hoursBody(weekRows({ monday: { start: '09:00', end: '18:00' } }))
    expect(Object.keys(body)).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    expect(body.monday).toEqual({ start: '09:00', end: '18:00' })
    expect(body.tuesday).toBeNull()
  })
})

describe('W21 validateProfile', () => {
  it('K4: unvan 1-100, özgeçmiş ≤500', () => {
    expect(validateProfile({ title: 'Kuaför', bio: '' })).toEqual({})
    expect(Object.keys(validateProfile({ title: ' ', bio: '' }))).toEqual(['title'])
    expect(Object.keys(validateProfile({ title: 'a'.repeat(101), bio: '' }))).toEqual(['title'])
    expect(Object.keys(validateProfile({ title: 'Kuaför', bio: 'x'.repeat(501) }))).toEqual(['bio'])
  })
})

describe('W21 commissionLine / leaveTypeLabel / sortLeaves', () => {
  it('K5: prim yüzde ve sabit tutar olarak okunur; sıfır "Prim yok"', () => {
    expect(commissionLine('percentage', 10)).toBe('%10 prim')
    expect(commissionLine('fixed', 50)).toBe('₺50 sabit prim')
    expect(commissionLine('percentage', 0)).toBe('Prim yok')
  })
  it('K6: izin türleri Türkçe; bilinmeyen tür "Diğer"', () => {
    expect(leaveTypeLabel('day_off')).toBe('Haftalık izin')
    expect(leaveTypeLabel('sick_leave')).toBe('Raporlu')
    expect(leaveTypeLabel('vacation')).toBe('Yıllık izin')
    expect(leaveTypeLabel('other')).toBe('Diğer')
    expect(leaveTypeLabel('zzz')).toBe('Diğer')
  })
  it('K6: izinler tarihe göre artan sıralanır', () => {
    expect(
      sortLeaves([
        { id: 'b', leaveDate: '2026-11-05', leaveType: 'day_off' },
        { id: 'a', leaveDate: '2026-11-01', leaveType: 'day_off' },
      ]).map((l) => l.id),
    ).toEqual(['a', 'b'])
  })
})
