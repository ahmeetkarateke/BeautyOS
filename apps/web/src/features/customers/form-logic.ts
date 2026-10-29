export type CustomerValues = { fullName: string; phoneDigits: string; email: string; birthDate: string; preferenceNotes: string }
export type CustomerErrors = Partial<Record<keyof CustomerValues, string>>
export type ServerCustomer = { id: string; fullName: string; phone?: string | null; email?: string | null; birthDate?: string | null; preferenceNotes?: string | null }
export const emptyValues = (): CustomerValues => ({ fullName: 'x', phoneDigits: 'x', email: 'x', birthDate: 'x', preferenceNotes: 'x' })
export const validateCustomer = (_v: CustomerValues, _o: { today: string; phoneRequired: boolean }): CustomerErrors => ({ fullName: 'x' })
export const toCreatePayload = (_v: CustomerValues, _s: boolean): Record<string, unknown> => ({})
export const toFormValues = (_c: ServerCustomer): CustomerValues => emptyValues()
export const toUpdatePayload = (_v: CustomerValues, _c: ServerCustomer, _s: boolean): Record<string, unknown> => ({ x: 1 })
