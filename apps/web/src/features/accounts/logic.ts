export type AccountRow = { id: string; type: string; name: string; bankName?: string | null; iban?: string | null; notes?: string | null; balance: number; isActive: boolean; isDefault: boolean }
export type AccountValues = { type: string; name: string; bankName: string; iban: string; openingText: string; isDefault: boolean; notes: string }
export type TransferValues = { from: string; to: string; amountText: string; description: string }
export const accountTypeLabel = (_t: string) => ''
export const sortAccounts = (a: readonly AccountRow[]): AccountRow[] => [...a]
export const totalBalance = (_a: readonly AccountRow[]) => -1
export const emptyAccount = (): AccountValues => ({ type: 'x', name: 'x', bankName: 'x', iban: 'x', openingText: 'x', isDefault: true, notes: 'x' })
export const validateAccount = (_v: AccountValues): Record<string, string> => ({ name: 'x' })
export const accountBody = (_v: AccountValues): Record<string, unknown> => ({})
export const validateTransfer = (_v: TransferValues, _a: readonly AccountRow[]): Record<string, string> => ({ from: 'x' })
export const transferBody = (_v: TransferValues): Record<string, unknown> => ({})
