export const parseAmount = (_t: string): { ok: true; value: number } | { ok: false; error: string } => ({ ok: false, error: 'x' })
export const canEditAmount = (_r: string) => false
export const completeBody = (_i: { method: 'cash' | 'card'; amount: number; listPrice: number; canEdit: boolean }): Record<string, unknown> => ({})
export const payLabel = (_a: number) => ''
