import { formatDate } from '@/ui/format'

// Bekleme listesi saf mantığı (W22). Sunucu yalnız durumu işaretler (notify mesaj göndermez): mesaj önizlemesi ve gönderim salon çalışanındadır.
export type WaitEntry = {
  id: string
  customerId: string
  customerName: string
  /** Telegram müşterisinde olmayabilir (ADR-0039). */
  customerPhone?: string | null
  serviceName?: string | null
  staffName?: string | null
  preferredDate?: string | null
  preferredTimeRange?: string | null
  status: string
  notes?: string | null
  notifiedAt?: string | null
  createdAt: string
}
export type AddValues = { customerId: string; serviceId: string; staffId: string; date: string; timeRange: string; notes: string }
export type AddErrors = Partial<Record<keyof AddValues, string>>

const LABELS: Record<string, string> = {
  waiting: 'Bekliyor',
  notified: 'Haber verildi',
  booked: 'Randevuya çevrildi',
  expired: 'Süresi doldu',
  cancelled: 'Listeden çıkarıldı',
}

export function statusLabel(status: string): string {
  return LABELS[status] ?? 'Bilinmiyor'
}

export function preferenceLine(entry: WaitEntry): string {
  const parts = [
    entry.serviceName,
    entry.staffName,
    entry.preferredDate ? formatDate(`${entry.preferredDate}T12:00:00+03:00`, 'short') : null,
    entry.preferredTimeRange,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(' · ') : 'Tercih belirtilmedi'
}

const RANK: Record<string, number> = { waiting: 0, notified: 1 }

/** Açık kayıtlar önce (bekleyen, haber verilen), kapalılar sonda; kendi içinde en eski önce (sıra adaleti). */
export function sortEntries(entries: readonly WaitEntry[]): WaitEntry[] {
  return [...entries].sort((a, b) => (RANK[a.status] ?? 2) - (RANK[b.status] ?? 2) || a.createdAt.localeCompare(b.createdAt))
}

export function canNotify(status: string): boolean {
  return status === 'waiting' || status === 'notified'
}

/** Ad ilk sözcüktür; harf büyütme/küçültme yapılmaz (Türk İ/ı bozulmaz). */
export function notifyMessage(entry: WaitEntry, salonName: string): string {
  const first = entry.customerName.trim().split(/\s+/)[0] || entry.customerName
  const subject = entry.serviceName ? `${entry.serviceName} için beklediğiniz saat` : 'beklediğiniz saat'
  return `Merhaba ${first}, ${salonName}: ${subject} müsait oldu. Uygunsanız bize yazın ya da arayın.`
}

export function validateAdd(values: AddValues, today: string): AddErrors {
  const errors: AddErrors = {}
  if (!values.customerId) errors.customerId = 'Listeye eklenecek kişiyi seçin.'
  if (values.date && values.date < today) errors.date = 'Tercih edilen tarih geçmişte olamaz.'
  return errors
}

export function createBody(values: AddValues): Record<string, unknown> {
  const timeRange = values.timeRange.trim()
  const notes = values.notes.trim()
  return {
    customerId: values.customerId,
    ...(values.serviceId ? { serviceId: values.serviceId } : {}),
    ...(values.staffId ? { staffId: values.staffId } : {}),
    ...(values.date ? { preferredDate: values.date } : {}),
    ...(timeRange ? { preferredTimeRange: timeRange } : {}),
    ...(notes ? { notes } : {}),
  }
}
