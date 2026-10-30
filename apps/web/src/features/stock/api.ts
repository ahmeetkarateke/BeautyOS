import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { Item } from './logic'

// Stok uçları. Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/inventory`

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().nullish(),
  quantity: z.number(),
  lowStockThreshold: z.number(),
  unitCost: z.number(),
  sellingPrice: z.number().nullish(),
  unit: z.string(),
})

export async function fetchInventory(client: ApiClient, slug: string, signal?: AbortSignal): Promise<Item[]> {
  const body = await client.request<{ data?: unknown }>(base(slug), { signal })
  return z.array(itemSchema).parse(body.data ?? [])
}

export async function createItem(client: ApiClient, slug: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(base(slug), { method: 'POST', body: payload })
}

export async function updateItem(client: ApiClient, slug: string, id: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })
}

/** Hareketi ya da reçete bağlantısı olan ürün silinemez (409 CONFLICT). */
export async function deleteItem(client: ApiClient, slug: string, id: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

const movementSchema = z.object({ id: z.string(), type: z.string(), quantity: z.number(), notes: z.string().nullish(), occurredAt: z.string() })
export type Movement = z.infer<typeof movementSchema>

export async function fetchMovements(client: ApiClient, slug: string, id: string, signal?: AbortSignal): Promise<Movement[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/${encodeURIComponent(id)}/movements`, { signal })
  return z.array(movementSchema).parse(body.data ?? [])
}

export async function addMovement(client: ApiClient, slug: string, id: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}/movements`, { method: 'POST', body: payload })
}
