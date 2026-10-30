import { parseAmount, type PaymentMethod } from './payment-logic'

// Randevusuz işlem (hızlı satış) saf mantığı (W16b). Sunucu: POST /revenues {description, amount, paymentMethod, revenueDate};
// tarih seçme yetkisi olmayan rol (resepsiyon) yalnız bugüne yazar, sunucu geçmiş tarihe 403 verir.
export type QuickSaleValues = { description: string; amountText: string; method: PaymentMethod; date: string }
export type QuickSaleErrors = Partial<Record<keyof QuickSaleValues, string>>
type Options = { today: string; canPickDate: boolean }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validateQuickSale(values: QuickSaleValues, options: Options): QuickSaleErrors {
  const errors: QuickSaleErrors = {}
  if (values.description.trim() === '') errors.description = 'Ne için olduğunu yazın. Örnek: Ürün satışı'
  const amount = parseAmount(values.amountText)
  if (!amount.ok) errors.amountText = amount.error
  if (options.canPickDate) {
    if (!DATE_RE.test(values.date)) errors.date = 'Tarihi seçin.'
    else if (values.date > options.today) errors.date = 'Tarih bugünden ileri olamaz.'
  }
  return errors
}

/** Doğrulamadan sonra çağrılır. */
export function quickSaleBody(values: QuickSaleValues, options: Options): Record<string, unknown> {
  const amount = parseAmount(values.amountText)
  return {
    description: values.description.trim(),
    amount: amount.ok ? amount.value : 0,
    paymentMethod: values.method,
    revenueDate: options.canPickDate ? values.date : options.today,
  }
}
