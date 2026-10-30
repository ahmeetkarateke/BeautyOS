import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'

// Davet uçları (yalnız sahip). Bağlantı yalnız oluşturma ve yeniden gönderme yanıtında gelir; saklanmaz, kopyalatılır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/invitations`

const pendingSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
  role: z.string(),
  title: z.string().nullish(),
  expiresAt: z.string(),
  expired: z.boolean(),
})
export type PendingInvite = z.infer<typeof pendingSchema>

const sentSchema = z.object({ id: z.string(), link: z.string(), expiresAt: z.string(), emailSent: z.boolean() })
export type SentInvite = z.infer<typeof sentSchema>

export async function fetchInvitations(client: ApiClient, slug: string, signal?: AbortSignal): Promise<PendingInvite[]> {
  const body = await client.request<{ data?: unknown }>(base(slug), { signal })
  return z.array(pendingSchema).parse(body.data ?? [])
}

export async function createInvitation(client: ApiClient, slug: string, payload: Record<string, string>): Promise<SentInvite> {
  return sentSchema.parse(await client.request<unknown>(base(slug), { method: 'POST', body: payload }))
}

export async function resendInvitation(client: ApiClient, slug: string, id: string): Promise<SentInvite> {
  return sentSchema.parse(await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}/resend`, { method: 'POST' }))
}

export async function cancelInvitation(client: ApiClient, slug: string, id: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
