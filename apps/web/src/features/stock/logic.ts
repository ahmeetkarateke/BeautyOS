export type Item = { id: string; name: string; sku?: string | null; quantity: number; lowStockThreshold: number; unitCost: number; sellingPrice?: number | null; unit: string }
export type ProductValues = { name: string; sku: string; unit: string; quantityText: string; thresholdText: string; costText: string; priceText: string }
export type MovementValues = { type: string; quantityText: string; notes: string }
export const stockStatus = (_i: Item): 'ok' | 'low' | 'out' => 'ok'
export const sortItems = (i: readonly Item[]): Item[] => [...i]
export const emptyProduct = (): ProductValues => ({ name: 'x', sku: 'x', unit: 'x', quantityText: 'x', thresholdText: 'x', costText: 'x', priceText: 'x' })
export const toProductValues = (_i: Item): ProductValues => emptyProduct()
export const validateProduct = (_v: ProductValues): Record<string, string> => ({ name: 'x' })
export const productBody = (_v: ProductValues): Record<string, unknown> => ({})
export const movementLabel = (_t: string) => ''
export const validateMovement = (_v: MovementValues, _stock: number): Record<string, string> => ({ type: 'x' })
export const movementBody = (_v: MovementValues): Record<string, unknown> => ({})
