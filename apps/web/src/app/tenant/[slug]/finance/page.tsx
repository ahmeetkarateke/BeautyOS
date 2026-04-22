'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Banknote, CreditCard, Wallet, TrendingUp, Trash2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { apiFetch } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

interface PageProps {
  params: { slug: string }
}

type DatePreset = 'today' | 'week' | 'month' | 'year' | 'custom'

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

interface DailyBreakdownItem {
  date: string
  revenue: number
  cashRevenue: number
  cardRevenue: number
  completedCount: number
  netRevenue: number
}

interface DailyReport {
  totalRevenue: number
  cashRevenue: number
  cardRevenue: number
  netRevenue: number
  completedCount: number
  transactions: Transaction[]
  expenses: Expense[]
  dailyBreakdown?: DailyBreakdownItem[]
}

interface StaffCommission {
  staffId: string
  staffName: string
  completedAppointments: number
  revenue: number
  commission: number
}

interface CloseDayReport {
  date: string
  totalRevenue: number
  cashRevenue: number
  cardRevenue: number
  totalExpenses: number
  netProfit: number
  transactionCount: number
  transactions: Transaction[]
  expenses: Expense[]
  staffCommissions: StaffCommission[]
}

const EXPENSE_CATEGORIES = ['Yemek', 'Malzeme', 'Fatura', 'Personel', 'Kira', 'Temizlik', 'Ekipman', 'Diğer']
const REVENUE_CATEGORIES = ['Tümü', 'Saç', 'Tırnak', 'Cilt', 'Masaj', 'Diğer']
const PRESETS: DatePreset[] = ['today', 'week', 'month', 'year', 'custom']
const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Bugün',
  week: 'Bu Hafta',
  month: 'Bu Ay',
  year: 'Bu Yıl',
  custom: 'Özel Aralık',
}

function getDateRange(preset: DatePreset, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = fmt(now)

  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'week': {
      const day = now.getDay()
      const mondayOffset = day === 0 ? -6 : 1 - day
      const monday = new Date(now)
      monday.setDate(now.getDate() + mondayOffset)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { from: fmt(monday), to: fmt(sunday) }
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: fmt(first), to: fmt(last) }
    }
    case 'year':
      return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
    case 'custom':
      return { from: customFrom, to: customTo }
  }
}

