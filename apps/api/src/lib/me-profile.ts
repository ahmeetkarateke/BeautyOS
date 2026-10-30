import { permissionsFor, termOverrideKeyAllowed, type PermissionKey, type Role } from '@beautyos/shared'
import { MODULE_KEYS, isValidModuleKey } from './modules'
import type { BookingMode } from './booking-mode'

export const TERM_SETS = ['salon', 'clinic_client', 'clinic_patient'] as const
type TermSet = (typeof TERM_SETS)[number]

export interface MeProfile {
  role: Role
  permissions: PermissionKey[]
  staffId: string | null
  user: { id: string; email: string; name: string }
  tenant: {
    slug: string
    name: string
    businessType: string
    termSet: TermSet
    terms: Record<string, string>
    activeModules: string[]
    bookingMode: BookingMode
    timezone: string
  }
}

interface BuildInput {
  user: { id: string; email: string; fullName: string; role: Role }
  tenant: { slug: string; name: string; businessType: string; settings: unknown }
  staffId: string | null
  bookingMode: BookingMode
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function resolveActiveModules(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...MODULE_KEYS]
  const valid = raw.filter((k): k is string => typeof k === 'string' && isValidModuleKey(k))
  return valid.length > 0 ? valid : [...MODULE_KEYS]
}

function resolveTermSet(raw: unknown): TermSet {
  return TERM_SETS.find((s) => s === raw) ?? 'salon'
}

function resolveTerms(raw: unknown): Record<string, string> {
  const terms: Record<string, string> = {}
  for (const [key, value] of Object.entries(asRecord(raw))) {
    // Yazma tarafindaki beyaz listeyle ayni: eski ya da elle yazilmis anahtarlar istemciye tasinmaz.
    if (typeof value === 'string' && termOverrideKeyAllowed(key)) terms[key] = value
  }
  return terms
}

/**
 * GET /auth/me yaniti. Yalniz acik alan listesi kopyalanir (settings'in tamami disari cikmaz:
 * bot kurallari ve kanal anahtarlari gizli kalir). termSet/terms settings JSON'unda tutulur (ADR-0031).
 */
export function buildMeProfile(input: BuildInput): MeProfile {
  const settings = asRecord(input.tenant.settings)
  return {
    role: input.user.role,
    permissions: permissionsFor(input.user.role),
    staffId: input.staffId,
    user: { id: input.user.id, email: input.user.email, name: input.user.fullName },
    tenant: {
      slug: input.tenant.slug,
      name: input.tenant.name,
      businessType: input.tenant.businessType,
      termSet: resolveTermSet(settings.termSet),
      terms: resolveTerms(settings.termOverrides),
      activeModules: resolveActiveModules(settings.activeModules),
      bookingMode: input.bookingMode,
      timezone: 'Europe/Istanbul',
    },
  }
}
