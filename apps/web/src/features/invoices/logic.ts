export type ItemValues = { name: string; quantityText: string; priceText: string; taxText: string; discountText: string }
export type InvoiceValues = { supplierId: string; invoiceNumber: string; invoiceDate: string; dueDate: string; notes: string; items: ItemValues[]; postNow: boolean }
export const emptyItem = (): ItemValues => ({ name: 'x', quantityText: 'x', priceText: 'x', taxText: 'x', discountText: 'x' })
export const itemTotals = (_i: ItemValues) => ({ net: -1, tax: -1, total: -1 })
export const invoiceTotals = (_i: readonly ItemValues[]) => ({ net: -1, tax: -1, total: -1 })
export const validateInvoice = (_v: InvoiceValues): { fields: Record<string, string>; items: Record<string, string>[] } => ({ fields: { x: 'x' }, items: [] })
export const invoiceBody = (_v: InvoiceValues): Record<string, unknown> => ({})
export const invoiceStatusLabel = (_s: string) => ''
export const invoiceActions = (_s: string): string[] => ['x']
