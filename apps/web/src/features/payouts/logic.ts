// Personel ödemesi saf mantığı (W26). Hak ediş (prim toplamı) ve net tutar sunucuda hesaplanır; burada yalnız önizleme ve doğrulama vardır.
export type PayoutValues = { staffId: string; from: string; to: string; bonusText: string; deductionsText: string; notes: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseMoney(raw: string): number | null {
  const value = raw.trim().replace(/\s/g, '')
  if (value === '') return 0
  let normalized: string | null = null
  if (/^\d+$/.test(value)) normalized = value
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value) || /^\d+,\d{1,2}$/.test(value)) normalized = value.replace(/\./g, '').replace(',', '.')
  else if (/^\d+\.\d{1,2}$/.test(value)) normalized = value
  return normalized === null ? null : Number(normalized)
}

/** Net = hak ediş + ek ödeme - kesinti (sunucu formülü). Geçersiz girdide null: net uydurulmaz. */
export function netAmount(gross: number, bonusText: string, deductionsText: string): number | null {
  const bonus = parseMoney(bonusText)
  const deductions = parseMoney(deductionsText)
  if (bonus === null || deductions === null) return null
  return (Math.round(gross * 100) + Math.round(bonus * 100) - Math.round(deductions * 100)) / 100
}

export function validatePayout(values: PayoutValues, today: string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.staffId) errors.staffId = 'Ödeme yapılacak personeli seçin.'
  if (!DATE_RE.test(values.from)) errors.from = 'Dönem başlangıcını seçin.'
  if (!DATE_RE.test(values.to)) errors.to = 'Dönem sonunu seçin.'
  else if (DATE_RE.test(values.from) && values.to < values.from) errors.to = 'Dönem sonu başlangıçtan önce olamaz.'
  else if (values.to > today) errors.to = 'Dönem sonu bugünden ileri olamaz.'
  if (parseMoney(values.bonusText) === null) errors.bonusText = 'Ek ödemeyi rakamlarla yazın; yoksa boş bırakın.'
  if (parseMoney(values.deductionsText) === null) errors.deductionsText = 'Kesintiyi rakamlarla yazın; yoksa boş bırakın.'
  if (values.notes.length > 500) errors.notes = 'Not en çok 500 karakter olabilir.'
  return errors
}

export function createBody(values: PayoutValues): Record<string, unknown> {
  const bonus = parseMoney(values.bonusText) ?? 0
  const deductions = parseMoney(values.deductionsText) ?? 0
  const notes = values.notes.trim()
  return {
    staffId: values.staffId,
    periodStart: values.from,
    periodEnd: values.to,
    ...(bonus > 0 ? { bonus } : {}),
    ...(deductions > 0 ? { deductions } : {}),
    ...(notes ? { notes } : {}),
  }
}

const STATUS: Record<string, string> = { pending: 'Bekliyor', paid: 'Ödendi', cancelled: 'İptal edildi' }
export const payoutStatusLabel = (status: string): string => STATUS[status] ?? 'Bilinmiyor'

const METHODS: Record<string, string> = { cash: 'Nakit', card: 'Kart', mixed: 'Karma', online: 'Havale / online' }
export const methodLabel = (method: string): string => METHODS[method] ?? 'Diğer'
