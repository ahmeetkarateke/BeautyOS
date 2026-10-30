import { z } from 'zod'

// Gün / randevu mantığı (saf fonksiyonlar; W10 Bugün, W11 Günüm, W12 Takvim ortak kullanır).
// Bütün saat hesapları Europe/Istanbul'a göre yapılır; sunucu ve tarayıcı saat dilimine bağımlı değildir.
const TZ = 'Europe/Istanbul'

export type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export type DayAppointment = {
  id: string
  /** Kişi anahtarı: A4 gelince staffId, o zamana dek adın anahtarı (nameKey). */
  staffKey: string
  staffName: string
  /** Müşterisiz online talepte null. */
  customerId: string | null
  serviceId: string | null
  customerName: string
  customerPhone: string
  /** Müşteri kaydıyla eşleşmemiş (telefonu doğrulanmamış) online talep. */
  unverified: boolean
  /** Kaynak: web (online talep), manual (panel), bot. API göndermiyorsa tanımsız. */
  bookingChannel?: string
  serviceName: string
  start: Date
  end: Date
  status: AppointmentStatus
  price: number
  notes: string
}

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** İstanbul'daki takvim günü, YYYY-MM-DD. */
export function istanbulDateStr(date: Date): string {
  return dateFormat.format(date)
}

/** İstanbul saatiyle gün başından geçen dakika. */
export function istanbulMinutes(date: Date): number {
  const parts = clockFormat.formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return get('hour') * 60 + get('minute')
}

export function minutesLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** 24 saatlik "14:30". */
export function clockLabel(date: Date): string {
  return clockFormat.format(date)
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Makine karşılaştırması: dil bağımsız küçük harf (Türk I'sı tuzağı yok), boşluklar sadeleşir. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

const STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'] as const

// GET /appointments satırı. staffId/customerId/serviceId/durationMinutes A4 ile gelir; yokken eksik kalabilir.
const rowSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  customerPhone: z.string().optional(),
  unverified: z.boolean().optional(),
  bookingChannel: z.string().optional(),
  serviceName: z.string(),
  staffName: z.string(),
  staffId: z.string().optional(),
  customerId: z.string().nullish(),
  serviceId: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.enum(STATUSES),
  priceCharged: z.number().optional(),
  notes: z.string().optional(),
})

export function parseDayAppointment(input: unknown): DayAppointment {
  const row = rowSchema.parse(input)
  const start = new Date(row.startTime)
  const end = new Date(row.endTime)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('Geçersiz randevu saati.')
  return {
    id: row.id,
    staffKey: row.staffId ?? nameKey(row.staffName),
    staffName: row.staffName,
    customerId: row.customerId ?? null,
    serviceId: row.serviceId ?? null,
    customerName: row.customerName,
    customerPhone: row.customerPhone ?? '',
    unverified: row.unverified ?? false,
    bookingChannel: row.bookingChannel,
    serviceName: row.serviceName,
    start,
    end,
    status: row.status,
    price: row.priceCharged ?? 0,
    notes: row.notes ?? '',
  }
}

export const isLive = (a: DayAppointment) => a.status !== 'cancelled' && a.status !== 'no_show'

export type StripRange = { startMin: number; endMin: number }
const DEFAULT_RANGE: StripRange = { startMin: 9 * 60, endMin: 20 * 60 }

/** Şerit aralığı: varsayılan 09:00-20:00; aralık dışına taşan randevu varsa tam saate yuvarlayarak genişler (hiçbiri gizlenmez). */
export function stripRange(appointments: readonly DayAppointment[]): StripRange {
  let { startMin, endMin } = DEFAULT_RANGE
  for (const a of appointments.filter(isLive)) {
    startMin = Math.min(startMin, Math.floor(istanbulMinutes(a.start) / 60) * 60)
    endMin = Math.max(endMin, Math.ceil(istanbulMinutes(a.end) / 60) * 60)
  }
  return { startMin, endMin }
}

