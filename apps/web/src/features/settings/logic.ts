export type SalonValues = { name: string; phone: string; address: string }
export type OnlineValues = { enabled: boolean; approval: 'auto' | 'manual'; whatsapp: string; about: string }
export const MODULES: { key: string; label: string; locked: boolean }[] = []
export const sectionsFor = (_r: string): { key: string; label: string }[] => [{ key: 'x', label: 'x' }]
export const validateSalon = (_v: SalonValues): Record<string, string> => ({ name: 'x' })
export const salonPatch = (_v: SalonValues, _o: SalonValues): Record<string, unknown> => ({ x: 1 })
export const validateOnline = (_v: OnlineValues): Record<string, string> => ({ whatsapp: 'x' })
export const onlinePatch = (_v: OnlineValues, _o: OnlineValues): Record<string, unknown> => ({ x: 1 })
export const moduleToggle = (_m: readonly string[], _k: string, _on: boolean): string[] => []
