import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { ServiceRow } from './logic'

// Hizmet uçları. Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/services`

const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().nullish(),
  durationMinutes: z.number(),
  price: z.number(),
  bufferMinutes: z.number().nullish(),
  isActive: z.boolean(),
  isOnlineBookable: z.boolean().optional(),
})

export async function fetchAllServices(client: ApiClient, slug: string, signal?: AbortSignal): Promise<ServiceRow[]> {
  const body = await client.request<{ data?: unknown }>(base(slug), { query: { includeInactive: true }, signal })
  return z.array(serviceSchema).parse(body.data ?? [])
}

export async function createService(client: ApiClient, slug: string, payload: Record<string, unknown>): Promise<{ id: string }> {
  return z.object({ id: z.string() }).parse(await client.request<unknown>(base(slug), { method: 'POST', body: payload }))
}

export async function updateService(client: ApiClient, slug: string, id: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })
}

/** Sunucuda silme yok, hizmet pasifleşir (geçmiş randevular etkilenmez). */
export async function removeService(client: ApiClient, slug: string, id: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
