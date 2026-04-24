'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Calendar, Users, Percent } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { TodaysAppointments } from '@/components/dashboard/todays-appointments'
import { apiFetch } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

type Period = 'today' | 'week' | 'month'

const periodLabels: Record<Period, string> = {
  today: 'Bugün',
  week: 'Bu Hafta',
  month: 'Bu Ay',
}

interface DashboardData {
  todayRevenue: number
  todayAppointmentCount: number
  totalCustomers: number
  occupancyRate: number
  revenueChange: number | null
  appointmentChange: number | null
}

interface PageProps {
  params: { slug: string }
}

function DashboardContent({ params }: PageProps) {
  const user = useAuthStore((s) => s.user)
  const tenantId = params.slug
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const period = (searchParams.get('period') as Period) ?? 'today'

  function setPeriod(p: Period) {
    const next = new URLSearchParams(searchParams.toString())
    next.set('period', p)
    router.replace(`${pathname}?${next.toString()}`)
  }

  const isStaff = user?.role === 'staff'

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', tenantId, period],
    queryFn: () => apiFetch<DashboardData>(`/api/v1/tenants/${tenantId}/dashboard?period=${period}`),
    enabled: !!tenantId,
  })

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Merhaba, {user?.name?.split(' ')[0] ?? 'Hoşgeldiniz'} 👋
          </h1>
          <p className="text-sm text-salon-muted mt-1">{formatDate(new Date())}</p>
        </div>

        {/* Period toggle */}
        <div className="flex items-center bg-salon-bg border border-salon-border rounded-lg p-1 self-start sm:self-auto">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                period === p
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-salon-muted hover:text-gray-900',
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {!isStaff && (
          <KpiCard
            title={period === 'today' ? 'Bugünün Geliri' : period === 'week' ? 'Haftalık Gelir' : 'Aylık Gelir'}
            value={isLoading ? '—' : formatCurrency(data?.todayRevenue ?? 0)}
            icon={TrendingUp}
            iconColor="bg-primary-100 text-primary"
            trend={data && data.revenueChange !== null ? { value: data.revenueChange, label: period === 'today' ? 'dün' : period === 'week' ? 'geçen hafta' : 'geçen ay' } : undefined}
            loading={isLoading}
          />
        )}
        <KpiCard
          title="Randevular"
          value={isLoading ? '—' : data?.todayAppointmentCount ?? 0}
          subtitle={period === 'today' ? 'bugün' : period === 'week' ? 'bu hafta' : 'bu ay'}
          icon={Calendar}
          iconColor="bg-blue-100 text-blue-600"
          trend={data && data.appointmentChange !== null ? { value: data.appointmentChange, label: period === 'today' ? 'dün' : 'önceki dönem' } : undefined}
          loading={isLoading}
        />
        {!isStaff && (
          <KpiCard
            title="Müşteriler"
            value={isLoading ? '—' : data?.totalCustomers ?? 0}
            subtitle="toplam"
            icon={Users}
            iconColor="bg-green-100 text-success"
            loading={isLoading}
          />
        )}
        {!isStaff && (
          <KpiCard
            title="Doluluk"
            value={isLoading ? '—' : `${data?.occupancyRate ?? 0}%`}
            subtitle={period === 'today' ? 'bugün' : period === 'week' ? 'bu hafta' : 'bu ay'}
            icon={Percent}
            iconColor="bg-orange-100 text-orange-600"
            loading={isLoading}
          />
        )}
      </div>

      {/* Today's appointments — always shows today regardless of period filter */}
      <TodaysAppointments tenantId={tenantId} />
    </div>
  )
}

export default function DashboardPage({ params }: PageProps) {
  return (
    <Suspense>
      <DashboardContent params={params} />
    </Suspense>
  )
}
