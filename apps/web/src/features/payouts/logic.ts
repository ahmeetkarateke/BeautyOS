export type PayoutValues = { staffId: string; from: string; to: string; bonusText: string; deductionsText: string; notes: string }
export const netAmount = (_g: number, _b: string, _d: string): number | null => -999
export const validatePayout = (_v: PayoutValues, _t: string): Record<string, string> => ({ staffId: 'x' })
export const createBody = (_v: PayoutValues): Record<string, unknown> => ({})
export const payoutStatusLabel = (_s: string) => ''
export const methodLabel = (_m: string) => ''
