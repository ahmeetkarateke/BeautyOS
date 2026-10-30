// İskelet: davranış henüz yok (test önce, kırmızı adım).
export const MAIN_BUSINESS_TYPES: { id: string; label: string }[] = []
export const OTHER_BUSINESS_TYPES: { id: string; label: string }[] = []
export const resolveBusinessType = (_main: string, _other?: string): string => ''
export const slugify = (_name: string): string => ''
export const validateSlug = (_slug: string): string | null => 'x'
export const validateEmail = (_email: string): string | null => 'x'
export const validateNewPassword = (_password: string): string | null => 'x'
export const validateLogin = (_v: { email: string; password: string }): Record<string, string> => ({ x: 'x' })
export const validateStep1 = (_v: { salonName: string; slug: string; type: string; otherType: string }): Record<string, string> => ({ x: 'x' })
export const validateStep2 = (_v: { fullName: string; phone: string; email: string; password: string; acceptTerms: boolean }): Record<string, string> => ({ x: 'x' })
export const toRegisterBody = (_a: unknown, _b: unknown): Record<string, string> => ({})
export const panelPathFor = (_slug: string): string => ''
