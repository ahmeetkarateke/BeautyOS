'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { adminApiFetch } from '@/lib/admin-api'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

interface TenantRow {
  id: string
  name: string
  slug: string
  plan: string
  trialEndsAt?: string
  isActive: boolean
  createdAt: string
  _count: { users: number; appointments: number; customers: number }
}

interface TenantsResponse {
  tenants: TenantRow[]
}

const planLabel: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
}

const planColor: Record<string, string> = {
  trial: 'bg-blue-100 text-blue-700',
  starter: 'bg-green-100 text-green-700',
  pro: 'bg-purple-100 text-purple-700',
}

export default function AdminTenantsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const debouncedSearch = useDebounce(search, 400)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tenants', debouncedSearch, planFilter, activeFilter],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (debouncedSearch) qs.set('search', debouncedSearch)
      if (planFilter) qs.set('plan', planFilter)
      if (activeFilter !== '') qs.set('isActive', activeFilter)
      const query = qs.toString() ? `?${qs.toString()}` : ''
      return adminApiFetch<TenantsResponse>(`/api/v1/admin/tenants${query}`)
    },
  })

  const tenants = data?.tenants ?? []

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Tenantlar</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-salon-muted" />
          <input
            type="text"
            placeholder="Salon adı veya slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-md border border-salon-border bg-white text-sm placeholder:text-salon-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-salon-border bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Tüm Planlar</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="h-10 px-3 rounded-md border border-salon-border bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Tüm Durumlar</option>
          <option value="true">Aktif</option>
          <option value="false">Pasif</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-salon-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-salon-border bg-salon-bg">
                {['Salon Adı', 'Slug', 'Plan', 'Trial Bitiş', 'Durum', 'Kayıt Tarihi', 'Müşteri', 'Randevu', ''].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-salon-border last:border-0">
                      {[...Array(9)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                : tenants.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-salon-border last:border-0 hover:bg-salon-bg transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                      <td className="px-4 py-3 text-salon-muted font-mono text-xs">{t.slug}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                            planColor[t.plan] ?? 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {planLabel[t.plan] ?? t.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-salon-muted">
                        {t.trialEndsAt ? formatDate(t.trialEndsAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                            t.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500',
                          )}
                        >
                          {t.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-salon-muted">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-700">{t._count.customers}</td>
                      <td className="px-4 py-3 text-gray-700">{t._count.appointments}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => router.push(`/admin/tenants/${t.id}`)}
                          className="text-xs text-primary hover:underline font-medium"
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!isLoading && tenants.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-salon-muted">Tenant bulunamadı</p>
          </div>
        )}
      </div>
    </div>
  )
}
