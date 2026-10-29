export type ServiceRow = { id: string; name: string; category?: string | null; durationMinutes: number; price: number; bufferMinutes?: number | null; isActive: boolean; isOnlineBookable?: boolean }
export type ServiceValues = { name: string; category: string; durationText: string; priceText: string; bufferText: string; isOnlineBookable: boolean; isActive: boolean }
export type ServiceErrors = Partial<Record<keyof ServiceValues, string>>
export const groupByCategory = (_s: readonly ServiceRow[]): { category: string; services: ServiceRow[] }[] => [{ category: 'x', services: [] }]
export const serviceMeta = (_s: ServiceRow) => ''
export const validateService = (_v: ServiceValues): ServiceErrors => ({ name: 'x' })
export const toCreateBody = (_v: ServiceValues): Record<string, unknown> => ({})
export const emptyService = (): ServiceValues => ({ name: 'x', category: 'x', durationText: 'x', priceText: 'x', bufferText: 'x', isOnlineBookable: false, isActive: false })
export const toFormValues = (_s: ServiceRow): ServiceValues => emptyService()
export const toUpdateBody = (_v: ServiceValues, _s: ServiceRow): Record<string, unknown> => ({ x: 1 })
