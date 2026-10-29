import { addDaysToDateStr, istanbulDateStr, istanbulMinutes, type DayAppointment } from '@/features/appointments/day-logic'

// Takvim saf mantığı (W12): tarih aralıkları, adres parametreleri, örtüşme yerleşimi, sayımlar.
// Tüm günler İstanbul takvim günüdür; tarihler "YYYY-MM-DD" metnidir (saat dilimi kayması olmaz).
export type CalendarView = 'gun' | 'hafta' | 'ay'
export type LaidOut = { appointment: DayAppointment; startMin: number; endMin: number; lane: number; lanes: number }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function utcDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Haftanın günü, pazartesi = 0 … pazar = 6. */
function mondayIndex(date: string): number {
  return (utcDate(date).getUTCDay() + 6) % 7
}

export function weekStart(date: string): string {
  return addDaysToDateStr(date, -mondayIndex(date))
}

export function weekDays(date: string): string[] {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(start, i))
}

export function monthGrid(date: string): { first: string; last: string; leading: number; days: string[] } {
  const [y, m] = date.split('-').map(Number)
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const prefix = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`
  const days = Array.from({ length }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`)
  return { first: days[0], last: days[length - 1], leading: mondayIndex(days[0]), days }
}

export function rangeFor(view: CalendarView, date: string): { from: string; to: string } {
  if (view === 'gun') return { from: date, to: date }
  if (view === 'hafta') return { from: weekStart(date), to: addDaysToDateStr(weekStart(date), 6) }
  const grid = monthGrid(date)
  return { from: grid.first, to: grid.last }
}

export function parseView(value: string | null | undefined): CalendarView {
  return value === 'hafta' || value === 'ay' ? value : 'gun'
}

/** Adres çubuğundaki tarih güvenilmez girdidir: biçim ve takvimde var olma kontrolü; olmazsa varsayılan. */
export function parseDateParam(value: string | null | undefined, fallback: string): string {
  if (!value || !DATE_RE.test(value)) return fallback
  return utcDate(value).toISOString().slice(0, 10) === value ? value : fallback
}

/**
 * Bir personel sütunundaki randevuları yan yana şeritlere yerleştirir. Birbirine zincirleme değen randevular bir gruptur;
 * grup içinde ilk boşalan şeride girilir, grubun şerit sayısı ortaktır (genişlik = 1 / lanes). İptal edilenler yer kaplamaz.
 */
export function layoutColumn(appointments: readonly DayAppointment[]): LaidOut[] {
  const items = appointments
    .filter((a) => a.status !== 'cancelled')
    .map((appointment) => ({ appointment, startMin: istanbulMinutes(appointment.start), endMin: istanbulMinutes(appointment.end) }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const result: LaidOut[] = []
  let group: LaidOut[] = []
  let groupEnd = -1
  let laneEnds: number[] = []

  const flush = () => {
    for (const item of group) item.lanes = laneEnds.length
    result.push(...group)
    group = []
    laneEnds = []
  }

  for (const item of items) {
    if (group.length > 0 && item.startMin >= groupEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= item.startMin)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = item.endMin
    group.push({ ...item, lane, lanes: 1 })
    groupEnd = Math.max(groupEnd, item.endMin)
  }
  flush()
  return result
}

export function countByDay(appointments: readonly DayAppointment[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const a of appointments) {
    if (a.status === 'cancelled') continue
    const day = istanbulDateStr(a.start)
    counts[day] = (counts[day] ?? 0) + 1
  }
  return counts
}

export function countByStaffDay(appointments: readonly DayAppointment[]): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = {}
  for (const a of appointments) {
    if (a.status === 'cancelled') continue
    const day = istanbulDateStr(a.start)
    const row = (counts[a.staffKey] ??= {})
    row[day] = (row[day] ?? 0) + 1
  }
  return counts
}
