// Stok saf mantığı (W25). Stok miktarı ve hareket sonucu sunucuda hesaplanır (tek işlemde); burada yalnız girdi okunur.
export type Item = {
  id: string
  name: string
  sku?: string | null
  quantity: number
  lowStockThreshold: number
  unitCost: number
  sellingPrice?: number | null
  unit: string
}
export type ProductValues = { name: string; sku: string; unit: string; quantityText: string; thresholdText: string; costText: string; priceText: string }
export type MovementValues = { type: string; quantityText: string; notes: string }

const collator = new Intl.Collator('tr')
const MAX_QTY = 1_000_000

/** Sunucuyla aynı kural: stok eşiğe eşit ya da altındaysa az; sıfırsa tükendi. */
export function stockStatus(item: Item): 'ok' | 'low' | 'out' {
  if (item.quantity <= 0) return 'out'
  return item.quantity <= item.lowStockThreshold ? 'low' : 'ok'
}

const RANK = { out: 0, low: 1, ok: 2 } as const

export function sortItems(items: readonly Item[]): Item[] {
  return [...items].sort((a, b) => RANK[stockStatus(a)] - RANK[stockStatus(b)] || collator.compare(a.name, b.name))
}

export const emptyProduct = (): ProductValues => ({ name: '', sku: '', unit: 'adet', quantityText: '0', thresholdText: '0', costText: '', priceText: '' })

const text = (value: number) => String(value).replace('.', ',')

export function toProductValues(item: Item): ProductValues {
  return {
    name: item.name,
    sku: item.sku ?? '',
    unit: item.unit,
    quantityText: String(item.quantity),
    thresholdText: String(item.lowStockThreshold),
    costText: text(item.unitCost),
    priceText: item.sellingPrice != null ? text(item.sellingPrice) : '',
  }
}

/** "49,90", "1.250,5", "50" okunur; başka biçim null. 0 geçerlidir. */
function parseMoney(raw: string): number | null {
  const value = raw.replace(/\s/g, '')
  let normalized: string | null = null
  if (/^\d+$/.test(value)) normalized = value
  else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value) || /^\d+,\d{1,2}$/.test(value)) normalized = value.replace(/\./g, '').replace(',', '.')
  else if (/^\d+\.\d{1,2}$/.test(value)) normalized = value
  return normalized === null ? null : Number(normalized)
}

function parseWholeNumber(raw: string): number | null {
  const value = raw.trim()
  if (!/^\d+$/.test(value)) return null
  const number = Number(value)
  return number <= MAX_QTY ? number : null
}

export function validateProduct(values: ProductValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = values.name.trim()
  if (name.length < 1 || name.length > 120) errors.name = 'Ürün adı 1 ile 120 karakter arasında olmalı.'
  if (values.sku.trim().length > 60) errors.sku = 'Stok kodu en çok 60 karakter olabilir.'
  const unit = values.unit.trim()
  if (unit.length < 1 || unit.length > 20) errors.unit = 'Birimi yazın (en çok 20 karakter). Örnek: adet, ml.'
  if (parseWholeNumber(values.quantityText) === null) errors.quantityText = 'Miktarı tam sayı olarak yazın (0 ile 1.000.000).'
  if (parseWholeNumber(values.thresholdText) === null) errors.thresholdText = 'Uyarı eşiğini tam sayı olarak yazın (0 ile 1.000.000).'
  if (parseMoney(values.costText) === null) errors.costText = 'Birim maliyeti rakamlarla yazın. Örnek: 49,90'
  if (values.priceText.trim() !== '' && parseMoney(values.priceText) === null) errors.priceText = 'Satış fiyatını rakamlarla yazın ya da boş bırakın.'
  return errors
}

export function productBody(values: ProductValues): Record<string, unknown> {
  const sku = values.sku.trim()
  const price = values.priceText.trim() === '' ? null : parseMoney(values.priceText)
  return {
    name: values.name.trim(),
    ...(sku ? { sku } : {}),
    unit: values.unit.trim(),
    quantity: parseWholeNumber(values.quantityText) ?? 0,
    lowStockThreshold: parseWholeNumber(values.thresholdText) ?? 0,
    unitCost: parseMoney(values.costText) ?? 0,
    ...(price !== null ? { sellingPrice: price } : {}),
  }
}

const MOVEMENT_LABELS: Record<string, string> = {
  in: 'Alım',
  out: 'Kullanım / satış',
  adjustment_in: 'Sayım fazlası',
  adjustment_out: 'Sayım eksiği',
  waste: 'Fire',
  return: 'İade',
}
export const MOVEMENT_TYPES = Object.keys(MOVEMENT_LABELS)
export const movementLabel = (type: string): string => MOVEMENT_LABELS[type] ?? 'Diğer'

const OUTGOING = new Set(['out', 'adjustment_out', 'waste', 'transfer_out'])

export function validateMovement(values: MovementValues, currentStock: number): Record<string, string> {
  const errors: Record<string, string> = {}
  const quantity = parseWholeNumber(values.quantityText)
  if (quantity === null || quantity < 1) errors.quantityText = 'Adedi 1 ile 1.000.000 arasında tam sayı olarak yazın.'
  else if (OUTGOING.has(values.type) && quantity > currentStock) errors.quantityText = `Mevcut stok ${currentStock}; bundan fazlasını çıkaramazsınız.`
  if (values.notes.length > 500) errors.notes = 'Not en çok 500 karakter olabilir.'
  return errors
}

export function movementBody(values: MovementValues): Record<string, unknown> {
  const notes = values.notes.trim()
  return { type: values.type, quantity: parseWholeNumber(values.quantityText) ?? 0, ...(notes ? { notes } : {}) }
}
