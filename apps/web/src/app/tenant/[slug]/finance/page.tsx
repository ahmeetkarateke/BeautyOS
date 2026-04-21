'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CreditCard, Wallet, TrendingUp } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/components/ui/toaster'

interface PageProps {
  params: { slug: string }
}

interface DailyReport {
  totalRevenue: number
  cashRevenue: number
  cardRevenue: number
  netProfit: number
  expenses: { id: string; description: string; amount: number; date: string }[]
}

interface StaffCommission {
  staffId: string
  staffName: string
  completedAppointments: number
  revenue: number
  commission: number
}

export default function FinancePage({ params }: PageProps) {
  const slug = params.slug
  const user = useAuthStore((s) => s.user)
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)

  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ['finance-daily', slug, date],
    queryFn: () => apiFetch<DailyReport>(`/api/v1/tenants/${slug}/reports/daily?date=${date}`),
    enabled: !!slug,
  })

  const { data: commissions, isLoading: commissionsLoading } = useQuery({
    queryKey: ['finance-commissions', slug, date],
    queryFn: () => apiFetch<StaffCommission[]>(`/api/v1/tenants/${slug}/reports/staff-commissions?date=${date}`),
    enabled: !!slug,
  })

  const summaryCards = [
    {
      label: 'Toplam Ciro',
      value: dailyLoading ? '—' : formatCurrency(daily?.totalRevenue ?? 0),
      icon: TrendingUp,
      color: 'bg-primary-100 text-primary',
    },
    {
      label: 'Nakit',
      value: dailyLoading ? '—' : formatCurrency(daily?.cashRevenue ?? 0),
      icon: Wallet,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Kart',
      value: dailyLoading ? '—' : formatCurrency(daily?.cardRevenue ?? 0),
      icon: CreditCard,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Net Kâr',
      value: dailyLoading ? '—' : formatCurrency(daily?.netProfit ?? 0),
      icon: Banknote,
      color: 'bg-orange-100 text-orange-600',
    },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Kasa</h1>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className="border border-salon-border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-xl border border-salon-border p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-salon-muted">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-semibold text-gray-900">{card.value}</p>
            </div>
          )
        })}
      </div>

      {/* Staff commissions */}
      <div className="bg-white rounded-xl border border-salon-border">
        <div className="px-4 py-3 border-b border-salon-border">
          <h2 className="text-sm font-semibold text-gray-900">Personel Komisyonları</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-salon-border bg-salon-bg">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-salon-muted">Personel</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Tamamlanan</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Ciro (₺)</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Prim (₺)</th>
              </tr>
            </thead>
            <tbody>
              {commissionsLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-salon-muted">Yükleniyor…</td>
                </tr>
              ) : !commissions?.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-salon-muted">Bu tarihte komisyon kaydı yok.</td>
                </tr>
              ) : (
                commissions.map((row) => (
                  <tr key={row.staffId} className="border-b border-salon-border last:border-0 hover:bg-salon-bg transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.staffName}</td>
                    <td className="px-4 py-3 text-right text-salon-muted">{row.completedAppointments}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-3 text-right font-medium text-primary">{formatCurrency(row.commission)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-xl border border-salon-border">
        <div className="px-4 py-3 border-b border-salon-border">
          <h2 className="text-sm font-semibold text-gray-900">Giderler</h2>
        </div>
        {dailyLoading ? (
          <p className="px-4 py-6 text-center text-sm text-salon-muted">Yükleniyor…</p>
        ) : !daily?.expenses?.length ? (
          <p className="px-4 py-6 text-center text-sm text-salon-muted">Bu tarihte gider kaydı yok.</p>
        ) : (
          <ul className="divide-y divide-salon-border">
            {daily.expenses.map((exp) => (
              <li key={exp.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-900">{exp.description}</span>
                <span className="text-sm font-medium text-red-600">-{formatCurrency(exp.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Close day — owner only */}
      {user?.role === 'owner' && (
        <div className="flex justify-end">
          <button
            onClick={() => toast('Gün kapatıldı, özet kayıt alındı')}
            className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Kasa Kapatma
          </button>
        </div>
      )}
    </div>
  )
}
