// Iskelet (kirmizi adim): gercek uygulama sonraki commit'te.
export const TERM_KEYS = [] as readonly string[]
export const TERM_FORMS = [] as readonly string[]
export function termOverrideKeyAllowed(_key: string): boolean {
  return true
}
export function validateTermOverrides(_overrides: Record<string, string>): string | null {
  return null
}
