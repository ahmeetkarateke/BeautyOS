import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'

// Bahşiş uçları. Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/tips`

const tipSchema = z.object({
  id: z.string(),
  amount: z.number(),
  source: z.string(),
  notes: z.string().nullish(),
  collectedAt: z.string(),
  isDistributed: z.boolean(),
  staffId: z.string().nullish(),
  staffName: z.string().nullish(),
  customerName: z.string().nullish(),
})
export type Tip = z.infer<typeof tipSchema>

const summarySchema = z.object({
  totalAmount: z.number(),
  totalCount: z.number(),
  undistributedTotal: z.number(),
  undistributedCount: z.number(),
})
export type TipSummary = z.infer<typeof summarySchema>

export async function fetchTips(client: ApiClient, slug: string, signal?: AbortSignal): Promise<Tip[]> {
  const body = await client.request<{ data?: unknown }>(base(slug), { query: { limit: 100 }, signal })
  return z.array(tipSchema).parse(body.data ?? [])
}

export async function fetchTipSummary(client: ApiClient, slug: string, signal?: AbortSignal): Promise<TipSummary> {
  return summarySchema.parse(await client.request<unknown>(`${base(slug)}/summary`, { query: { period: 'month' }, signal }))
}

export async function createTip(client: ApiClient, slug: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(base(slug), { method: 'POST', body: payload })
}

export async function distributeTips(client: ApiClient, slug: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/distribute`, { method: 'POST', body: payload })
}
