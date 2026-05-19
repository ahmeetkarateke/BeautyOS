// Modüler aktivasyon sistemi — backend validation kaynağı.
// Frontend tarafındaki apps/web/src/lib/modules.ts ile senkron tutulmalıdır.

export const MODULE_KEYS = [
  'dashboard',
  'appointments',
  'customers',
  'services',
  'staff',
  'packages',
  'tips',
  'staff-payouts',
  'finance',
  'current-accounts',
  'inventory',
  'waitlist',
  'customer-anamnesis',
  'customer-photos',
  'settings',
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

const MODULE_KEY_SET: ReadonlySet<string> = new Set(MODULE_KEYS)

export function isValidModuleKey(key: string): key is ModuleKey {
  return MODULE_KEY_SET.has(key)
}
