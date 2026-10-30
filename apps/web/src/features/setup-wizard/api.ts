import type { ApiClient } from '@/lib/v2/api-client'
import type { InviteValues } from './logic'

// Sihirbaz yalnız mevcut uçları kullanır: PATCH /settings, POST /services (features/services), POST /invitations.
const tenantUrl = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}`

export async function inviteStaff(client: ApiClient, slug: string, values: InviteValues): Promise<void> {
  const body = { fullName: values.fullName.trim(), email: values.email.trim(), role: values.role }
  await client.request<unknown>(`${tenantUrl(slug)}/invitations`, { method: 'POST', body })
}

export async function completeOnboarding(client: ApiClient, slug: string): Promise<void> {
  await client.request<unknown>(`${tenantUrl(slug)}/settings`, { method: 'PATCH', body: { onboardingCompleted: true } })
}
