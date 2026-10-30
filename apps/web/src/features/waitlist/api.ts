import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { WaitEntry } from './logic'

// Bekleme listesi uçları. Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/waitlist`

const entrySchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  customerPhone: z.string().nullish(),
  serviceName: z.string().nullish(),
  staffName: z.string().nullish(),
  preferredDate: z.string().nullish(),
  preferredTimeRange: z.string().nullish(),
  status: z.string(),
  notes: z.string().nullish(),
  notifiedAt: z.string().nullish(),
  createdAt: z.string(),
})

export async function fetchWaitlist(client: ApiClient, slug: string, signal?: AbortSignal): Promise<WaitEntry[]> {
  const body = await client.request<{ data?: unknown }>(base(slug), { signal })
  return z.array(entrySchema).parse(body.data ?? [])
}

export async function addToWaitlist(client: ApiClient, slug: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(base(slug), { method: 'POST', body: payload })
}

/** Sunucu yalnız durumu "Haber verildi" yapar; mesajı salon çalışanı kendisi gönderir. */
export async function markNotified(client: ApiClient, slug: string, id: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}/notify`, { method: 'POST' })
}

/** Sunucuda silme yok: kayıt "Listeden çıkarıldı" olur. */
export async function removeFromWaitlist(client: ApiClient, slug: string, id: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
