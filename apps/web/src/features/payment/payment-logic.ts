import { formatMoney } from '@/ui/format'

// Tamamla ve ödeme al saf mantığı (W16). Para hesabı sunucuda yapılır (Decimal); burada yalnız girdi okunur ve istek gövdesi kurulur.
export type PaymentMethod = 'cash' | 'card'
export type AmountResult = { ok: true; value: number } | { ok: false; error: string }

const MAX_AMOUNT = 1_000_000
const FORMAT_ERROR = 'Tutarı yalnız rakamlarla yazın. Örnek: 850 ya da 850,50'

/** "850", "850,5", "1.250,50", "1.250", "850.50" okunur; başka her biçim açıklamalı hata verir. */
export function parseAmount(text: string): AmountResult {
  const raw = text.replace(/\s/g, '')
  if (raw === '') return { ok: false, error: 'Tutarı yazın.' }
  let normalized: string | null = null
  if (/^\d+$/.test(raw)) normalized = raw
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw) || /^\d+,\d{1,2}$/.test(raw)) normalized = raw.replace(/\./g, '').replace(',', '.')
  else if (/^\d+\.\d{1,2}$/.test(raw)) normalized = raw
  if (normalized === null) return { ok: false, error: FORMAT_ERROR }
  const value = Number(normalized)
  if (value <= 0) return { ok: false, error: 'Tutar 0’dan büyük olmalı.' }
  if (value > MAX_AMOUNT) return { ok: false, error: 'Tutar çok yüksek. Rakamı kontrol edin.' }
  return { ok: true, value }
}

/** R3: uzman tutarı değiştiremez; sunucu da uzmanın gönderdiği tutarı yok sayar. */
export function canEditAmount(role: string): boolean {
  return role !== 'staff'
}

export function completeBody(input: { method: PaymentMethod; amount: number; listPrice: number; canEdit: boolean }): Record<string, unknown> {
  const body: Record<string, unknown> = { status: 'completed', paymentMethod: input.method }
  // Tutar değişmediyse gönderilmez: sunucu randevu fiyatını yazar. İndirim ayrı alan değil, yeni tutardır.
  if (input.canEdit && input.amount !== input.listPrice) body.priceCharged = input.amount
  return body
}

export function payLabel(amount: number): string {
  return `Ödeme al · ${formatMoney(amount)}`
}
