import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import { parseDayAppointment, type DayAppointment } from './day-logic'
import { parseStaffList, type StaffMember } from './staff'

// Randevu uçları (kiracı: /auth/me'den gelen salon kısaltması). Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}`

export async function fetchDayAppointments(client: ApiClient, slug: string, date: string, signal?: AbortSignal): Promise<DayAppointment[]> {
  const body = await client.request<{ data?: unknown[] }>(`${base(slug)}/appointments`, { query: { date }, signal })
  return z.array(z.unknown()).parse(body.data).map(parseDayAppointment)
}

export async function fetchStaff(client: ApiClient, slug: string, signal?: AbortSignal): Promise<StaffMember[]> {
  return parseStaffList(await client.request(`${base(slug)}/staff`, { signal }))
}

const dashboardSchema = z.object({
  todayAppointmentCount: z.number(),
  todayRevenue: z.number().optional(),
  revenueChange: z.number().nullable().optional(),
  appointmentChange: z.number().nullable().optional(),
  occupancyRate: z.number(),
})
export type DashboardSummary = z.infer<typeof dashboardSchema>

export async function fetchDashboard(client: ApiClient, slug: string, period: 'today' | 'week' | 'month', signal?: AbortSignal): Promise<DashboardSummary> {
  return dashboardSchema.parse(await client.request(`${base(slug)}/dashboard`, { query: { period }, signal }))
}

const dailyReportSchema = z.object({ totalRevenue: z.number(), cashRevenue: z.number(), cardRevenue: z.number(), completedCount: z.number() })
export type DailyReport = z.infer<typeof dailyReportSchema>

export async function fetchDailyReport(client: ApiClient, slug: string, from: string, to: string, signal?: AbortSignal): Promise<DailyReport> {
  return dailyReportSchema.parse(await client.request(`${base(slug)}/reports/daily`, { query: { from, to }, signal }))
}

const candidateSchema = z.object({ id: z.string(), fullName: z.string(), phone: z.string().optional() })
export type CustomerCandidate = z.infer<typeof candidateSchema>

export async function fetchCustomerCandidates(client: ApiClient, slug: string, appointmentId: string, signal?: AbortSignal): Promise<CustomerCandidate[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/appointments/${encodeURIComponent(appointmentId)}/customer-candidates`, { signal })
  return z.array(candidateSchema).parse(body.data ?? [])
}

export type ApproveChoice = { customerAction: 'create' } | { customerAction: 'link'; customerId: string }

export function approveRequest(client: ApiClient, slug: string, appointmentId: string, choice?: ApproveChoice): Promise<unknown> {
  return client.request(`${base(slug)}/appointments/${encodeURIComponent(appointmentId)}/approve`, { method: 'PATCH', body: choice ?? {} })
}

export function rejectRequest(client: ApiClient, slug: string, appointmentId: string): Promise<unknown> {
  return client.request(`${base(slug)}/appointments/${encodeURIComponent(appointmentId)}/reject`, { method: 'PATCH' })
}

export function setAppointmentStatus(client: ApiClient, slug: string, appointmentId: string, status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'): Promise<unknown> {
  return client.request(`${base(slug)}/appointments/${encodeURIComponent(appointmentId)}/status`, { method: 'PATCH', body: { status } })
}

export async function fetchServiceCount(client: ApiClient, slug: string, signal?: AbortSignal): Promise<number> {
  const body = await client.request<{ data?: unknown[] }>(`${base(slug)}/services`, { signal })
  return z.array(z.unknown()).parse(body.data ?? []).length
}

// Onay bekleyen online talepler: herkese açık uç en az 3 saat sonrasını zorladığı için çoğu sonraki günlere düşer (A4 aralık sözleşmesi).
export async function fetchPendingRequests(client: ApiClient, slug: string, from: string, to: string, signal?: AbortSignal): Promise<DayAppointment[]> {
  const body = await client.request<{ data?: unknown[] }>(`${base(slug)}/appointments`, { query: { dateFrom: from, dateTo: to, status: 'pending' }, signal })
  return z.array(z.unknown()).parse(body.data).map(parseDayAppointment)
}
