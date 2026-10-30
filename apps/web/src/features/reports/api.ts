import { z } from 'zod'
import type { ApiClient } from '@/lib/v2/api-client'
import type { CommissionRow } from './logic'

// Rapor uçları. Sunucu yanıtı güvenilmez girdi sayılır: zod ile doğrulanır.
const base = (slug: string) => `/api/v1/tenants/${encodeURIComponent(slug)}`

const dailySchema = z.object({
  date: z.string(),
  revenue: z.number(),
  cashRevenue: z.number(),
  cardRevenue: z.number(),
  completedCount: z.number(),
  expenses: z.number(),
  netRevenue: z.number(),
})
const cashReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  totalRevenue: z.number(),
  cashRevenue: z.number(),
  cardRevenue: z.number(),
  completedCount: z.number(),
  netRevenue: z.number(),
  daily: z.array(dailySchema).default([]),
})
export type CashReport = z.infer<typeof cashReportSchema>

export async function fetchCashReport(client: ApiClient, slug: string, from: string, to: string, signal?: AbortSignal): Promise<CashReport> {
  return cashReportSchema.parse(await client.request<unknown>(`${base(slug)}/reports/daily`, { query: { from, to, groupBy: 'day', fields: 'summary' }, signal }))
}

const commissionSchema = z.object({
  staffId: z.string(),
  staffName: z.string(),
  completedAppointments: z.number(),
  revenue: z.number(),
  commission: z.number(),
})

export async function fetchCommissions(client: ApiClient, slug: string, date: string, signal?: AbortSignal): Promise<CommissionRow[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/reports/staff-commissions`, { query: { date }, signal })
  return z.array(commissionSchema).parse(body.data ?? [])
}

const payoutSchema = z.object({
  id: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  grossEarned: z.number(),
  bonus: z.number(),
  deductions: z.number(),
  netAmount: z.number(),
  status: z.string(),
  paidAt: z.string().nullish(),
})
export type Payout = z.infer<typeof payoutSchema>

/** Uzman için yalnız kendi ödemeleri döner (sunucu kısıtlar). */
export async function fetchMyPayouts(client: ApiClient, slug: string, signal?: AbortSignal): Promise<Payout[]> {
  const body = await client.request<{ data?: unknown }>(`${base(slug)}/staff-payouts`, { signal })
  return z.array(payoutSchema).parse(body.data ?? [])
}
