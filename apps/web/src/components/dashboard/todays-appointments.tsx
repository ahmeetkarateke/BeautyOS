'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, User } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AppointmentStatusModal } from '@/components/appointments/appointment-status-modal'
import { apiFetch } from '@/lib/api'
import { formatTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Appointment {
  id: string
  customerName: string
  serviceName: string
  staffName: string
  startTime: string
  endTime: string
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled' | 'in_progress' | 'no_show'
  priceCharged?: number
  staffColorCode?: string
}

const statusLabel: Record<Appointment['status'], string> = {
  confirmed: 'Onaylı',
  pending: 'Bekliyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  in_progress: 'Devam Ediyor',
  no_show: 'Gelmedi',
}

const statusStyle: Record<Appointment['status'], string> = {
  confirmed: 'bg-blue-50 text-blue-700',
  pending: 'bg-yellow-50 text-yellow-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-600',
  in_progress: 'bg-purple-50 text-purple-700',
  no_show: 'bg-gray-100 text-gray-600',
}

type Period = 'today' | 'week' | 'month'

interface TodaysAppointmentsProps {
  tenantId: string
  period?: Period
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

function dateRangeFor(period: Period): { from: string; to: string } {
  const now = new Date()
  if (period === 'today') {
    const s = toDateStr(now)
    return { from: s, to: s }
  }
  if (period === 'week') {
    // Pazartesi - Pazar
    const day = now.getDay()
    const diffToMon = (day + 6) % 7
    const monday = new Date(now); monday.setDate(now.getDate() - diffToMon)
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
    return { from: toDateStr(monday), to: toDateStr(sunday) }
  }
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: toDateStr(firstOfMonth), to: toDateStr(lastOfMonth) }
}

function formatShortDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export function TodaysAppointments({ tenantId, period = 'today' }: TodaysAppointmentsProps) {
  const { from, to } = dateRangeFor(period)
  const params = new URLSearchParams({
    dateFrom: from,
    dateTo: to,
    limit: '50',
  })
  if (period !== 'today') {
    // Haftalık/aylık görünümde sadece aktif (tamamlanmamış/iptal edilmemiş) randevular
    params.set('statusIn', 'pending,confirmed,in_progress')
  }

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-appointments', tenantId, from, to, period],
    queryFn: () =>
      apiFetch<{ data: Appointment[] }>(`/api/v1/tenants/${tenantId}/appointments?${params.toString()}`),
  })

  const [selected, setSelected] = useState<Appointment | null>(null)

  const appointments = (data?.data ?? []).slice().sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  )

  const title =
    period === 'today' ? 'Bugünün Randevuları'
      : period === 'week' ? 'Bu Haftanın Randevuları'
        : 'Bu Ayın Randevuları'

  const emptyMessage =
    period === 'today' ? 'Bugün randevu bulunmuyor'
      : period === 'week' ? 'Bu hafta aktif randevu bulunmuyor'
        : 'Bu ay aktif randevu bulunmuyor'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="px-4 sm:px-6 pb-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1.5" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="px-4 sm:px-6 pb-6 text-center">
            <p className="text-sm text-salon-muted">{emptyMessage}</p>
          </div>
        ) : (
          <ul className="divide-y divide-salon-border">
            {appointments.map((apt) => (
              <li key={apt.id}>
                <button
                  type="button"
                  onClick={() => setSelected(apt)}
                  className="w-full flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-salon-bg transition-colors text-left"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold"
                    style={{ backgroundColor: apt.staffColorCode ?? '#6B48FF' }}
                  >
                    {apt.customerName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{apt.customerName}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {period !== 'today' && (
                        <span className="text-xs font-medium text-gray-700">{formatShortDate(apt.startTime)}</span>
                      )}
                      <Clock className="w-3 h-3 text-salon-muted" />
                      <span className="text-xs text-salon-muted">
                        {formatTime(apt.startTime)} – {formatTime(apt.endTime)}
                      </span>
                      <User className="w-3 h-3 text-salon-muted ml-1" />
                      <span className="text-xs text-salon-muted truncate">{apt.staffName}</span>
                    </div>
                  </div>
                  <span className={cn('text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap', statusStyle[apt.status])}>
                    {statusLabel[apt.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {selected && (
        <AppointmentStatusModal
          open={!!selected}
          onOpenChange={(o) => { if (!o) setSelected(null) }}
          tenantSlug={tenantId}
          appointmentId={selected.id}
          currentStatus={selected.status}
          appointmentTitle={`${selected.customerName} — ${selected.serviceName}`}
          defaultPrice={selected.priceCharged ?? 0}
        />
      )}
    </Card>
  )
}
