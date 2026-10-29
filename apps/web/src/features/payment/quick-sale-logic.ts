export type QuickSaleValues = { description: string; amountText: string; method: 'cash' | 'card'; date: string }
export const validateQuickSale = (_v: QuickSaleValues, _o: { today: string; canPickDate: boolean }): Partial<Record<keyof QuickSaleValues, string>> => ({ description: 'x' })
export const quickSaleBody = (_v: QuickSaleValues, _o: { today: string; canPickDate: boolean }): Record<string, unknown> => ({})
