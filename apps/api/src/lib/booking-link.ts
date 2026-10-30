import { createHash, randomBytes } from 'node:crypto'
import { isHealthRegulated } from '@beautyos/shared'

// A7 / ADR-0043 + ADR-0046: müşterinin randevu bağlantısı. Token 32 bayt rastgele (base64url); veritabanında yalnız SHA-256
// özeti durur. Bağlantı web'de `#` parçasında taşınır (sunucu log'una düşmez), API'de yalnız istek gövdesinde gelir.
const HOUR_MS = 60 * 60 * 1000
/** M1: randevudan 2 saat öncesine kadar müşteri değiştirebilir / iptal edebilir. */
export const MODIFY_WINDOW_MS = 2 * HOUR_MS

export function hashManageToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newManageToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashManageToken(token) }
}

export function manageLink(token: string): string {
  const base = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
  return `${base}/book/manage#${token}`
}

export function modifyDeadline(startAt: Date): Date {
  return new Date(startAt.getTime() - MODIFY_WINDOW_MS)
}

/** Değiştirilebilir mi: durum bekleyen/onaylı ve son tarihe henüz gelinmemiş. */
export function canModify(status: string, startAt: Date, now: Date = new Date()): boolean {
  return (status === 'pending' || status === 'confirmed') && now.getTime() <= modifyDeadline(startAt).getTime()
}

/**
 * Online fiyat gösterimi: salon ayarı (`settings.showPricesOnline`) varsa o; yoksa sağlık mevzuatına tabi türlerde kapalı,
 * diğerlerinde açık. Kapalıyken `price` alanı yanıtlarda hiç bulunmaz (null da dönmez).
 */
export function showPricesOnline(settings: unknown, businessType: string): boolean {
  const configured = (settings as { showPricesOnline?: unknown } | null)?.showPricesOnline
  if (typeof configured === 'boolean') return configured
  return !isHealthRegulated(businessType)
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function icsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/** .ics içeriği: fiyat ve müşteri bilgisi yok; klinikte özet yalnız "Randevu" (hizmet adı geçmez). */
export function buildIcs(input: {
  appointmentId: string
  salonName: string
  serviceName: string
  businessType: string
  address: string | null
  startAt: Date
  endAt: Date
  now?: Date
}): string {
  const summary = isHealthRegulated(input.businessType) ? 'Randevu' : `${input.salonName} - ${input.serviceName}`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BeautyOS//Randevu//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.appointmentId}@beautyossapp.com`,
    `DTSTAMP:${icsUtc(input.now ?? new Date())}`,
    `DTSTART:${icsUtc(input.startAt)}`,
    `DTEND:${icsUtc(input.endAt)}`,
    `SUMMARY:${icsEscape(summary)}`,
    ...(input.address ? [`LOCATION:${icsEscape(input.address)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.join('\r\n')}\r\n`
}
