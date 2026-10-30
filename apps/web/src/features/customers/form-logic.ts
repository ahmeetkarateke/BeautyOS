import { toNationalDigits } from '@/ui/phone'

// Müşteri formu saf mantığı (W17). Alan kuralları sunucunun şemasıyla uyumludur (ad 2-100, e-posta, YYYY-MM-DD, not 500);
// asıl doğrulama sunucudadır, burada yalnız kullanıcıya erken ve anlaşılır hata verilir.
export type CustomerValues = { fullName: string; phoneDigits: string; email: string; birthDate: string; preferenceNotes: string }
export type CustomerErrors = Partial<Record<keyof CustomerValues, string>>
export type ServerCustomer = {
  id: string
  fullName: string
  /** Telegram müşterisinde olmayabilir (ADR-0039). */
  phone?: string | null
  email?: string | null
  birthDate?: string | null
  preferenceNotes?: string | null
}

export const NAME_MAX = 100
export const NOTES_MAX = 500
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const emptyValues = (): CustomerValues => ({ fullName: '', phoneDigits: '', email: '', birthDate: '', preferenceNotes: '' })

function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export function validateCustomer(values: CustomerValues, options: { today: string; phoneRequired: boolean }): CustomerErrors {
  const errors: CustomerErrors = {}
  const name = values.fullName.trim()
  if (name.length < 2) errors.fullName = 'Adı yazın. En az 2 harf gerekir.'
  else if (name.length > NAME_MAX) errors.fullName = `Ad en çok ${NAME_MAX} karakter olabilir.`

  const digits = values.phoneDigits
  if (digits === '' ? options.phoneRequired : !/^5\d{9}$/.test(digits)) errors.phoneDigits = 'Telefonu 5xx xxx xx xx biçiminde yazın.'

  const email = values.email.trim()
  if (email !== '' && !EMAIL_RE.test(email)) errors.email = 'E-posta adresini kontrol edin. Örnek: ad@ornek.com'

  const birth = values.birthDate
  if (birth !== '' && (!isRealDate(birth) || birth >= options.today)) errors.birthDate = 'Doğum tarihi geçmiş bir gün olmalı.'

  if (values.preferenceNotes.length > NOTES_MAX) errors.preferenceNotes = `Not en çok ${NOTES_MAX} karakter olabilir.`
  return errors
}

export function toCreatePayload(values: CustomerValues, allowSharedPhone: boolean): Record<string, unknown> {
  const email = values.email.trim()
  return {
    fullName: values.fullName.trim(),
    phone: `0${values.phoneDigits}`,
    ...(email ? { email } : {}),
    ...(values.birthDate ? { birthDate: values.birthDate } : {}),
    ...(allowSharedPhone ? { allowSharedPhone: true } : {}),
  }
}

export function toFormValues(customer: ServerCustomer): CustomerValues {
  return {
    fullName: customer.fullName,
    phoneDigits: customer.phone ? toNationalDigits(customer.phone) : '',
    email: customer.email ?? '',
    birthDate: customer.birthDate ? customer.birthDate.slice(0, 10) : '',
    preferenceNotes: customer.preferenceNotes ?? '',
  }
}

/** Yalnız değişen alanlar gider (kısmi güncelleme); silinen isteğe bağlı alan null ile temizlenir. */
export function toUpdatePayload(values: CustomerValues, original: ServerCustomer, allowSharedPhone: boolean): Record<string, unknown> {
  const before = toFormValues(original)
  const payload: Record<string, unknown> = {}
  if (values.fullName.trim() !== before.fullName) payload.fullName = values.fullName.trim()
  if (values.phoneDigits !== before.phoneDigits && values.phoneDigits !== '') {
    payload.phone = `0${values.phoneDigits}`
    if (allowSharedPhone) payload.allowSharedPhone = true
  }
  if (values.email.trim() !== before.email) payload.email = values.email.trim() || null
  if (values.birthDate !== before.birthDate) payload.birthDate = values.birthDate || null
  if (values.preferenceNotes !== before.preferenceNotes) payload.preferenceNotes = values.preferenceNotes || null
  return payload
}
