import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'

// Randevu oluşturma uçları. Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}`

const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  durationMinutes: z.number(),
  price: z.number().nullish(),
  category: z.string().nullish(),
})
export type ServiceOption = z.infer<typeof serviceSchema>

export async function fetchServices(client: ApiClient, slug: string, signal?: AbortSignal): Promise<ServiceOption[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/services`, { signal })
  return z.array(serviceSchema).parse(body.data ?? [])
}

const slotSchema = z.object({ id: z.string(), label: z.string(), available: z.boolean() })
export type SlotOption = z.infer<typeof slotSchema>

export async function fetchSlots(client: ApiClient, slug: string, serviceId: string, staffId: string, date: string, signal?: AbortSignal): Promise<SlotOption[]> {
  const body = await client.request<{ slots?: unknown }>(`${base(slug)}/slots`, { query: { serviceId, staffId, date }, signal })
  return z.array(slotSchema).parse(body.slots ?? [])
}

const customerSchema = z.object({ id: z.string(), fullName: z.string(), phone: z.string().nullish() })
export type CustomerHit = z.infer<typeof customerSchema>

export async function searchCustomers(client: ApiClient, slug: string, term: string, signal?: AbortSignal): Promise<CustomerHit[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/customers`, { query: { search: term, limit: '10' }, signal })
  return z.array(customerSchema).parse(body.data ?? [])
}

/** allowSharedPhone: aynı telefon başka kartta kayıtlıyken kullanıcı bilerek yeni kart ister (ADR-0038, "Yine de ekle"). */
export async function createCustomer(client: ApiClient, slug: string, fullName: string, phoneDigits: string, allowSharedPhone = false): Promise<{ id: string }> {
  const body = await client.request<unknown>(`${base(slug)}/customers`, {
    method: 'POST',
    body: { fullName: fullName.trim(), phone: `0${phoneDigits}`, ...(allowSharedPhone ? { allowSharedPhone: true } : {}) },
  })
  return z.object({ id: z.string() }).parse(body)
}

export type NewAppointment = { customerId: string; serviceId: string; staffId: string; startAt: string; notes?: string }

export async function createAppointment(client: ApiClient, slug: string, input: NewAppointment): Promise<{ id: string }> {
  const body = await client.request<unknown>(`${base(slug)}/appointments`, { method: 'POST', body: input })
  return z.object({ id: z.string() }).parse(body)
}