/** Dakikanın aralıktaki yüzde konumu (0-100, taşma kırpılır). */
export function percentOf(minutes: number, range: StripRange): number {
  const value = ((minutes - range.startMin) / (range.endMin - range.startMin)) * 100
  return Math.min(100, Math.max(0, value))
}

export type StaffState = { kind: 'busy'; until: string } | { kind: 'free'; until: string } | { kind: 'closed' }

/** Kişi şu an meşgul mü, boşsa ne zamana kadar. Saati gelmiş ama bitmemiş onaylı randevu da kişiyi meşgul sayar. */
export function staffState(appointments: readonly DayAppointment[], staffKey: string, nowMin: number, range: StripRange): StaffState {
  if (nowMin < range.startMin || nowMin >= range.endMin) return { kind: 'closed' }
  const mine = appointments.filter((a) => a.staffKey === staffKey && isLive(a)).sort((a, b) => a.start.getTime() - b.start.getTime())
  const current = mine.find((a) => istanbulMinutes(a.start) <= nowMin && istanbulMinutes(a.end) > nowMin)
  if (current) return { kind: 'busy', until: clockLabel(current.end) }
  const next = mine.find((a) => istanbulMinutes(a.start) > nowMin)
  return { kind: 'free', until: next ? clockLabel(next.start) : minutesLabel(range.endMin) }
}

const OPEN_STATUSES: readonly AppointmentStatus[] = ['pending', 'confirmed', 'in_progress']

/** "Şimdi ve sırada": devam edenler, sonra bitmemiş en yakın randevular (geç kalanlar dahil, Başlat denebilsin). */
export function upNext(appointments: readonly DayAppointment[], nowMin: number, limit = 3): DayAppointment[] {
  const byStart = (a: DayAppointment, b: DayAppointment) => a.start.getTime() - b.start.getTime()
  const running = appointments.filter((a) => a.status === 'in_progress').sort(byStart)
  const upcoming = appointments
    .filter((a) => (a.status === 'confirmed' || a.status === 'pending') && istanbulMinutes(a.end) > nowMin)
    .sort(byStart)
    .slice(0, limit)
  return [...running, ...upcoming]
}

/** Doluluk %: iptal dışı sürelerin toplamı / (kişi sayısı x şerit aralığı). */
export function occupancyPercent(appointments: readonly DayAppointment[], staffCount: number, range: StripRange): number {
  if (staffCount <= 0) return 0
  const booked = appointments.filter(isLive).reduce((sum, a) => sum + (a.end.getTime() - a.start.getTime()) / 60000, 0)
  return Math.round((booked / (staffCount * (range.endMin - range.startMin))) * 100)
}

/** ADR-0045: pending yalnız onay bekleyen online talep demektir; panelden açılan (manual) randevu confirmed başlar. Kanal bilinmiyorsa talep kaybolmasın diye online sayılır. */
export const isOnlineRequest = (a: Pick<DayAppointment, 'status' | 'bookingChannel'>): boolean => a.status === 'pending' && a.bookingChannel !== 'manual'

export const pendingRequests = (appointments: readonly DayAppointment[]): DayAppointment[] =>
  appointments.filter(isOnlineRequest).sort((a, b) => a.start.getTime() - b.start.getTime())

/** Beklenen tutar: henüz tahsil edilmemiş açık randevuların fiyatı. */
export const expectedRevenue = (appointments: readonly DayAppointment[]): number =>
  appointments.filter((a) => OPEN_STATUSES.includes(a.status)).reduce((sum, a) => sum + a.price, 0)

export type Period = 'today' | 'week' | 'month'

/** Dönem sınırları (YYYY-MM-DD, iki uç dahil): hafta pazartesi-pazar, ay takvim ayı. */
export function periodRange(period: Period, today: string): { from: string; to: string } {
  if (period === 'today') return { from: today, to: today }
  const [y, m, d] = today.split('-').map(Number)
  if (period === 'week') {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    const from = addDaysToDateStr(today, dow === 0 ? -6 : 1 - dow)
    return { from, to: addDaysToDateStr(from, 6) }
  }
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const prefix = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`
  return { from: `${prefix}-01`, to: `${prefix}-${String(last).padStart(2, '0')}` }
}
