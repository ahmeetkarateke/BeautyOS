import { formatMoney } from '@/ui/format'

// Personel saf mantığı (W21): çalışma saatleri (gün başına {start,end} ya da null), profil, prim ve izin yardımcıları.
export type HourRow = { key: string; label: string; open: boolean; start: string; end: string }
export type Leave = { id: string; leaveDate: string; leaveType: string; note?: string | null }

const DAYS = [
  ['monday', 'Pazartesi'],
  ['tuesday', 'Salı'],
  ['wednesday', 'Çarşamba'],
  ['thursday', 'Perşembe'],
  ['friday', 'Cuma'],
  ['saturday', 'Cumartesi'],
  ['sunday', 'Pazar'],
] as const
const DEFAULT_START = '09:00'
const DEFAULT_END = '18:00'
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function readDay(value: unknown): { start: string; end: string } | null {
  if (!value || typeof value !== 'object') return null
  const { start, end } = value as { start?: unknown; end?: unknown }
  return typeof start === 'string' && typeof end === 'string' ? { start, end } : null
}

/** Sunucudaki serbest biçimli workingHours, ekranın yedi satırına çevrilir; anlaşılmayan gün kapalı sayılır. */
export function weekRows(workingHours: unknown): HourRow[] {
  const source = workingHours && typeof workingHours === 'object' && !Array.isArray(workingHours) ? (workingHours as Record<string, unknown>) : {}
  return DAYS.map(([key, label]) => {
    const day = readDay(source[key])
    return { key, label, open: day !== null, start: day?.start ?? DEFAULT_START, end: day?.end ?? DEFAULT_END }
  })
}

/** Yalnız açık günler doğrulanır; hatalı günün anahtarı hata metniyle döner. */
export function validateHours(rows: readonly HourRow[]): Record<string, string> {
  const errors: Record<string, string> = {}
  // Hiç gün açık değilse sunucu personeli salon saatlerine düşürür: "hepsi kapalı" anlamsız bir kayıt olur, engellenir.
  if (!rows.some((row) => row.open)) return { _all: 'En az bir gün açık olmalı. Hiç gün açık değilse salon çalışma saatleri kullanılır.' }
  for (const row of rows) {
    if (!row.open) continue
    if (!TIME_RE.test(row.start) || !TIME_RE.test(row.end)) errors[row.key] = `${row.label}: saatleri 09:00 biçiminde yazın.`
    else if (row.end <= row.start) errors[row.key] = `${row.label}: bitiş saati başlangıçtan sonra olmalı.`
  }
  return errors
}

/** Personelin hiç açık günü yoksa sunucu salon çalışma saatlerini kullanır (lib/slots). */
export const usesSalonHours = (rows: readonly HourRow[]): boolean => !rows.some((row) => row.open)

/** Salon saati nesne ya da eski "09:00-19:00" dizesi olabilir (dize: Pazartesi-Cumartesi). */
export function salonRows(value: unknown): HourRow[] {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/)
    if (match) {
      const day = { start: match[1], end: match[2] }
      return weekRows({ monday: day, tuesday: day, wednesday: day, thursday: day, friday: day, saturday: day, sunday: null })
    }
    return weekRows(null)
  }
  return weekRows(value)
}

export function hoursBody(rows: readonly HourRow[]): Record<string, unknown> {
  return Object.fromEntries(rows.map((row) => [row.key, row.open ? { start: row.start, end: row.end } : null]))
}

const TITLE_MAX = 100
const BIO_MAX = 500

export function validateProfile(values: { title: string; bio: string }): Record<string, string> {
  const errors: Record<string, string> = {}
  const title = values.title.trim()
  if (title.length < 1) errors.title = 'Unvanı yazın.'
  else if (title.length > TITLE_MAX) errors.title = `Unvan en çok ${TITLE_MAX} karakter olabilir.`
  if (values.bio.length > BIO_MAX) errors.bio = `Özgeçmiş en çok ${BIO_MAX} karakter olabilir.`
  return errors
}

export function commissionLine(type: string, value: number): string {
  if (!value) return 'Prim yok'
  return type === 'fixed' ? `${formatMoney(value)} sabit prim` : `%${value} prim`
}

const LEAVE_LABELS: Record<string, string> = { day_off: 'Haftalık izin', sick_leave: 'Raporlu', vacation: 'Yıllık izin', other: 'Diğer' }
export const leaveTypeLabel = (type: string): string => LEAVE_LABELS[type] ?? 'Diğer'

export function sortLeaves(leaves: readonly Leave[]): Leave[] {
  return [...leaves].sort((a, b) => a.leaveDate.localeCompare(b.leaveDate))
}
