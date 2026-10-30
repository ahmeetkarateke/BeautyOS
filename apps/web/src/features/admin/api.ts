import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { Plan, TenantRow } from './logic'

// Süper yönetici uçları. Yanıt güvenilmez girdi sayılır: zod ile doğrulanır. Müşteri verisi bu uçlardan hiç gelmez (yalnız sayılar).
const plan = z.enum(['trial', 'starter', 'pro'])
const tenantBase = { id: z.string(), name: z.string(), slug: z.string(), plan, isActive: z.boolean(), trialEndsAt: z.string().nullable(), createdAt: z.string() }

const listSchema = z.object({
  tenants: z.array(
    z.object({
      ...tenantBase,
      _count: z.object({ users: z.number(), customers: z.number() }),
      users: z.array(z.object({ email: z.string().nullish(), fullName: z.string().nullish() })),
    }),
  ),
})

export async function fetchTenants(client: ApiClient, signal?: AbortSignal): Promise<TenantRow[]> {
  const body = listSchema.parse(await client.request<unknown>('/api/v1/admin/tenants', { signal }))
  return body.tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.plan,
    isActive: t.isActive,
    trialEndsAt: t.trialEndsAt,
    createdAt: t.createdAt,
    ownerName: t.users[0]?.fullName ?? null,
    ownerEmail: t.users[0]?.email ?? null,
    userCount: t._count.users,
    customerCount: t._count.customers,
  }))
}

const detailSchema = z.object({
  tenant: z.object(tenantBase),
  activity: z.object({ totalAppointments: z.number(), totalCustomers: z.number(), totalRevenue: z.number(), lastActivityAt: z.string().nullable() }),
})
export type TenantDetail = z.infer<typeof detailSchema>

export async function fetchTenant(client: ApiClient, id: string, signal?: AbortSignal): Promise<TenantDetail> {
  return detailSchema.parse(await client.request<unknown>(`/api/v1/admin/tenants/${encodeURIComponent(id)}`, { signal }))
}

export type TenantPatch = { plan?: Plan; isActive?: boolean; trialEndsAt?: string }

export async function patchTenant(client: ApiClient, id: string, patch: TenantPatch): Promise<void> {
  await client.request<unknown>(`/api/v1/admin/tenants/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch })
}

const statsSchema = z.object({
  stats: z.object({ totalTenants: z.number(), activeTenants: z.number(), trialTenants: z.number(), expiredTenants: z.number(), recentRegistrations: z.number() }),
})
export type AdminStats = z.infer<typeof statsSchema>['stats']

export async function fetchStats(client: ApiClient, signal?: AbortSignal): Promise<AdminStats> {
  return statsSchema.parse(await client.request<unknown>('/api/v1/admin/stats', { signal })).stats
}

export async function fetchLegalVersions(client: ApiClient, signal?: AbortSignal): Promise<Record<string, string>> {
  return z.record(z.string(), z.string()).parse(await client.request<unknown>('/api/v1/auth/legal-versions', { signal }))
}

const loginSchema = z.object({ token: z.string().min(1) })

export async function adminLogin(client: ApiClient, credentials: { email: string; password: string }): Promise<void> {
  const body = await client.request<unknown>('/api/v1/auth/admin-login', { method: 'POST', body: { email: credentials.email.trim(), password: credentials.password } })
  client.setAccessToken(loginSchema.parse(body).token)
}
