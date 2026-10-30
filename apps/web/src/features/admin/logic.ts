// Süper yönetici ekranlarının saf mantığı (tasarim.md §8.5).

export type Plan = 'trial' | 'starter' | 'pro'
export type TenantStatus = 'active' | 'trial' | 'expired' | 'passive'

export type TenantRow = {
  id: string
  name: string
  slug: string
  plan: Plan
  isActive: boolean
  trialEndsAt: string | null
  createdAt: string
  ownerName: string | null
  ownerEmail: string | null
  userCount: number
  customerCount: number
}

export const PLAN_LABELS: Record<Plan, string> = { trial: 'Deneme', starter: 'Başlangıç', pro: 'Pro' }
export const STATUS_LABELS: Record<TenantStatus, string> = { active: 'Aktif', trial: 'Deneme', expired: 'Süresi dolmuş', passive: 'Pasif' }
export const TRIAL_EXTENSIONS = [7, 14, 30] as const

const DAY_MS = 24 * 60 * 60 * 1000

export function tenantStatus(row: Pick<TenantRow, 'isActive' | 'plan' | 'trialEndsAt'>, now: Date): TenantStatus {
  if (!row.isActive) return 'passive'
  if (row.plan !== 'trial') return 'active'
  if (row.trialEndsAt && new Date(row.trialEndsAt).getTime() < now.getTime()) return 'expired'
  return 'trial'
}

// Arama kullanıcı içindir: I, ı, İ, i hepsi aynı harf sayılır (Türkçe klavyeyle yazanı da, İngilizce yazanı da bulur).
export const foldSearch = (text: string): string => text.replace(/[İIı]/g, 'i').toLowerCase()

export type TenantFilter = { search: string; plan: '' | Plan; status: '' | TenantStatus }

export function filterTenants(rows: readonly TenantRow[], filter: TenantFilter, now: Date): TenantRow[] {
  const needle = foldSearch(filter.search.trim())
  return rows.filter((row) => {
    if (filter.plan && row.plan !== filter.plan) return false
    if (filter.status && tenantStatus(row, now) !== filter.status) return false
    if (!needle) return true
    return foldSearch([row.name, row.slug, row.ownerName ?? '', row.ownerEmail ?? ''].join(' ')).includes(needle)
  })
}

/** Deneme bitişi gelecekteyse üstüne, dolmuş ya da tarihsizse bugünden başlayarak gün ekler. */
export function extendedTrialEnd(current: string | null, days: number, now: Date): string {
  const currentMs = current ? new Date(current).getTime() : Number.NEGATIVE_INFINITY
  const base = currentMs > now.getTime() ? currentMs : now.getTime()
  return new Date(base + days * DAY_MS).toISOString()
}
