import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'

// Tamamla ve öde ucu (A6): tek istekte durum + kasa hareketi. Yanıt güvenilmez girdi sayılır: zod ile doğrulanır.
const paymentSchema = z.object({
  transactionId: z.string(),
  grossAmount: z.number(),
  paymentMethod: z.enum(['cash', 'card']),
  cashAmount: z.number(),
  cardAmount: z.number(),
  completedAt: z.string(),
})
export type Payment = z.infer<typeof paymentSchema>

export async function completeAppointment(client: ApiClient, slug: string, id: string, body: Record<string, unknown>): Promise<Payment | null> {
  const response = await client.request<unknown>(`/api/v1/tenants/${encodeURIComponent(slug)}/appointments/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body,
  })
  const parsed = z.object({ payment: paymentSchema.nullish() }).parse(response)
  return parsed.payment ?? null
}

/** Randevusuz işlem: kasaya bağımsız gelir kaydı (A6, finance.revenue.create). */
export async function createQuickRevenue(client: ApiClient, slug: string, body: Record<string, unknown>): Promise<{ id: string }> {
  const response = await client.request<unknown>(`/api/v1/tenants/${encodeURIComponent(slug)}/revenues`, { method: 'POST', body })
  return z.object({ id: z.string() }).parse(response)
}
