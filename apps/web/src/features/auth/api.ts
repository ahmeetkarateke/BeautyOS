import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { LegalVersions, RegisterBody } from './logic'

// Kimlik uçları. Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır; token yalnız bellekteki istemciye verilir.
const sessionSchema = z.object({
  token: z.string().min(1),
  user: z.object({ tenantSlug: z.string().min(1) }),
})

export type SessionStart = { tenantSlug: string }

function start(client: ApiClient, body: unknown): SessionStart {
  const parsed = sessionSchema.parse(body)
  client.setAccessToken(parsed.token)
  return { tenantSlug: parsed.user.tenantSlug }
}

export async function login(client: ApiClient, credentials: { email: string; password: string }): Promise<SessionStart> {
  const body = await client.request<unknown>('/api/v1/auth/login', {
    method: 'POST',
    body: { email: credentials.email.trim(), password: credentials.password },
  })
  return start(client, body)
}

const legalSchema = z.object({ termsVersion: z.string(), dpaVersion: z.string() })

export async function fetchLegalVersions(client: ApiClient): Promise<LegalVersions> {
  return legalSchema.parse(await client.request<unknown>('/api/v1/auth/legal-versions'))
}

export async function register(client: ApiClient, payload: RegisterBody): Promise<SessionStart> {
  const body = await client.request<unknown>('/api/v1/auth/register', { method: 'POST', body: payload })
  return start(client, body)
}

export async function requestPasswordReset(client: ApiClient, email: string): Promise<void> {
  await client.request<unknown>('/api/v1/auth/password-reset/request', { method: 'POST', body: { email: email.trim() } })
}

export async function resetPassword(client: ApiClient, input: { token: string; password: string }): Promise<void> {
  await client.request<unknown>('/api/v1/auth/password-reset/confirm', { method: 'POST', body: input })
}

const invitationSchema = z.object({
  tenantName: z.string(),
  role: z.string(),
  email: z.string(),
  fullName: z.string().nullish(),
  expiresAt: z.string().nullish(),
})
export type InvitationInfo = z.infer<typeof invitationSchema>

/** Davet belirteci gövdede gider (URL'ye ya da günlüğe girmez). 404 INVITATION_INVALID: bağlantı geçersiz/süresi dolmuş. */
export async function lookupInvitation(client: ApiClient, token: string, signal?: AbortSignal): Promise<InvitationInfo> {
  const body = await client.request<unknown>('/api/v1/auth/invitations/lookup', { method: 'POST', body: { token }, signal })
  return invitationSchema.parse(body)
}

export async function acceptInvitation(
  client: ApiClient,
  input: { token: string; password: string; fullName?: string; phone?: string },
): Promise<SessionStart> {
  const body = await client.request<unknown>('/api/v1/auth/invitations/accept', { method: 'POST', body: input })
  return start(client, body)
}

export type SlugAvailability = 'available' | 'taken' | 'invalid'
const slugSchema = z.object({ available: z.boolean(), reason: z.enum(['taken', 'invalid']).optional() })

/** Anlık uygunluk ipucudur; kesin sonuç kayıt isteğinin 409'udur. */
export async function checkSlug(client: ApiClient, slug: string, signal?: AbortSignal): Promise<SlugAvailability> {
  const body = slugSchema.parse(await client.request<unknown>('/api/v1/auth/slug-available', { query: { slug }, signal }))
  return body.available ? 'available' : (body.reason ?? 'taken')
}
