import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'

// Kasa ve gün sonu uçları (A6b). Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/finance`

const dayStatusSchema = z.object({
  date: z.string(),
  isClosed: z.boolean(),
  closedAt: z.string().nullish(),
  expectedCash: z.number().nullish(),
  countedCash: z.number().nullish(),
  difference: z.number().nullish(),
})
export type DayStatus = z.infer<typeof dayStatusSchema>

export async function fetchDayStatus(client: ApiClient, slug: string, date: string, signal?: AbortSignal): Promise<DayStatus> {
  return dayStatusSchema.parse(await client.request<unknown>(`${base(slug)}/day-status`, { query: { date }, signal }))
}

export async function closeDay(client: ApiClient, slug: string, date: string, body: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/close-day`, { method: 'POST', query: { date }, body })
}

export async function reopenDay(client: ApiClient, slug: string, body: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/reopen-day`, { method: 'POST', body })
}

const correctionSchema = z.object({
  id: z.string(),
  kind: z.enum(['payment', 'day_reopen']),
  date: z.string().nullish(),
  reason: z.string(),
  createdAt: z.string(),
})
export type Correction = z.infer<typeof correctionSchema>

export async function fetchCorrections(client: ApiClient, slug: string, date: string, signal?: AbortSignal): Promise<Correction[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/corrections`, { query: { date }, signal })
  return z.array(correctionSchema).parse(body.data ?? [])
}
