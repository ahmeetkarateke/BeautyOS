'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Wallet, Users, TrendingUp, Trash2, HandCoins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/components/ui/toaster'
import { AddTipModal } from '@/components/tips/add-tip-modal'
import { DistributeModal } from '@/components/tips/distribute-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'

interface PageProps {
  params: { slug: string }
}

type Period = 'today' | 'week' | 'month' | 'custom'

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Bugün',
  week: 'Bu Hafta',
  month: 'Bu Ay',
  custom: 'Özel',
}

const SOURCE_LABELS: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart',
  salon_pool: 'Havuz',
}

interface DistributionItem {
  id: string
  staffId: string
  staffName: string | null
  amount: number
  shareWeight: number | null
  notes: string | null
  distributedAt: string
}

interface TipEntry {
  id: string
  amount: number
  source: 'cash' | 'card' | 'salon_pool'
  notes: string | null
  collectedAt: string
  isDistributed: boolean
  staffId: string | null
  staffName: string | null
  appointmentId: string | null
  appointmentReference: string | null
  customerName: string | null
  distributions: DistributionItem[]
}

interface TipsResponse {
  data: TipEntry[]
  nextCursor: string | null
}

interface PerStaffSummary {
  staffId: string
  staffName: string
  total: number
}

interface SummaryResponse {
  period: Period
  from: string
  to: string
  totalAmount: number
  totalCount: number
  undistributedTotal: number
  undistributedCount: number
  avgPerStaff: number
  staffCount: number
  perStaff: PerStaffSummary[]
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function getDateRange(period: Period, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = fmt(now)
  if (period === 'today') return { from: today, to: today }
  if (period === 'week') {
    const dow = now.getDay() || 7
    const monday = new Date(now); monday.setDate(now.getDate() - (dow - 1))
    return { from: fmt(monday), to: today }
  }
  if (period === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: fmt(first), to: today }
  }
  return { from: customFrom || today, to: customTo || today }
}

