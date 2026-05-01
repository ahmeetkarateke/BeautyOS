'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2, CheckCircle, Clock, XCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { adminApiFetch } from '@/lib/admin-api'

interface AdminStats {
  totalTenants: number
  activeTenants: number
  trialTenants: number
  expiredTenants: number
}

const kpiConfig = [
  {
    key: 'totalTenants' as const,
    label: 'Toplam Salon',
    icon: Building2,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
  },
  {
    key: 'activeTenants' as const,
    label: 'Aktif Salon',
    icon: CheckCircle,
    color: 'text-green-600',
    bg: 'bg-green-100',
  },
  {
    key: 'trialTenants' as const,
    label: "Trial'da",
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  {
    key: 'expiredTenants' as const,
    label: 'Süresi Dolmuş',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-100',
  },
]

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApiFetch<AdminStats>('/api/v1/admin/stats'),
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiConfig.map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className="bg-white rounded-xl border border-salon-border p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-salon-muted font-medium">{label}</p>
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold text-gray-900">{data?.[key] ?? 0}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
