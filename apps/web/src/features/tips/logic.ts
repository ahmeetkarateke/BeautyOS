// Bahşiş saf mantığı (W26). Dağıtım tutarlarını sunucu hesaplar; burada yalnız doğrulama ve önizleme vardır.
export type TipValues = { staffId: string; amountText: string; source: string; notes: string }

function parseMoney(raw: string): number | null {
  const value = raw.trim().replace(/\s/g, '')
  let normalized: string | null = null
  if (/^\d+$/.test(value)) normalized = value
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value) || /^\d+,\d{1,2}$/.test(value)) normalized = value.replace(/\./g, '').replace(',', '.')
  else if (/^\d+\.\d{1,2}$/.test(value)) normalized = value
  return normalized === null ? null : Number(normalized)
}

export function validateTip(values: TipValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const amount = parseMoney(values.amountText)
  if (amount === null || amount <= 0) errors.amountText = 'Bahşiş tutarını rakamlarla yazın.'
  else if (amount > 1_000_000) errors.amountText = 'Tutar en çok ₺1.000.000 olabilir.'
  if (values.notes.length > 500) errors.notes = 'Not en çok 500 karakter olabilir.'
  return errors
}

export function tipBody(values: TipValues): Record<string, unknown> {
  const notes = values.notes.trim()
  return {
    amount: parseMoney(values.amountText) ?? 0,
    source: values.source,
    ...(values.staffId ? { staffId: values.staffId } : {}),
    ...(notes ? { notes } : {}),
  }
}

const SOURCES: Record<string, string> = { cash: 'Nakit', card: 'Kart', salon_pool: 'Salon havuzu' }
export const sourceLabel = (source: string) => SOURCES[source] ?? 'Diğer'

export function validateDistribute(staffIds: string[], pool: number): string | null {
  if (pool <= 0) return 'Dağıtılacak bahşiş yok.'
  if (staffIds.length === 0) return 'Dağıtılacak personeli seçin.'
  return null
}

/** Eşit ağırlık: kişi başı tutarı ve kuruş farkını sunucu hesaplar. */
export function distributeBody(staffIds: string[]) {
  return { distributions: staffIds.map((staffId) => ({ staffId, shareWeight: 1 })) }
}

export function shareOf(pool: number, count: number): number | null {
  return count > 0 ? Math.floor((pool * 100) / count) / 100 : null
}
