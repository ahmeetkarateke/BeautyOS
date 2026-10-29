import { addDaysToDateStr } from '@/features/appointments/day-logic'

// Rapor saf mantığı (W23). Tarihler İstanbul takvim günüdür ("YYYY-MM-DD" metni); hesap sunucudadır.
export type Preset = 'today' | 'week' | 'month'
export type CommissionRow = { staffId: string; staffName: string; completedAppointments: number; revenue: number; commission: number }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAYS = 31
const collator = new Intl.Collator('tr')

export function periodRange(preset: Preset, today: string): { from: string; to: string } {
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') return { from: addDaysToDateStr(today, -6), to: today }
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export function validateRange(from: string, to: string, today: string): string | null {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return 'Başlangıç ve bitiş tarihini seçin.'
  if (from > to) return 'Başlangıç tarihi bitişten sonra olamaz.'
  if (to > today) return 'Rapor için gelecek bir tarih seçilemez.'
  if (dayDiff(from, to) >= MAX_DAYS) return 'En çok 31 günlük aralık seçebilirsiniz.'
  return null
}

/** Prim büyükten küçüğe; eşitse ada göre Türkçe sırayla. */
export function sortCommissions(rows: readonly CommissionRow[]): CommissionRow[] {
  return [...rows].sort((a, b) => b.commission - a.commission || collator.compare(a.staffName, b.staffName))
}