export default function FinancePage({ params }: PageProps) {
  const slug = params.slug
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (user?.role === 'staff') router.replace(`/tenant/${slug}/dashboard`)
  }, [user, slug, router])
  const today = new Date().toISOString().split('T')[0]

  const [preset, setPreset] = useState<DatePreset>('today')
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)

  const { from, to } = getDateRange(preset, customFrom, customTo)
  const isMultiDay = from !== to
  const isInvalidRange = from > to

  const [revenueFilter, setRevenueFilter] = useState<string>('Tümü')
  const [expenseFilter, setExpenseFilter] = useState<string>('Tümü')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ title: '', category: 'Yemek', customCategory: '', amount: '' })
  const [showRevenueForm, setShowRevenueForm] = useState(false)
  const [revenueForm, setRevenueForm] = useState({ description: '', amount: '', paymentMethod: 'cash' as 'cash' | 'card' })

  const [closeDayOpen, setCloseDayOpen] = useState(false)
  const [closeDayLoading, setCloseDayLoading] = useState(false)
  const [closeDayData, setCloseDayData] = useState<CloseDayReport | null>(null)

  const queryUrl = isMultiDay
    ? `/api/v1/tenants/${slug}/reports/daily?from=${from}&to=${to}&groupBy=day`
    : `/api/v1/tenants/${slug}/reports/daily?from=${from}&to=${to}`

  const { data: daily, isLoading: dailyLoading } = useQuery({
    queryKey: ['finance', slug, from, to],
    queryFn: () => apiFetch<DailyReport>(queryUrl),
    enabled: !!slug && !isInvalidRange,
  })

  const { data: commissionsData, isLoading: commissionsLoading } = useQuery({
    queryKey: ['finance-commissions', slug, from],
    queryFn: () => apiFetch<{ data: StaffCommission[] }>(`/api/v1/tenants/${slug}/reports/staff-commissions?date=${from}`),
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
        expenseDate: from,
      }),
    })
    queryClient.invalidateQueries({ queryKey: ['finance', slug, from, to] })
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
        revenueDate: from,
      }),
    })
    queryClient.invalidateQueries({ queryKey: ['finance', slug, from, to] })
    setShowRevenueForm(false)
    setRevenueForm({ description: '', amount: '', paymentMethod: 'cash' })
    toast('Gelir eklendi')
  }

  async function handleDeleteExpense(expenseId: string) {
    await apiFetch(`/api/v1/tenants/${slug}/expenses/${expenseId}`, { method: 'DELETE' })
    queryClient.invalidateQueries({ queryKey: ['finance', slug, from, to] })
    toast('Gider silindi')
  }

  async function handleCloseDay() {
    setCloseDayLoading(true)
    try {
      const data = await apiFetch<CloseDayReport>(`/api/v1/tenants/${slug}/finance/close-day?date=${today}`, { method: 'POST' })
      setCloseDayData(data)
      setCloseDayOpen(true)
    } catch {
      toast('Kasa kapatılırken hata oluştu')
    } finally {
      setCloseDayLoading(false)
    }
  }

  function handlePrint() {
    if (!closeDayData) return
    const esc = (s: string | null | undefined) => String(s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const fmt = (n: number) => `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
    const time = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

    const txRows = closeDayData.transactions.map((t) =>
      `<tr><td>${time(t.time)}</td><td>${esc(t.customerName)}</td><td>${esc(t.serviceName) || 'Manuel Gelir'}</td><td class="r">${fmt(t.amount)}</td><td class="r">${t.paymentMethod === 'cash' ? 'Nakit' : 'Kart'}</td></tr>`
    ).join('')

    const commRows = (closeDayData.staffCommissions ?? []).map((s) =>
      `<tr><td>${esc(s.staffName)}</td><td class="r">${s.completedAppointments ?? 0}</td><td class="r">${fmt(s.revenue ?? 0)}</td><td class="r">${fmt(s.commission ?? 0)}</td></tr>`
    ).join('')

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
<title>Kasa Raporu — ${closeDayData.date}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:#111827;margin:0}
  h1{font-size:20px;font-weight:700;margin:0 0 4px}
  .sub{color:#6b7280;font-size:13px;margin-bottom:24px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}
  .card{border:1px solid #e5e7eb;border-radius:8px;padding:16px}
  .label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
  .val{font-size:20px;font-weight:700;color:#111827}
  .val.hl{color:#6B48FF}.val.neg{color:#dc2626}
  h2{font-size:14px;font-weight:600;margin:0 0 10px}
  table{width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px}
  thead tr{background:#f9fafb}
  th{text-align:left;padding:8px 10px;font-size:11px;color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb}
  td{padding:8px 10px;border-bottom:1px solid #f3f4f6}
  .r{text-align:right}
</style></head><body>
<h1>Kasa Kapatma Raporu</h1>
<p class="sub">${esc(closeDayData.date)}</p>
<div class="grid">
  <div class="card"><div class="label">Toplam Ciro</div><div class="val">${fmt(closeDayData.totalRevenue)}</div></div>
  <div class="card"><div class="label">Nakit</div><div class="val">${fmt(closeDayData.cashRevenue)}</div></div>
  <div class="card"><div class="label">Kart</div><div class="val">${fmt(closeDayData.cardRevenue)}</div></div>
  <div class="card"><div class="label">Giderler</div><div class="val neg">-${fmt(closeDayData.totalExpenses)}</div></div>
  <div class="card"><div class="label">Net Kâr</div><div class="val hl">${fmt(closeDayData.netProfit)}</div></div>
</div>
${txRows ? `<h2>İşlemler (${closeDayData.transactionCount})</h2>
<table><thead><tr><th>Saat</th><th>Müşteri</th><th>Hizmet</th><th class="r">Tutar</th><th class="r">Ödeme</th></tr></thead><tbody>${txRows}</tbody></table>` : ''}
${commRows ? `<h2>Personel Komisyonları</h2>
<table><thead><tr><th>Personel</th><th class="r">Tamamlanan</th><th class="r">Ciro</th><th class="r">Komisyon</th></tr></thead><tbody>${commRows}</tbody></table>` : ''}
</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Kasa</h1>
        <div className="flex flex-col gap-2">
          {/* Preset toggle */}
          <div className="flex items-center bg-salon-bg border border-salon-border rounded-lg p-1 flex-wrap gap-0.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
                  preset === p
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-salon-muted hover:text-gray-900',
                )}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Custom date range pickers */}
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                max={today}
                onChange={(e) => {
                  const val = e.target.value
                  setCustomFrom(val)
                  if (val > customTo) toast('Başlangıç tarihi bitiş tarihinden büyük olamaz')
                }}
                className="border border-salon-border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <span className="text-salon-muted text-sm">—</span>
              <input
                type="date"
                value={customTo}
                max={today}
                onChange={(e) => {
                  const val = e.target.value
                  setCustomTo(val)
                  if (customFrom > val) toast('Başlangıç tarihi bitiş tarihinden büyük olamaz')
                }}
                className="border border-salon-border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          )}

          {isInvalidRange && (
            <p className="text-xs text-red-500">Başlangıç tarihi bitiş tarihinden büyük olamaz</p>
          )}
        </div>
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

      {/* Daily breakdown — multi-day ranges only */}
      {isMultiDay && !isInvalidRange && (
        <div className="bg-white rounded-xl border border-salon-border">
          <div className="px-4 py-3 border-b border-salon-border">
            <h2 className="text-sm font-semibold text-gray-900">Günlük Dağılım</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-salon-border bg-salon-bg">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-salon-muted">Tarih</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Randevu</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Ciro</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Nakit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Kart</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Net</th>
                </tr>
              </thead>
              <tbody>
                {dailyLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-salon-muted">Yükleniyor…</td>
                  </tr>
                ) : !daily?.dailyBreakdown?.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-salon-muted">Bu aralıkta kayıt yok.</td>
                  </tr>
                ) : (
                  daily.dailyBreakdown.map((row) => (
                    <tr key={row.date} className="border-b border-salon-border last:border-0 hover:bg-salon-bg transition-colors">
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{formatDate(row.date)}</td>
                      <td className="px-4 py-3 text-right text-salon-muted">{row.completedCount}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(row.revenue)}</td>
                      <td className="px-4 py-3 text-right text-salon-muted">{formatCurrency(row.cashRevenue)}</td>
                      <td className="px-4 py-3 text-right text-salon-muted">{formatCurrency(row.cardRevenue)}</td>
                      <td className="px-4 py-3 text-right font-medium text-primary">{formatCurrency(row.netRevenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            onClick={handleCloseDay}
            disabled={closeDayLoading}
            className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {closeDayLoading ? 'Hesaplanıyor…' : 'Kasa Kapatma'}
          </button>
        </div>
      )}

      {/* Kasa Kapatma Dialog */}
      <Dialog open={closeDayOpen} onOpenChange={setCloseDayOpen}>
        <DialogContent className="max-w-2xl">
          <div>
            <DialogHeader>
              <DialogTitle>Kasa Kapatma Raporu</DialogTitle>
              {closeDayData?.date && (
                <p className="text-sm text-salon-muted">{formatDate(closeDayData.date)}</p>
              )}
            </DialogHeader>

            {/* Summary — large font */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Toplam Ciro', value: closeDayData?.totalRevenue ?? 0, variant: 'default' },
                { label: 'Nakit', value: closeDayData?.cashRevenue ?? 0, variant: 'default' },
                { label: 'Kart', value: closeDayData?.cardRevenue ?? 0, variant: 'default' },
                { label: 'Giderler', value: closeDayData?.totalExpenses ?? 0, variant: 'negative' },
                { label: 'Net Kâr', value: closeDayData?.netProfit ?? 0, variant: 'highlight' },
              ].map(({ label, value, variant }) => (
                <div
                  key={label}
                  className={cn(
                    'rounded-xl p-4 border',
                    variant === 'highlight'
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-salon-bg border-salon-border',
                  )}
                >
                  <p className="text-xs text-salon-muted mb-1">{label}</p>
                  <p
                    className={cn(
                      'text-xl font-bold',
                      variant === 'highlight' && 'text-primary',
                      variant === 'negative' && 'text-red-600',
                      variant === 'default' && 'text-gray-900',
                    )}
                  >
                    {variant === 'negative' ? '-' : ''}{formatCurrency(value)}
                  </p>
                </div>
              ))}
            </div>

            {/* Transactions table */}
            {!!closeDayData?.transactions?.length && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  İşlemler ({closeDayData.transactionCount})
                </h3>
                <div className="overflow-x-auto rounded-lg border border-salon-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-salon-bg border-b border-salon-border">
                        <th className="text-left px-3 py-2 text-xs font-medium text-salon-muted">Saat</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-salon-muted">Müşteri</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-salon-muted">Hizmet</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-salon-muted">Tutar</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-salon-muted">Ödeme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closeDayData.transactions.map((t) => (
                        <tr key={t.id} className="border-b border-salon-border last:border-0">
                          <td className="px-3 py-2 text-salon-muted whitespace-nowrap">
                            {new Date(t.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-2 text-gray-900">{t.customerName || t.description || '—'}</td>
                          <td className="px-3 py-2 text-salon-muted">{t.serviceName || 'Manuel Gelir'}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{formatCurrency(t.amount)}</td>
                          <td className="px-3 py-2 text-right text-salon-muted whitespace-nowrap">
                            {t.paymentMethod === 'cash' ? 'Nakit' : 'Kart'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Staff commissions table */}
            {!!closeDayData?.staffCommissions?.length && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Personel Komisyonları</h3>
                <div className="overflow-x-auto rounded-lg border border-salon-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-salon-bg border-b border-salon-border">
                        <th className="text-left px-3 py-2 text-xs font-medium text-salon-muted">Personel</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-salon-muted">Tamamlanan</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-salon-muted">Ciro</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-salon-muted">Komisyon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closeDayData.staffCommissions.map((row) => (
                        <tr key={row.staffId} className="border-b border-salon-border last:border-0">
                          <td className="px-3 py-2 font-medium text-gray-900">{row.staffName}</td>
                          <td className="px-3 py-2 text-right text-salon-muted">{row.completedAppointments}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(row.revenue)}</td>
                          <td className="px-3 py-2 text-right font-medium text-primary">{formatCurrency(row.commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end mt-5">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Yazdır
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Kapat</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
