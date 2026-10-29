import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { CustomerRow } from './logic'

// Müşteri listesi ucu. Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır; uzman yanıtında phoneMasked/isOwn gelir (R4).
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}`

const rowSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  phone: z.string().nullish(),
  phoneMasked: z.boolean().optional(),
  isOwn: z.boolean().optional(),
  totalVisits: z.number().nullish(),
  lastVisitDate: z.string().nullish(),
})
const pageSchema = z.object({ data: z.array(rowSchema), nextCursor: z.string().nullish() })

export type CustomerPage = { rows: CustomerRow[]; nextCursor: string | null }
export const PAGE_SIZE = 30

export async function fetchCustomerPage(
  client: ApiClient,
  slug: string,
  params: { search?: string; cursor?: string },
  signal?: AbortSignal,
): Promise<CustomerPage> {
  const body = await client.request<unknown>(`${base(slug)}/customers`, {
    query: { search: params.search, cursor: params.cursor, limit: PAGE_SIZE },
    signal,
  })
  const page = pageSchema.parse(body)
  return { rows: page.data, nextCursor: page.nextCursor ?? null }
}
