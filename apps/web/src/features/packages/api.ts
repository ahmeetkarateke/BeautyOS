import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { PackageRow } from './logic'

// Paket tanımı uçları (sahip ve müdür yazar). Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/packages`

const packageSchema = z.object({
  id: z.string(),
  name: z.string(),
  serviceId: z.string(),
  service: z.object({ name: z.string() }).nullish(),
  totalSessions: z.number(),
  price: z.number(),
  validityDays: z.number().nullish(),
  description: z.string().nullish(),
  isActive: z.boolean(),
})

export async function fetchPackages(client: ApiClient, slug: string, signal?: AbortSignal): Promise<PackageRow[]> {
  const body = await client.request<{ data?: unknown }>(base(slug), { query: { includeInactive: true }, signal })
  return z
    .array(packageSchema)
    .parse(body.data ?? [])
    .map(({ service, ...rest }) => ({ ...rest, serviceName: service?.name ?? null }))
}

export async function createPackage(client: ApiClient, slug: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(base(slug), { method: 'POST', body: payload })
}

export async function updatePackage(client: ApiClient, slug: string, id: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })
}

/** Sunucuda silme yok: paket pasifleşir; kullanan etkin müşteri paketi varsa 409 PACKAGE_IN_USE. */
export async function removePackage(client: ApiClient, slug: string, id: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
