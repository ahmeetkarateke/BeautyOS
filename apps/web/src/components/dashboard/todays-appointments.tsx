'use client'

import { useQuery } from '@tanstack/react-query'
import { Clock, User } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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

interface TodaysAppointmentsProps {
  tenantId: string
}

export function TodaysAppointments({ tenantId }: TodaysAppointmentsProps) {
  const today = new Date().toISOString().split('T')[0]

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', tenantId, today],
    queryFn: () =>
      apiFetch<{ data: Appointment[] }>(
        `/api/v1/tenants/${tenantId}/appointments?date=${today}&limit=10`,
      ),
  })

  const appointments = data?.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bugünün Randevuları</CardTitle>
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
            <p className="text-sm text-salon-muted">Bugün randevu bulunmuyor</p>
          </div>
        ) : (
          <ul className="divide-y divide-salon-border">
            {appointments.map((apt) => (
              <li key={apt.id} className="flex items-center gap-3 px-4 sm:px-6 py-3 hover:bg-salon-bg transition-colors">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold"
                  style={{ backgroundColor: apt.staffColorCode ?? '#6B48FF' }}
                >
                  {apt.customerName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{apt.customerName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
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
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
