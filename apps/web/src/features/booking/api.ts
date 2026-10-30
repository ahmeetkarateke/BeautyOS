import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import { apiPhone } from './logic'

// Herkese açık uçlar. Yanıt güvenilmez girdi sayılır: zod ile doğrulanır; fiyat ve işletme bilgisi yoksa alan hiç gelmez.
const tenantSchema = z.object({
  name: z.string(),
  publicBookingEnabled: z.boolean(),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  whatsappNumber: z.string().nullish(),
  brandColor: z.string().nullish(),
  aboutText: z.string().nullish(),
  bookingMode: z.enum(['verified', 'approval_required']),
  isHealthRegulated: z.boolean().optional(),
})
export type PublicTenant = z.infer<typeof tenantSchema>

const serviceSchema = z.object({ id: z.string(), name: z.string(), durationMinutes: z.number(), category: z.string().nullish(), price: z.number().optional() })
export type PublicService = z.infer<typeof serviceSchema>

const staffSchema = z.object({ id: z.string(), fullName: z.string(), title: z.string().nullish() })
export type PublicStaff = z.infer<typeof staffSchema>

const slotsSchema = z.object({ date: z.string(), slots: z.array(z.object({ id: z.string(), available: z.boolean(), staffId: z.string().optional() })) })
export type PublicSlot = z.infer<typeof slotsSchema>['slots'][number]

const bookedSchema = z.object({
  referenceCode: z.string(),
  startAt: z.string(),
  status: z.string(),
  approvalRequired: z.boolean(),
  manageLink: z.string().optional(),
  price: z.number().optional(),
})
export type Booked = z.infer<typeof bookedSchema>

const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}/public`

export async function fetchTenant(client: ApiClient, slug: string, signal?: AbortSignal): Promise<PublicTenant> {
  return tenantSchema.parse(await client.request<unknown>(`${base(slug)}/tenant`, { signal }))
}

export async function fetchServices(client: ApiClient, slug: string, signal?: AbortSignal): Promise<PublicService[]> {
  const body = await client.request<unknown>(`${base(slug)}/services`, { signal })
  return z.object({ data: z.array(serviceSchema) }).parse(body).data
}

export async function fetchStaff(client: ApiClient, slug: string, serviceId: string, signal?: AbortSignal): Promise<PublicStaff[]> {
  const body = await client.request<unknown>(`${base(slug)}/staff`, { query: { serviceId }, signal })
  return z.object({ data: z.array(staffSchema) }).parse(body).data
}

export async function fetchSlots(client: ApiClient, slug: string, q: { serviceId: string; staffId: string; date: string }, signal?: AbortSignal): Promise<PublicSlot[]> {
  return slotsSchema.parse(await client.request<unknown>(`${base(slug)}/slots`, { query: q, signal })).slots
}

export async function sendCode(client: ApiClient, slug: string, nationalPhone: string): Promise<void> {
  await client.request(`${base(slug)}/verify/send`, { method: 'POST', body: { phone: apiPhone(nationalPhone) } })
}

export async function confirmCode(client: ApiClient, slug: string, nationalPhone: string, code: string): Promise<void> {
  await client.request(`${base(slug)}/verify/confirm`, { method: 'POST', body: { phone: apiPhone(nationalPhone), code } })
}

export type BookInput = { serviceId: string; staffId: string; slotId: string; fullName: string; nationalPhone: string; captchaToken?: string }

export async function book(client: ApiClient, slug: string, input: BookInput): Promise<Booked> {
  const body = await client.request<unknown>(`${base(slug)}/book`, {
    method: 'POST',
    body: {
      serviceId: input.serviceId,
      staffId: input.staffId,
      startAt: input.slotId,
      customerName: input.fullName.trim(),
      customerPhone: apiPhone(input.nationalPhone),
      ...(input.captchaToken ? { captchaToken: input.captchaToken } : {}),
    },
  })
  return bookedSchema.parse(body)
}

// Randevu yönetimi (ADR-0043/0046): belirteç yalnız istek gövdesinde gider.
const lookupSchema = z.object({
  tenant: z.object({ name: z.string(), slug: z.string(), phone: z.string().nullable(), address: z.string().nullable(), isHealthRegulated: z.boolean().optional() }),
  appointment: z.object({
    referenceCode: z.string(),
    status: z.string(),
    startAt: z.string(),
    endAt: z.string(),
    serviceName: z.string(),
    serviceId: z.string().optional(),
    staffId: z.string().optional(),
    staffName: z.string(),
    price: z.number().optional(),
  }),
  canModify: z.boolean(),
  modifyDeadline: z.string(),
})
export type BookingLookup = z.infer<typeof lookupSchema>

const manage = '/api/v1/public/bookings'

export async function lookupBooking(client: ApiClient, token: string, signal?: AbortSignal): Promise<BookingLookup> {
  return lookupSchema.parse(await client.request<unknown>(`${manage}/lookup`, { method: 'POST', body: { token }, signal }))
}

export async function cancelBooking(client: ApiClient, token: string): Promise<void> {
  await client.request(`${manage}/cancel`, { method: 'POST', body: { token } })
}

const rescheduledSchema = z.object({ status: z.string(), startAt: z.string(), approvalRequired: z.boolean() })

export async function rescheduleBooking(client: ApiClient, token: string, slotId: string, staffId?: string) {
  const body = await client.request<unknown>(`${manage}/reschedule`, { method: 'POST', body: { token, startAt: slotId, ...(staffId ? { staffId } : {}) } })
  return rescheduledSchema.parse(body)
}

export function fetchCalendar(client: ApiClient, token: string): Promise<string> {
  return client.request<string>(`${manage}/calendar`, { method: 'POST', body: { token }, responseType: 'text' })
}
