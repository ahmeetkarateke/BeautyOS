import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'

// Personel ödemesi uçları (sahip ve müdür). Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/staff-payouts`

const payoutSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  staffName: z.string().nullish(),
  periodStart: z.string(),
  periodEnd: z.string(),
  grossEarned: z.number(),
  bonus: z.number(),
  deductions: z.number(),
  netAmount: z.number(),
  paymentMethod: z.string(),
  status: z.string(),
  paidAt: z.string().nullish(),
})
export type StaffPayout = z.infer<typeof payoutSchema>

export async function fetchPayouts(client: ApiClient, slug: string, signal?: AbortSignal): Promise<StaffPayout[]> {
  const body = await client.request<{ data?: unknown }>(base(slug), { signal })
  return z.array(payoutSchema).parse(body.data ?? [])
}

const calcSchema = z.object({ grossEarned: z.number(), transactionCount: z.number() })
export async function calculatePayout(
  client: ApiClient,
  slug: string,
  staffId: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<{ grossEarned: number; transactionCount: number }> {
  return calcSchema.parse(await client.request<unknown>(`${base(slug)}/calculate`, { query: { staffId, from, to }, signal }))
}

export async function createPayout(client: ApiClient, slug: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(base(slug), { method: 'POST', body: payload })
}

export async function markPaid(client: ApiClient, slug: string, id: string, paymentMethod: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}/mark-paid`, { method: 'POST', body: { paymentMethod } })
}
