import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { InviteValues } from './logic'

// Sihirbaz yalnız mevcut uçları kullanır: PATCH /settings, POST /services (features/services), POST /invitations.
const tenantUrl = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}`

const inviteSchema = z.object({ link: z.string().nullish(), emailSent: z.boolean().optional() })
export type InviteResult = { emailSent: boolean; link: string | null }

/** emailSent false ise (e-posta kapalı ya da gönderilemedi) bağlantı kullanıcıya elle verilir. */
export async function inviteStaff(client: ApiClient, slug: string, values: InviteValues): Promise<InviteResult> {
  const body = { fullName: values.fullName.trim(), email: values.email.trim(), role: values.role }
  const parsed = inviteSchema.parse(await client.request<unknown>(`${tenantUrl(slug)}/invitations`, { method: 'POST', body }))
  return { emailSent: parsed.emailSent === true, link: parsed.link ?? null }
}

export async function completeOnboarding(client: ApiClient, slug: string): Promise<void> {
  await client.request<unknown>(`${tenantUrl(slug)}/settings`, { method: 'PATCH', body: { onboardingCompleted: true } })
}
