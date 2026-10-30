// Europe/Istanbul gün sınırları (proje kuralı 3: API UTC çalışır, "gün" Türkiye gününe göre hesaplanır).
// Türkiye 2016'dan beri kalıcı UTC+3'tür (yaz saati yok); sabit ofset bu yüzden doğrudur. Kural değişirse burası ADR ister.

export const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000
export const MAX_RANGE_DAYS = 31
const DAY_MS = 24 * 60 * 60 * 1000

export type DayRange =
  | { ok: true; gte: Date; lt: Date }
  | { ok: false; reason: 'INVALID_RANGE' | 'RANGE_TOO_LARGE' }

/** 'YYYY-MM-DD' -> o Istanbul gününün 00:00'ının UTC anı; takvimde olmayan tarih (02-30) için null. */
function istanbulMidnightUtc(date: string): number | null {
  const [y, m, d] = date.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d)
  const check = new Date(utc)
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null
  return utc - ISTANBUL_OFFSET_MS
}

/** [dateFrom 00:00, dateTo ertesi gün 00:00) aralığı (Istanbul); dateTo günü dahildir. Sorguda `gte` ve `lt` kullanılır. */
export function istanbulDayRange(dateFrom: string, dateTo: string): DayRange {
  const from = istanbulMidnightUtc(dateFrom)
  const to = istanbulMidnightUtc(dateTo)
  if (from === null || to === null || from > to) return { ok: false, reason: 'INVALID_RANGE' }
  const days = Math.round((to - from) / DAY_MS) + 1
  if (days > MAX_RANGE_DAYS) return { ok: false, reason: 'RANGE_TOO_LARGE' }
  return { ok: true, gte: new Date(from), lt: new Date(to + DAY_MS) }
}

/** Prim dönemi gibi 31 günü aşabilen aralıklar için: tavan yok, [from 00:00, to ertesi gün 00:00) (Istanbul). */
export function istanbulPeriodBounds(dateFrom: string, dateTo: string): { gte: Date; lt: Date } | null {
  const from = istanbulMidnightUtc(dateFrom)
  const to = istanbulMidnightUtc(dateTo)
  if (from === null || to === null || from > to) return null
  return { gte: new Date(from), lt: new Date(to + DAY_MS) }
}

/** `now` anının İstanbul takvim gününün [başlangıç, bitiş] aralığı (UTC Date olarak; bitiş dahil, son milisaniye). */
export function istanbulDayBounds(now: Date): { start: Date; end: Date } {
  const shifted = now.getTime() + ISTANBUL_OFFSET_MS
  const dayStartShifted = shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS)
  const start = new Date(dayStartShifted - ISTANBUL_OFFSET_MS)
  return { start, end: new Date(start.getTime() + DAY_MS - 1) }
}
