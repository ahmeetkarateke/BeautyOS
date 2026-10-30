// Alış faturası saf mantığı (W25). Kesin hesap sunucudadır; burada yalnız önizleme (kuruş tam sayıyla) ve doğrulama vardır.
export type ItemValues = { name: string; quantityText: string; priceText: string; taxText: string; discountText: string }
export type InvoiceValues = {
  supplierId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  notes: string
  items: ItemValues[]
  postNow: boolean
}
export type Totals = { net: number; tax: number; total: number }

export const emptyItem = (): ItemValues => ({ name: '', quantityText: '1', priceText: '', taxText: '20', discountText: '0' })

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

function parseRate(raw: string): number | null {
  const value = raw.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null
  const number = Number(value)
  return number <= 100 ? number : null
}

const cents = (value: number) => Math.round(value * 100)

/** Sunucu formülü: net = max(0, adet x fiyat - indirim); KDV net üzerinden; toplam = net + KDV. Geçersiz girdi 0 sayılır. */
export function itemTotals(item: ItemValues): Totals {
  const quantity = parseWhole(item.quantityText, 1, 100000)
  const price = parseMoney(item.priceText)
  const discount = parseMoney(item.discountText || '0')
  const rate = parseRate(item.taxText || '0')
  if (quantity === null || price === null || discount === null || rate === null) return { net: 0, tax: 0, total: 0 }
  const net = Math.max(0, quantity * cents(price) - cents(discount))
  const tax = Math.round((net * rate) / 100)
  return { net: net / 100, tax: tax / 100, total: (net + tax) / 100 }
}

export function invoiceTotals(items: readonly ItemValues[]): Totals {
  const sum = items
    .map(itemTotals)
    .reduce((acc, t) => ({ net: acc.net + cents(t.net), tax: acc.tax + cents(t.tax), total: acc.total + cents(t.total) }), { net: 0, tax: 0, total: 0 })
  return { net: sum.net / 100, tax: sum.tax / 100, total: sum.total / 100 }
}

export function validateInvoice(values: InvoiceValues): { fields: Record<string, string>; items: Record<string, string>[] } {
  const fields: Record<string, string> = {}
  if (!values.supplierId) fields.supplierId = 'Tedarikçiyi seçin.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.invoiceDate)) fields.invoiceDate = 'Fatura tarihini seçin.'
  if (values.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(values.invoiceDate) && values.dueDate < values.invoiceDate)
    fields.dueDate = 'Vade tarihi fatura tarihinden önce olamaz.'
  if (values.invoiceNumber.trim().length > 50) fields.invoiceNumber = 'Fatura numarası en çok 50 karakter olabilir.'
  if (values.notes.length > 1000) fields.notes = 'Not en çok 1000 karakter olabilir.'
  if (values.items.length === 0) fields.items = 'En az bir kalem ekleyin.'
  const items = values.items.map((item) => {
    const errors: Record<string, string> = {}
    const name = item.name.trim()
    if (name.length < 1 || name.length > 200) errors.name = 'Kalem adını yazın (en çok 200 karakter).'
    if (parseWhole(item.quantityText, 1, 100000) === null) errors.quantityText = 'Adedi 1 ile 100.000 arasında tam sayı yazın.'
    if (parseMoney(item.priceText) === null) errors.priceText = 'Birim fiyatı rakamlarla yazın. Örnek: 49,90'
    if (parseRate(item.taxText || '0') === null) errors.taxText = 'KDV oranı 0 ile 100 arasında olmalı.'
    if (parseMoney(item.discountText || '0') === null) errors.discountText = 'İndirimi rakamlarla yazın; yoksa 0.'
    return errors
  })
  return { fields, items }
}

export function invoiceBody(values: InvoiceValues): Record<string, unknown> {
  const number = values.invoiceNumber.trim()
  const notes = values.notes.trim()
  return {
    supplierId: values.supplierId,
    ...(number ? { invoiceNumber: number } : {}),
    invoiceDate: values.invoiceDate,
    ...(values.dueDate ? { dueDate: values.dueDate } : {}),
    ...(notes ? { notes } : {}),
    items: values.items.map((item) => ({
      name: item.name.trim(),
      quantity: parseWhole(item.quantityText, 1, 100000) ?? 0,
      unitPrice: parseMoney(item.priceText) ?? 0,
      taxRate: parseRate(item.taxText || '0') ?? 0,
      discount: parseMoney(item.discountText || '0') ?? 0,
    })),
    ...(values.postNow ? { post: true } : {}),
  }
}

const LABELS: Record<string, string> = { draft: 'Taslak', posted: 'İşlendi', cancelled: 'İptal edildi' }
export const invoiceStatusLabel = (status: string): string => LABELS[status] ?? 'Bilinmiyor'

export type InvoiceAction = 'post' | 'cancel' | 'delete'
export function invoiceActions(status: string): InvoiceAction[] {
  if (status === 'draft') return ['post', 'delete']
  if (status === 'posted') return ['cancel']
  return []
}
