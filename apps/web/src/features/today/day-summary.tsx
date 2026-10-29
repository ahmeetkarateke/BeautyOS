'use client'

import { useState } from 'react'
import { fetchDashboard } from '@/features/appointments/api'
import { expectedRevenue, isLive, type DayAppointment, type Period } from '@/features/appointments/day-logic'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { useMe } from '@/lib/v2/session'
import { Card } from '@/ui/card'
import { formatMoney } from '@/ui/format'
import { SegmentedControl } from '@/ui/segmented-control'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { ErrorState } from '@/ui/states'
import { SummaryStrip, type SummaryItem } from '@/ui/summary-strip'

// Günün özeti (yalnız `dashboard.revenue` izniyle). Bugün: sayılar gün listesinden, tahsilat sunucudan; hafta/ay: sunucu özeti.
// Kasa tutarı yüklenemezse "₺0" gösterilmez: blok içi hata çıkar (sıfır gibi görünen tutar yanıltır).
const PERIODS = [
  { value: 'today', label: 'Bugün' },
  { value: 'week', label: 'Bu hafta' },
  { value: 'month', label: 'Bu ay' },
] as const

function changeText(change: number | null | undefined): string | undefined {
  if (change === null || change === undefined || change === 0) return undefined
  return `Önceki döneme göre %${Math.abs(Math.round(change))} ${change > 0 ? 'artış' : 'azalış'}`
}

export function DaySummary({ appointments, occupancy }: { appointments: readonly DayAppointment[]; occupancy: number }) {
  const slug = useMe().tenant.slug
  const [period, setPeriod] = useState<Period>('today')
  const dashboard = useApiQuery(`dashboard:${period}`, (client, signal) => fetchDashboard(client, slug, period, signal))

  let body
  if (dashboard.error && !dashboard.data) {
    body = <ErrorState subject="Günün özeti" onRetry={dashboard.refetch} retrying={dashboard.loading} lastLoadedAt={dashboard.loadedAt} className="px-0" />
  } else if (!dashboard.data) {
    body = (
      <SkeletonGroup className="grid gap-3">
        <Skeleton className="w-1/2" />
        <Skeleton variant="value" />
      </SkeletonGroup>
    )
  } else {
    const d = dashboard.data
    const live = appointments.filter(isLive)
    const items: SummaryItem[] =
      period === 'today'
        ? [
            { label: 'Randevu', value: live.length, comparison: `${appointments.filter((a) => a.status === 'completed').length} tamamlandı` },
            { label: 'Tahsilat', value: formatMoney(d.todayRevenue ?? 0), comparison: changeText(d.revenueChange) },
            { label: 'Beklenen', value: formatMoney(expectedRevenue(appointments)), comparison: `${appointments.filter((a) => ['pending', 'confirmed', 'in_progress'].includes(a.status)).length} açık randevudan` },
            { label: 'Doluluk', value: `%${occupancy}`, comparison: `${appointments.filter((a) => a.status === 'no_show').length} gelmedi · ${appointments.filter((a) => a.status === 'cancelled').length} iptal` },
          ]
        : [
            { label: 'Randevu', value: d.todayAppointmentCount, comparison: changeText(d.appointmentChange) },
            { label: 'Tahsilat', value: formatMoney(d.todayRevenue ?? 0), comparison: changeText(d.revenueChange) },
            { label: 'Doluluk', value: `%${Math.round(d.occupancyRate)}` },
          ]
    body = <SummaryStrip items={items} className="lg:grid-cols-2 xl:grid-cols-2" />
  }

  return (
    <Card labelledBy="bugun-ozet-baslik">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="bugun-ozet-baslik" className="text-base leading-6 font-semibold">
          Günün özeti
        </h2>
        <SegmentedControl aria-label="Dönem" options={PERIODS} value={period} onValueChange={(v) => setPeriod(v as Period)} />
      </div>
      {body}
    </Card>
  )
}
