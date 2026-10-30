import { formatMoney } from '@/ui/format'

// Paket tanımı saf mantığı (W26). Satış ve seans düşme sunucuda yapılır; burada yalnız tanım girdisi okunur.
export type PackageRow = {
  id: string
  name: string
  serviceId: string
  serviceName?: string | null
  totalSessions: number
  price: number
  validityDays?: number | null
  description?: string | null
  isActive: boolean
}
export type PackageValues = {
  serviceId: string
  name: string
  sessionsText: string
  priceText: string
  validityText: string
  description: string
  isActive: boolean
}

const collator = new Intl.Collator('tr')

export function perSession(price: number, sessions: number): number {
  return sessions > 0 ? Math.round((price / sessions) * 100) / 100 : 0
}

export function packageMeta(pkg: PackageRow): string {
  const validity = pkg.validityDays ? `${pkg.validityDays} gün geçerli` : 'Süresiz'
  return `${pkg.totalSessions} seans · ${formatMoney(pkg.price)} · ${validity}`
}

export function sortPackages(packages: readonly PackageRow[]): PackageRow[] {
  return [...packages].sort((a, b) => Number(b.isActive) - Number(a.isActive) || collator.compare(a.name, b.name))
}

export const emptyPackage = (): PackageValues => ({
  serviceId: '',
  name: '',
  sessionsText: '',
  priceText: '',
  validityText: '',
  description: '',
  isActive: true,
})

const text = (value: number) => String(value).replace('.', ',')

export function toPackageValues(pkg: PackageRow): PackageValues {
  return {
    serviceId: pkg.serviceId,
    name: pkg.name,
    sessionsText: String(pkg.totalSessions),
    priceText: text(pkg.price),
    validityText: pkg.validityDays ? String(pkg.validityDays) : '',
    description: pkg.description ?? '',
    isActive: pkg.isActive,
  }
}

function parseMoney(raw: string): number | null {
  const value = raw.replace(/\s/g, '')
  let normalized: string | null = null
  if (/^\d+$/.test(value)) normalized = value
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value) || /^\d+,\d{1,2}$/.test(value)) normalized = value.replace(/\./g, '').replace(',', '.')
  else if (/^\d+\.\d{1,2}$/.test(value)) normalized = value
  return normalized === null ? null : Number(normalized)
}

function parseWhole(raw: string, min: number, max: number): number | null {
  const value = raw.trim()
  if (!/^\d+$/.test(value)) return null
  const number = Number(value)
  return number >= min && number <= max ? number : null
}

export function validatePackage(values: PackageValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.serviceId) errors.serviceId = 'Paketin hangi hizmet için olduğunu seçin.'
  const name = values.name.trim()
  if (name.length < 2 || name.length > 100) errors.name = 'Paket adı 2 ile 100 karakter arasında olmalı.'
  if (parseWhole(values.sessionsText, 1, 100) === null) errors.sessionsText = 'Seans sayısını 1 ile 100 arasında tam sayı yazın.'
  const price = parseMoney(values.priceText)
  if (price === null || price <= 0) errors.priceText = 'Paket fiyatını 0’dan büyük rakamla yazın. Örnek: 3.000'
  if (values.validityText.trim() !== '' && parseWhole(values.validityText, 1, 1095) === null)
    errors.validityText = 'Geçerlilik süresini 1 ile 1095 gün arasında yazın ya da boş bırakın.'
  if (values.description.length > 500) errors.description = 'Açıklama en çok 500 karakter olabilir.'
  return errors
}

export function packageBody(values: PackageValues): Record<string, unknown> {
  const description = values.description.trim()
  return {
    serviceId: values.serviceId,
    name: values.name.trim(),
    totalSessions: parseWhole(values.sessionsText, 1, 100) ?? 0,
    price: parseMoney(values.priceText) ?? 0,
    validityDays: values.validityText.trim() === '' ? null : parseWhole(values.validityText, 1, 1095),
    ...(description ? { description } : {}),
    isActive: values.isActive,
  }
}
