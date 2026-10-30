import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'

// Alış faturası uçları (purchase_invoice.read/write). Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}`

const invoiceSchema = z.object({
  id: z.string(),
  supplierName: z.string(),
  invoiceNumber: z.string().nullish(),
  invoiceDate: z.string(),
  dueDate: z.string().nullish(),
  status: z.string(),
  total: z.number(),
})
export type Invoice = z.infer<typeof invoiceSchema>

export async function fetchInvoices(client: ApiClient, slug: string, signal?: AbortSignal): Promise<Invoice[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/purchase-invoices`, { signal })
  return z.array(invoiceSchema).parse(body.data ?? [])
}

const supplierSchema = z.object({ id: z.string(), name: z.string() })
export async function fetchSuppliers(client: ApiClient, slug: string, signal?: AbortSignal): Promise<{ id: string; name: string }[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/suppliers`, { signal })
  return z.array(supplierSchema).parse(body.data ?? [])
}

export async function createInvoice(client: ApiClient, slug: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/purchase-invoices`, { method: 'POST', body: payload })
}

export async function postInvoice(client: ApiClient, slug: string, id: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/purchase-invoices/${encodeURIComponent(id)}/post`, { method: 'POST' })
}

export async function cancelInvoice(client: ApiClient, slug: string, id: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/purchase-invoices/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

export async function deleteInvoice(client: ApiClient, slug: string, id: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/purchase-invoices/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
