import { formatDate, formatMoney } from '@/ui/format'

// Müşteri kartı saf mantığı (W18). Yetkiyi sunucu verir; sekme görünürlüğü yalnız arayüzü yönlendirir.
export type CardAppointment = { id: string; startTime: string; endTime: string; status: string; priceCharged: number; serviceName: string; staffName: string }
export type CardDetail = {
  id: string
  fullName: string
  /** Telegram müşterisinde olmayabilir (ADR-0039). */
  phone?: string | null
  email?: string | null
  birthDate?: string | null
  /** Yalnız health.view izni olan rol için gelir (R9). */
  allergyNotes?: string | null
  preferenceNotes?: string | null
  totalVisits: number
  lifetimeValue: number
  segment?: string | null
  lastVisitAt?: string | null
  marketingConsentSms: boolean
  marketingConsentEmail: boolean
  appointments: CardAppointment[]
}

export type TabValue = 'genel' | 'randevular' | 'saglik'

export function availableTabs(permissions: readonly string[]): { value: TabValue; label: string }[] {
  const tabs: { value: TabValue; label: string }[] = [
    { value: 'genel', label: 'Genel' },
    { value: 'randevular', label: 'Randevular' },
  ]
  // Sağlık sekmesi izinsiz rolde hiç çizilmez (kilitli sekme değil): içeriğin varlığı bile gösterilmez.
  if (permissions.includes('health.view')) tabs.push({ value: 'saglik', label: 'Sağlık bilgileri' })
  return tabs
}

export function summaryItems(detail: CardDetail): { label: string; value: string }[] {
  return [
    { label: 'Ziyaret', value: String(detail.totalVisits) },
    { label: 'Toplam harcama', value: formatMoney(detail.lifetimeValue) },
    { label: 'Son ziyaret', value: detail.lastVisitAt ? formatDate(detail.lastVisitAt, 'short') : 'Henüz yok' },
  ]
}

const UNANSWERED = 'Yanıtlanmadı'

/** Anamnez yanıtı okunur metne çevrilir; beklenmeyen biçimde ham veri basılmaz. */
export function formatAnswer(type: string, value: unknown): string {
  if (type === 'yes_no' && typeof value === 'boolean') return value ? 'Evet' : 'Hayır'
  if (Array.isArray(value)) {
    const items = value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    return items.length > 0 ? items.join(', ') : UNANSWERED
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim() !== '') return type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value, 'long') : value.trim()
  return UNANSWERED
}
