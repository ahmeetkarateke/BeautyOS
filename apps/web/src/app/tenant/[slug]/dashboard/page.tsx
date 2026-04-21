'use client'

import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Calendar, Users, Percent } from 'lucide-react'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { TodaysAppointments } from '@/components/dashboard/todays-appointments'
import { apiFetch } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface DashboardData {
  todayRevenue: number
  todayAppointmentCount: number
  totalCustomers: number
  occupancyRate: number
  revenueChange: number
  appointmentChange: number
}

interface PageProps {
  params: { slug: string }
}

export default function DashboardPage({ params }: PageProps) {
  const user = useAuthStore((s) => s.user)
  const tenantId = params.slug

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', tenantId],
    queryFn: () => apiFetch<DashboardData>(`/api/v1/tenants/${tenantId}/dashboard`),
    enabled: !!tenantId,
  })

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Merhaba, {user?.name?.split(' ')[0] ?? 'Hoşgeldiniz'} 👋
        </h1>
        <p className="text-sm text-salon-muted mt-1">{formatDate(new Date())}</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Bugünün Geliri"
          value={isLoading ? '—' : formatCurrency(data?.todayRevenue ?? 0)}
          icon={TrendingUp}
          iconColor="bg-primary-100 text-primary"
          trend={data ? { value: data.revenueChange, label: 'dün' } : undefined}
          loading={isLoading}
        />
        <KpiCard
          title="Randevular"
          value={isLoading ? '—' : data?.todayAppointmentCount ?? 0}
          subtitle="bugün"
          icon={Calendar}
          iconColor="bg-blue-100 text-blue-600"
          trend={data ? { value: data.appointmentChange, label: 'dün' } : undefined}
          loading={isLoading}
        />
        <KpiCard
          title="Müşteriler"
          value={isLoading ? '—' : data?.totalCustomers ?? 0}
          subtitle="toplam"
          icon={Users}
          iconColor="bg-green-100 text-success"
          loading={isLoading}
        />
        <KpiCard
          title="Doluluk"
          value={isLoading ? '—' : `${data?.occupancyRate ?? 0}%`}
          subtitle="bugün"
          icon={Percent}
          iconColor="bg-orange-100 text-orange-600"
          loading={isLoading}
        />
      </div>

      {/* Today's appointments */}
      <TodaysAppointments tenantId={tenantId} />
    </div>
  )
}
