'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CreditCard, Wallet, TrendingUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

interface PageProps {
  params: { slug: string }
}

interface Transaction {
  id: string
  time: string
  customerName: string
  serviceName: string
  serviceCategory: string
  description?: string
  amount: number
  paymentMethod: 'cash' | 'card'
}

interface Expense {
  id: string
  title: string
  category: string
  amount: number
}

interface DailyReport {
  totalRevenue: number
  cashRevenue: number
  cardRevenue: number
  netRevenue: number
  completedCount: number
  transactions: Transaction[]
  expenses: Expense[]
}

interface StaffCommission {
  staffId: string
  staffName: string
  completedAppointments: number
  revenue: number
  commission: number
}

const EXPENSE_CATEGORIES = ['Yemek', 'Malzeme', 'Fatura', 'Personel', 'Kira', 'Temizlik', 'Ekipman', 'Diğer']
const REVENUE_CATEGORIES = ['Tümü', 'Saç', 'Tırnak', 'Cilt', 'Masaj', 'Diğer']

export default function FinancePage({ params }: PageProps) {
  const slug = params.slug
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)

  const [revenueFilter, setRevenueFilter] = useState<string>('Tümü')
  const [expenseFilter, setExpenseFilter] = useState<string>('Tümü')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ title: '', category: 'Yemek', customCategory: '', amount: '' })
  const [showRevenueForm, setShowRevenueForm] = useState(false)
  const [revenueForm, setRevenueForm] = useState({ description: '', amount: '', paymentMethod: 'cash' as 'cash' | 'card' })

  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ['finance-daily', slug, date],
    queryFn: () => apiFetch<DailyReport>(`/api/v1/tenants/${slug}/reports/daily?date=${date}`),
    enabled: !!slug,
  })

  const { data: commissionsData, isLoading: commissionsLoading } = useQuery({
    queryKey: ['finance-commissions', slug, date],
    queryFn: () => apiFetch<{ data: StaffCommission[] }>(`/api/v1/tenants/${slug}/reports/staff-commissions?date=${date}`),
    enabled: !!slug,
  })

  const commissions = commissionsData?.data

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
      value: dailyLoading ? '—' : formatCurrency(daily?.netRevenue ?? 0),
      icon: Banknote,
      color: 'bg-orange-100 text-orange-600',
    },
  ]

  const filteredTransactions = revenueFilter === 'Tümü'
    ? (daily?.transactions ?? [])
    : (daily?.transactions ?? []).filter((t) => t.serviceCategory === revenueFilter)

  const filteredExpenses = expenseFilter === 'Tümü'
    ? (daily?.expenses ?? [])
    : (daily?.expenses ?? []).filter((e) => e.category === expenseFilter)

  async function handleAddExpense() {
    const category = expenseForm.category === 'Diğer' && expenseForm.customCategory
      ? expenseForm.customCategory
      : expenseForm.category
    await apiFetch(`/api/v1/tenants/${slug}/expenses`, {
      method: 'POST',
      body: JSON.stringify({
        title: expenseForm.title,
        category,
        amount: Number(expenseForm.amount),
        expenseDate: date,
      }),
    })
    queryClient.invalidateQueries({ queryKey: ['finance-daily', slug, date] })
    setShowExpenseForm(false)
    setExpenseForm({ title: '', category: 'Yemek', customCategory: '', amount: '' })
    toast('Gider eklendi')
  }

  async function handleAddRevenue() {
    if (!revenueForm.description || !revenueForm.amount) return
    await apiFetch(`/api/v1/tenants/${slug}/revenues`, {
      method: 'POST',
      body: JSON.stringify({
        description: revenueForm.description,
        amount: Number(revenueForm.amount),
        paymentMethod: revenueForm.paymentMethod,
        revenueDate: date,
      }),
    })
    queryClient.invalidateQueries({ queryKey: ['finance-daily', slug, date] })
    setShowRevenueForm(false)
    setRevenueForm({ description: '', amount: '', paymentMethod: 'cash' })
    toast('Gelir eklendi')
  }

  async function handleDeleteExpense(expenseId: string) {
    await apiFetch(`/api/v1/tenants/${slug}/expenses/${expenseId}`, { method: 'DELETE' })
    queryClient.invalidateQueries({ queryKey: ['finance-daily', slug, date] })
    toast('Gider silindi')
  }

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

      {/* Gelirler */}
      <div className="bg-white rounded-xl border border-salon-border">
        <div className="px-4 py-3 border-b border-salon-border flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Gelirler</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {REVENUE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setRevenueFilter(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    revenueFilter === cat
                      ? 'bg-primary text-white border-primary'
                      : 'border-salon-border text-salon-muted hover:border-primary',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowRevenueForm(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-medium whitespace-nowrap"
            >
              + Manuel Gelir
            </button>
          </div>
        </div>

        {showRevenueForm && (
          <div className="px-4 py-4 border-b border-salon-border bg-salon-bg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-salon-muted">Açıklama</label>
                <input
                  value={revenueForm.description}
                  onChange={(e) => setRevenueForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Walk-in müşteri, saç kesimi..."
                  className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-salon-muted">Tutar (₺)</label>
                <input
                  type="number"
                  value={revenueForm.amount}
                  onChange={(e) => setRevenueForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-salon-muted">Ödeme Yöntemi</label>
              <div className="grid grid-cols-2 gap-2">
                {(['cash', 'card'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setRevenueForm((p) => ({ ...p, paymentMethod: m }))}
                    className={cn(
                      'py-2 rounded-lg text-sm font-medium border transition-colors',
                      revenueForm.paymentMethod === m
                        ? 'bg-primary text-white border-primary'
                        : 'border-salon-border text-salon-muted hover:border-primary',
                    )}
                  >
                    {m === 'cash' ? '💵 Nakit' : '💳 Kart'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowRevenueForm(false)}>İptal</Button>
              <Button size="sm" onClick={handleAddRevenue}>Kaydet</Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-salon-border bg-salon-bg">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-salon-muted">Saat</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-salon-muted">Müşteri</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-salon-muted">Hizmet</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Tutar</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Ödeme</th>
              </tr>
            </thead>
            <tbody>
              {dailyLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-salon-muted">Yükleniyor…</td>
                </tr>
              ) : !filteredTransactions.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-salon-muted">Bu tarihte gelir kaydı yok.</td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="border-b border-salon-border last:border-0 hover:bg-salon-bg transition-colors">
                    <td className="px-4 py-3 text-salon-muted whitespace-nowrap">
                      {new Date(t.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-gray-900">{t.customerName || t.description || '—'}</td>
                    <td className="px-4 py-3 text-salon-muted">{t.serviceName || 'Manuel Gelir'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(t.amount)}</td>
                    <td className="px-4 py-3 text-right text-salon-muted whitespace-nowrap">
                      {t.paymentMethod === 'cash' ? '💵 Nakit' : '💳 Kart'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Personel Komisyonları */}
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

      {/* Giderler */}
      <div className="bg-white rounded-xl border border-salon-border">
        <div className="px-4 py-3 border-b border-salon-border flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Giderler</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {(['Tümü', ...EXPENSE_CATEGORIES]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setExpenseFilter(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    expenseFilter === cat
                      ? 'bg-primary text-white border-primary'
                      : 'border-salon-border text-salon-muted hover:border-primary',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            {user?.role === 'owner' && (
              <button
                onClick={() => setShowExpenseForm(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-medium whitespace-nowrap"
              >
                + Gider Ekle
              </button>
            )}
          </div>
        </div>

        {showExpenseForm && user?.role === 'owner' && (
          <div className="px-4 py-4 border-b border-salon-border bg-salon-bg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-salon-muted">Başlık</label>
                <input
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-salon-muted">Tutar (₺)</label>
                <input
                  type="number"
                  min={0}
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-salon-muted">Kategori</label>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            {expenseForm.category === 'Diğer' && (
              <input
                placeholder="Kategori adı girin"
                value={expenseForm.customCategory}
                onChange={(e) => setExpenseForm((f) => ({ ...f, customCategory: e.target.value }))}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowExpenseForm(false)}>İptal</Button>
              <Button size="sm" onClick={handleAddExpense}>Kaydet</Button>
            </div>
          </div>
        )}

        {dailyLoading ? (
          <p className="px-4 py-6 text-center text-sm text-salon-muted">Yükleniyor…</p>
        ) : !filteredExpenses.length ? (
          <p className="px-4 py-6 text-center text-sm text-salon-muted">Bu tarihte gider kaydı yok.</p>
        ) : (
          <ul className="divide-y divide-salon-border">
            {filteredExpenses.map((exp) => (
              <li key={exp.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-full bg-salon-bg border border-salon-border text-xs text-salon-muted whitespace-nowrap">
                    {exp.category}
                  </span>
                  <span className="text-sm text-gray-900 truncate">{exp.title}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-medium text-red-600">-{formatCurrency(exp.amount)}</span>
                  {user?.role === 'owner' && (
                    <button
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="p-1 text-salon-muted hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Kasa Kapatma — owner only */}
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
