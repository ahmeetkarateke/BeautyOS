import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { AccountRow } from './logic'

// Hesap uçları (finance.account.read/write: sahip ve müdür). Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}`

const accountSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  bankName: z.string().nullish(),
  iban: z.string().nullish(),
  notes: z.string().nullish(),
  balance: z.number(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
})

export async function fetchAccounts(client: ApiClient, slug: string, signal?: AbortSignal): Promise<AccountRow[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/accounts`, { query: { includeInactive: true }, signal })
  return z.array(accountSchema).parse(body.data ?? [])
}

export async function createAccount(client: ApiClient, slug: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/accounts`, { method: 'POST', body: payload })
}

export async function updateAccount(client: ApiClient, slug: string, id: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })
}

/** Hareketsiz hesap silinir, hareketli hesap pasifleşir (sunucu karar verir). */
export async function removeAccount(client: ApiClient, slug: string, id: string): Promise<{ deactivated: boolean }> {
  const response = await client.request<unknown>(`${base(slug)}/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return { deactivated: z.object({ deactivated: z.boolean().optional() }).nullish().parse(response)?.deactivated === true }
}

export async function transferBetween(client: ApiClient, slug: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/transactions/transfer`, { method: 'POST', body: payload })
}
