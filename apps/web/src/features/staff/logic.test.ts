import { describe, expect, it } from 'vitest'
import { commissionLine, hoursBody, leaveTypeLabel, salonRows, sortLeaves, usesSalonHours, validateHours, validateProfile, weekRows, type HourRow } from './logic'

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
    const withTuesday = rows({ open: false, start: '18:00', end: '09:00' }).map((r) => (r.label === 'Salı' ? { ...r, open: true } : r))
    expect(validateHours(withTuesday)).toEqual({})
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

describe('W21-1 salon saatleri ve özel saat', () => {
  it('K7: personelin hiç açık günü yoksa "salon saatleri kullanılıyor" sayılır; bir gün açıksa özel saattir', () => {
    expect(usesSalonHours(weekRows(null))).toBe(true)
    expect(usesSalonHours(weekRows({ monday: null, sunday: null }))).toBe(true)
    expect(usesSalonHours(weekRows({ monday: { start: '09:00', end: '18:00' } }))).toBe(false)
  })
  it('K8: salon saati nesne biçiminde de, eski "09:00-19:00" dize biçiminde de (Pazartesi-Cumartesi) satırlara çevrilir', () => {
    const fromObject = salonRows({ monday: { start: '10:00', end: '19:00' } })
    expect(fromObject[0]).toMatchObject({ open: true, start: '10:00', end: '19:00' })
    const fromString = salonRows('09:00-19:00')
    expect(fromString.filter((r) => r.open).map((r) => r.label)).toEqual(['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'])
    expect(fromString[6].open).toBe(false)
    expect(salonRows(undefined).every((r) => !r.open)).toBe(true)
  })
  it('K9: hepsi kapalı özel program kaydedilemez (sunucu bunu salon saatine çevirir): neden metni yazılır', () => {
    expect(validateHours(weekRows(null))).toEqual({ _all: 'En az bir gün açık olmalı. Hiç gün açık değilse salon çalışma saatleri kullanılır.' })
  })
})
