export type DifferenceView = { amount: number; text: string; tone: 'ok' | 'short' | 'over' }
export const differenceView = (_e: number, _c: number): DifferenceView => ({ amount: 1, text: 'x', tone: 'over' })
export const validateCount = (_t: string): { ok: true; value: number | null } | { ok: false; error: string } => ({ ok: false, error: 'x' })
export const closeBody = (_c: number | null, _n: string): Record<string, unknown> => ({ x: 1 })
export const reopenIssue = (_r: string): string | null => null
export const reopenBody = (_d: string, _r: string): Record<string, unknown> => ({})