export default function TipsPage({ params }: PageProps) {
  const user = useAuthStore((s) => s.user)
  const isOwnerOrManager = user?.role === 'owner' || user?.role === 'manager'

  const [period, setPeriod] = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [distributeOpen, setDistributeOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const range = useMemo(() => getDateRange(period, customFrom, customTo), [period, customFrom, customTo])

  const summaryQuery = useQuery<SummaryResponse>({
    queryKey: ['tips-summary', params.slug, period, range.from, range.to],
    queryFn: () => {
      const qs = new URLSearchParams({ period })
      if (period === 'custom') {
        qs.set('from', range.from)
        qs.set('to', range.to)
      }
      return apiFetch<SummaryResponse>(`/api/v1/tenants/${params.slug}/tips/summary?${qs.toString()}`)
    },
  })

  const tipsQuery = useQuery<TipsResponse>({
    queryKey: ['tips', params.slug, range.from, range.to],
    queryFn: () => {
      const qs = new URLSearchParams({ from: range.from, to: range.to, limit: '100' })
      return apiFetch<TipsResponse>(`/api/v1/tenants/${params.slug}/tips?${qs.toString()}`)
    },
  })

  const qc = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${params.slug}/tips/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tips', params.slug] })
      qc.invalidateQueries({ queryKey: ['tips-summary', params.slug] })
      toast('Bahşiş silindi')
      setDeleteId(null)
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const summary = summaryQuery.data
  const tips = tipsQuery.data?.data ?? []
  const allDistributions = useMemo(() => {
    return tips.flatMap((t) => t.distributions)
      .sort((a, b) => new Date(b.distributedAt).getTime() - new Date(a.distributedAt).getTime())
  }, [tips])

  const undistributed = summary?.undistributedTotal ?? 0

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Bahşiş</h1>
          <p className="text-sm text-salon-muted mt-1">Personel bahşişleri ve havuz yönetimi</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isOwnerOrManager && undistributed > 0 && (
            <Button variant="outline" onClick={() => setDistributeOpen(true)}>
              <HandCoins className="w-4 h-4" /> Havuzu Dağıt
            </Button>
          )}
          {isOwnerOrManager && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" /> Bahşiş Ekle
            </Button>
          )}
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 flex-wrap items-center">
        {(['today', 'week', 'month', 'custom'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              period === p
                ? 'bg-primary text-white'
                : 'bg-white border border-salon-border text-salon-muted hover:bg-salon-bg',
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 px-2 rounded-md border border-salon-border text-sm"
            />
            <span className="text-salon-muted text-sm">—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 px-2 rounded-md border border-salon-border text-sm"
            />
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-salon-muted">Toplam Bahşiş</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {formatCurrency(summary?.totalAmount ?? 0)}
                </p>
                <p className="text-xs text-salon-muted mt-1">{summary?.totalCount ?? 0} kayıt</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-salon-muted">Havuzdaki (Dağıtılmamış)</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {formatCurrency(undistributed)}
                </p>
                <p className="text-xs text-salon-muted mt-1">{summary?.undistributedCount ?? 0} kayıt</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <HandCoins className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-salon-muted">Personel başı ortalama</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {formatCurrency(summary?.avgPerStaff ?? 0)}
                </p>
                <p className="text-xs text-salon-muted mt-1">{summary?.staffCount ?? 0} personel</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-staff summary */}
      {summary && summary.perStaff.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-salon-muted" />
              <h2 className="font-semibold text-gray-900">Personel Bazlı Toplamlar</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {summary.perStaff.map((s) => (
                <div key={s.staffId} className="flex items-center justify-between p-2 rounded-md bg-salon-bg">
                  <span className="text-sm">{s.staffName}</span>
                  <span className="text-sm font-semibold text-primary">{formatCurrency(s.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips table */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-gray-900 mb-3">Bahşiş Kayıtları</h2>
          {tipsQuery.isLoading ? (
            <p className="text-sm text-salon-muted">Yükleniyor…</p>
          ) : tips.length === 0 ? (
            <p className="text-sm text-salon-muted py-6 text-center">Bu aralıkta bahşiş yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-salon-muted border-b border-salon-border">
                    <th className="py-2 pr-3">Tarih</th>
                    <th className="py-2 pr-3">Personel / Havuz</th>
                    <th className="py-2 pr-3">Randevu</th>
                    <th className="py-2 pr-3 text-right">Tutar</th>
                    <th className="py-2 pr-3">Kaynak</th>
                    <th className="py-2 pr-3">Not</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tips.map((t) => (
                    <tr key={t.id} className="border-b border-salon-border last:border-b-0">
                      <td className="py-2 pr-3 text-salon-muted">{formatDateTime(t.collectedAt)}</td>
                      <td className="py-2 pr-3">
                        {t.staffName ?? <span className="text-amber-600 font-medium">Havuz</span>}
                        {t.isDistributed && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">dağıtıldı</span>}
                      </td>
                      <td className="py-2 pr-3 text-salon-muted">
                        {t.customerName ? `${t.customerName}` : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right font-medium">{formatCurrency(t.amount)}</td>
                      <td className="py-2 pr-3 text-salon-muted">{SOURCE_LABELS[t.source] ?? t.source}</td>
                      <td className="py-2 pr-3 text-salon-muted truncate max-w-[200px]">{t.notes ?? '—'}</td>
                      <td className="py-2 text-right">
                        {isOwnerOrManager && !t.isDistributed && (
                          <button
                            onClick={() => setDeleteId(t.id)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            aria-label="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distributions table */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-gray-900 mb-3">Dağıtım Geçmişi</h2>
          {allDistributions.length === 0 ? (
            <p className="text-sm text-salon-muted py-6 text-center">Henüz dağıtım yapılmadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-salon-muted border-b border-salon-border">
                    <th className="py-2 pr-3">Tarih</th>
                    <th className="py-2 pr-3">Personel</th>
                    <th className="py-2 pr-3 text-right">Tutar</th>
                    <th className="py-2 pr-3">Not</th>
                  </tr>
                </thead>
                <tbody>
                  {allDistributions.map((d) => (
                    <tr key={d.id} className="border-b border-salon-border last:border-b-0">
                      <td className="py-2 pr-3 text-salon-muted">{formatDateTime(d.distributedAt)}</td>
                      <td className="py-2 pr-3">{d.staffName ?? '—'}</td>
                      <td className="py-2 pr-3 text-right font-medium">{formatCurrency(d.amount)}</td>
                      <td className="py-2 pr-3 text-salon-muted">{d.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddTipModal open={addOpen} onOpenChange={setAddOpen} tenantSlug={params.slug} />
      <DistributeModal
        open={distributeOpen}
        onOpenChange={setDistributeOpen}
        tenantSlug={params.slug}
        poolAmount={undistributed}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Bahşişi sil"
        description="Bu bahşiş kaydı silinecek. Devam etmek istiyor musunuz?"
        confirmLabel="Sil"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
