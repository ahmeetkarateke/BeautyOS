import { formatDate } from '@/ui/format'

// Müşteri listesi saf mantığı (W17). Uzman için liste yoktur (R4): yalnız arama kipi, en az 3 karakter, en çok 10 sonuç.
// Yetkiyi sunucu verir; bu dosya yalnız arayüzü yönlendirir.
export type CustomerRow = {
  id: string
  fullName: string
  /** Telegram müşterisinde telefon olmayabilir (ADR-0039). */
  phone?: string | null
  phoneMasked?: boolean
  isOwn?: boolean
  totalVisits?: number | null
  lastVisitDate?: string | null
}

export const STAFF_MIN_CHARS = 3
export const LIST_MIN_CHARS = 2

/** Uzman gibi tüm müşteri listesini göremeyen rol arama kipine düşer. */
export function searchMode(canViewAll: boolean): boolean {
  return !canViewAll
}

/**
 * list: liste yüklenir (arama yok ya da çok kısa); search: arama isteği atılır;
 * idle: arama kipinde henüz yazılmadı (liste gösterilmez); short: arama kipinde yetersiz karakter.
 */
export function searchPhase(term: string, staffMode: boolean): 'list' | 'search' | 'idle' | 'short' {
  const length = Array.from(term.trim()).length
  if (staffMode) return length === 0 ? 'idle' : length < STAFF_MIN_CHARS ? 'short' : 'search'
  return length < LIST_MIN_CHARS ? 'list' : 'search'
}

/** Maskeli ve kendi müşterisi olmayan kart açılmaz (R4). Alanlar gelmediyse (sahip listesi) açılır. */
export function canOpen(row: CustomerRow): boolean {
  return !(row.phoneMasked === true && row.isOwn === false)
}

export function phoneLine(row: CustomerRow): string {
  return row.phone ? row.phone : 'Telefon yok'
}

/** Ziyaret bilgisi yoksa (maskeli kayıt) boş: sayı uydurulmaz. */
export function visitLine(row: CustomerRow): string {
  if (row.totalVisits === null || row.totalVisits === undefined) return ''
  if (row.totalVisits === 0) return 'Henüz ziyaret yok'
  const last = row.lastVisitDate ? formatDate(row.lastVisitDate, 'short') : ''
  return last ? `${row.totalVisits} ziyaret · son: ${last}` : `${row.totalVisits} ziyaret`
}
