import { parseAmount } from '@/features/payment/payment-logic'
import { formatMoney } from '@/ui/format'

// Kasa ve gün sonu saf mantığı (W19). Beklenen nakit ve kapanış sunucuda hesaplanır; burada yalnız sayım farkı gösterilir.
export type DifferenceView = { amount: number; text: string; tone: 'ok' | 'short' | 'over' }

/** Fark = sayılan - beklenen; kuruş hesabı tam sayı kuruşla yapılır (kayan nokta hatası olmaz). */
export function differenceView(expected: number, counted: number): DifferenceView {
  const cents = Math.round(counted * 100) - Math.round(expected * 100)
  if (cents === 0) return { amount: 0, text: 'Fark yok', tone: 'ok' }
  const amount = cents / 100
  return cents < 0 ? { amount, text: `${formatMoney(-amount)} eksik`, tone: 'short' } : { amount, text: `${formatMoney(amount)} fazla`, tone: 'over' }
}

/** Sayım isteğe bağlı: boş = sayım yok. 0 geçerlidir. */
export function validateCount(text: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const raw = text.trim()
  if (raw === '') return { ok: true, value: null }
  if (/^0([,.]0{1,2})?$/.test(raw)) return { ok: true, value: 0 }
  const parsed = parseAmount(raw)
  return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, error: parsed.error }
}

export function closeBody(counted: number | null, note: string): Record<string, unknown> {
  const trimmed = note.trim()
  return { ...(counted !== null ? { countedCash: counted } : {}), ...(trimmed ? { note: trimmed } : {}) }
}

const REASON_MIN = 3

export function reopenIssue(reason: string): string | null {
  return reason.trim().length < REASON_MIN ? `Neden en az ${REASON_MIN} karakter olmalı. Kimin neden açtığı kayıt altında tutulur.` : null
}

export function reopenBody(date: string, reason: string): Record<string, unknown> {
  return { date, reason: reason.trim() }
}
