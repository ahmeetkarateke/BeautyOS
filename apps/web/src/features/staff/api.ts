import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { Leave } from './logic'

// Personel uçları. Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/staff`

const profileSchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  fullName: z.string(),
  email: z.string().nullish(),
  workingHours: z.unknown().optional(),
  skills: z.array(z.object({ serviceId: z.string(), serviceName: z.string().nullish() })).default([]),
})
export type StaffProfile = z.infer<typeof profileSchema>

export async function fetchStaffProfiles(client: ApiClient, slug: string, signal?: AbortSignal): Promise<StaffProfile[]> {
  const body = await client.request<{ data?: unknown }>(base(slug), { signal })
  return z.array(profileSchema).parse(body.data ?? [])
}

export async function updateStaffProfile(client: ApiClient, slug: string, id: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })
}

const assignmentSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  durationMinutes: z.number().nullish(),
  basePrice: z.number().nullish(),
  commissionType: z.string(),
  commissionValue: z.number(),
})
export type Assignment = z.infer<typeof assignmentSchema>

export async function fetchAssignments(client: ApiClient, slug: string, id: string, signal?: AbortSignal): Promise<Assignment[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/${encodeURIComponent(id)}/services`, { signal })
  return z.array(assignmentSchema).parse(body.data ?? [])
}

export async function assignService(client: ApiClient, slug: string, id: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}/services`, { method: 'POST', body: payload })
}

export async function unassignService(client: ApiClient, slug: string, id: string, serviceId: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}/services/${encodeURIComponent(serviceId)}`, { method: 'DELETE' })
}

const leaveSchema = z.object({ id: z.string(), leaveDate: z.string(), leaveType: z.string(), note: z.string().nullish() })

export async function fetchLeaves(client: ApiClient, slug: string, id: string, signal?: AbortSignal): Promise<Leave[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/${encodeURIComponent(id)}/leaves`, { signal })
  return z
    .array(leaveSchema)
    .parse(body.data ?? [])
    .map((l) => ({ ...l, leaveDate: l.leaveDate.slice(0, 10) }))
}

export async function addLeave(client: ApiClient, slug: string, id: string, payload: Record<string, unknown>): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}/leaves`, { method: 'POST', body: payload })
}

export async function removeLeave(client: ApiClient, slug: string, id: string, leaveId: string): Promise<void> {
  await client.request<unknown>(`${base(slug)}/${encodeURIComponent(id)}/leaves/${encodeURIComponent(leaveId)}`, { method: 'DELETE' })
}

const salonHoursSchema = z.object({ settings: z.object({ workingHours: z.unknown().optional() }).passthrough().nullish() })

/** Salon çalışma saatleri (personelin özel saati yoksa sunucu bunu kullanır). */
export async function fetchSalonHours(client: ApiClient, slug: string, signal?: AbortSignal): Promise<unknown> {
  const body = salonHoursSchema.parse(await client.request<unknown>(`/api/v1/tenants/${encodeURIComponent(slug)}/settings`, { signal }))
  return body.settings?.workingHours
}
