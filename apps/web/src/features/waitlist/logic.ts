export type WaitEntry = { id: string; customerId: string; customerName: string; customerPhone?: string | null; serviceName?: string | null; staffName?: string | null; preferredDate?: string | null; preferredTimeRange?: string | null; status: string; notes?: string | null; notifiedAt?: string | null; createdAt: string }
export type AddValues = { customerId: string; serviceId: string; staffId: string; date: string; timeRange: string; notes: string }
export const statusLabel = (_s: string) => ''
export const preferenceLine = (_e: WaitEntry) => ''
export const sortEntries = (e: readonly WaitEntry[]): WaitEntry[] => [...e]
export const canNotify = (_s: string) => false
export const notifyMessage = (_e: WaitEntry, _s: string) => ''
export const validateAdd = (_v: AddValues, _t: string): Partial<Record<keyof AddValues, string>> => ({ customerId: 'x' })
export const createBody = (_v: AddValues): Record<string, unknown> => ({})
