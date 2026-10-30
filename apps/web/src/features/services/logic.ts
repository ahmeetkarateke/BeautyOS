import { formatMoney } from '@/ui/format'

// Hizmetler saf mantığı (W20). Kurallar sunucu şemasıyla uyumludur (ad 1-100, kategori ≤50, süre tam sayı ≥5, fiyat ≥0, ara süre ≥0).
export type ServiceRow = {
  id: string
  name: string
  category?: string | null
  durationMinutes: number
  price: number
  bufferMinutes?: number | null
  isActive: boolean
  isOnlineBookable?: boolean
}
export type ServiceValues = {
  name: string
  category: string
  durationText: string
  priceText: string
  bufferText: string
  isOnlineBookable: boolean
  isActive: boolean
}
export type ServiceErrors = Partial<Record<keyof ServiceValues, string>>

export const OTHER_CATEGORY = 'Diğer'
export const MIN_DURATION = 5
const MAX_DURATION = 720
const MAX_BUFFER = 240
const NAME_MAX = 100
const CATEGORY_MAX = 50
const collator = new Intl.Collator('tr')

export function groupByCategory(services: readonly ServiceRow[]): { category: string; services: ServiceRow[] }[] {
  const groups = new Map<string, ServiceRow[]>()
  for (const service of services) {
    const key = service.category?.trim() || OTHER_CATEGORY
    groups.set(key, [...(groups.get(key) ?? []), service])
  }
  const byName = (a: ServiceRow, b: ServiceRow) => Number(b.isActive) - Number(a.isActive) || collator.compare(a.name, b.name)
  return [...groups.entries()]
    .map(([category, list]) => ({ category, services: [...list].sort(byName) }))
    .sort((a, b) => (a.category === OTHER_CATEGORY ? 1 : b.category === OTHER_CATEGORY ? -1 : collator.compare(a.category, b.category)))
}

function durationText(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} sa` : `${hours} sa ${rest} dk`
}

export function serviceMeta(service: ServiceRow): string {
  return `${durationText(service.durationMinutes)} · ${service.price === 0 ? 'Ücretsiz' : formatMoney(service.price)}`
}

const INTEGER_RE = /^\d+$/

const MAX_PRICE = 1_000_000

/** "850", "850,5", "1.250,50", "850.50" okunur; 0 geçerlidir (ücretsiz). Başka biçim null. */
function parsePrice(text: string): number | null {
  const raw = text.replace(/\s/g, '')
  let normalized: string | null = null
  if (/^\d+$/.test(raw)) normalized = raw
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw) || /^\d+,\d{1,2}$/.test(raw)) normalized = raw.replace(/\./g, '').replace(',', '.')
  else if (/^\d+\.\d{1,2}$/.test(raw)) normalized = raw
  if (normalized === null) return null
  const value = Number(normalized)
  return value <= MAX_PRICE ? value : null
}

export function validateService(values: ServiceValues): ServiceErrors {
  const errors: ServiceErrors = {}
  const name = values.name.trim()
  if (name.length < 1) errors.name = 'Hizmet adını yazın.'
  else if (name.length > NAME_MAX) errors.name = `Ad en çok ${NAME_MAX} karakter olabilir.`
  if (values.category.trim().length > CATEGORY_MAX) errors.category = `Kategori en çok ${CATEGORY_MAX} karakter olabilir.`
  const duration = values.durationText.trim()
  if (!INTEGER_RE.test(duration) || Number(duration) < MIN_DURATION || Number(duration) > MAX_DURATION)
    errors.durationText = `Süreyi dakika olarak yazın. En az ${MIN_DURATION}, en çok ${MAX_DURATION} dakika.`
  if (parsePrice(values.priceText) === null) errors.priceText = 'Fiyatı rakamlarla yazın. Örnek: 850 ya da 850,50. Ücretsiz için 0.'
  const buffer = values.bufferText.trim()
  if (buffer !== '' && (!INTEGER_RE.test(buffer) || Number(buffer) > MAX_BUFFER))
    errors.bufferText = `Ara süreyi dakika olarak yazın (en çok ${MAX_BUFFER}). Yoksa 0 yazın.`
  return errors
}

export function emptyService(): ServiceValues {
  return { name: '', category: '', durationText: '', priceText: '', bufferText: '0', isOnlineBookable: true, isActive: true }
}

const priceText = (value: number) => String(value).replace('.', ',')

export function toFormValues(service: ServiceRow): ServiceValues {
  return {
    name: service.name,
    category: service.category ?? '',
    durationText: String(service.durationMinutes),
    priceText: priceText(service.price),
    bufferText: String(service.bufferMinutes ?? 0),
    isOnlineBookable: service.isOnlineBookable ?? true,
    isActive: service.isActive,
  }
}

/** Doğrulanmış form değerinden sayılar; doğrulamadan önce çağrılmaz. */
function numbers(values: ServiceValues) {
  return {
    durationMinutes: Number(values.durationText.trim()),
    price: parsePrice(values.priceText) ?? 0,
    bufferMinutes: Number(values.bufferText.trim() || '0'),
  }
}

export function toCreateBody(values: ServiceValues): Record<string, unknown> {
  const category = values.category.trim()
  return { name: values.name.trim(), ...(category ? { category } : {}), ...numbers(values), isOnlineBookable: values.isOnlineBookable }
}

/** Yalnız değişen alanlar gider. */
export function toUpdateBody(values: ServiceValues, original: ServiceRow): Record<string, unknown> {
  const before = toFormValues(original)
  const n = numbers(values)
  const body: Record<string, unknown> = {}
  if (values.name.trim() !== before.name) body.name = values.name.trim()
  if (values.category.trim() !== before.category) body.category = values.category.trim()
  if (n.durationMinutes !== original.durationMinutes) body.durationMinutes = n.durationMinutes
  if (n.price !== original.price) body.price = n.price
  if (n.bufferMinutes !== (original.bufferMinutes ?? 0)) body.bufferMinutes = n.bufferMinutes
  if (values.isOnlineBookable !== before.isOnlineBookable) body.isOnlineBookable = values.isOnlineBookable
  if (values.isActive !== before.isActive) body.isActive = values.isActive
  return body
}
