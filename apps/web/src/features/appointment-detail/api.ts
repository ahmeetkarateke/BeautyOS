import type { ApiClient } from '@/lib/v2/api-client'

const base = (slug: string, id: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/appointments/${encodeURIComponent(id)}`

export function rescheduleAppointment(client: ApiClient, slug: string, id: string, startAt: string): Promise<unknown> {
  return client.request(`${base(slug, id)}/reschedule`, { method: 'PATCH', body: { startAt } })
}

export function deleteAppointment(client: ApiClient, slug: string, id: string): Promise<unknown> {
  return client.request(base(slug, id), { method: 'DELETE' })
}
