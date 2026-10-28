'use client'

import { useEffect, useMemo, useState, use } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil, CheckCircle2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/components/ui/toaster'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { CreatePayoutModal } from '@/components/staff-payouts/create-payout-modal'
import { MarkPaidModal } from '@/components/staff-payouts/mark-paid-modal'

type PaymentMethod = 'cash' | 'card' | 'mixed' | 'online'
type PayoutStatus = 'pending' | 'paid' | 'cancelled'

interface StaffPayout {
  id: string
  staffId: string
  staffName: string | null
  periodStart: string
  periodEnd: string
  grossEarned: number
  bonus: number
  deductions: number
  netAmount: number
  paymentMethod: PaymentMethod
  status: PayoutStatus
  notes: string | null
  paidAt: string | null
  createdAt: string
}

interface StaffMember {
  id: string
  fullName: string
}

interface PageProps {
  params: Promise<{ slug: string }>
}

const STATUS_OPTIONS: { value: 'all' | PayoutStatus; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'pending', label: 'Bekliyor' },
  { value: 'paid', label: 'Ödendi' },
  { value: 'cancelled', label: 'İptal' },
]

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Nakit',
  card: 'Kart',
  mixed: 'Karışık',
  online: 'Online',
}

const STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: 'Bekliyor',
  paid: 'Ödendi',
  cancelled: 'İptal',
}

function getMonthDefaults(): { from: string; to: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: fmt(first), to: fmt(last) }
}

export default function StaffPayoutsPage(props: PageProps) {
  const params = use(props.params)
  const slug = params.slug
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const qc = useQueryClient()

  useEffect(() => {
    if (user?.role === 'staff') router.replace(`/tenant/${slug}/dashboard`)
  }, [user, slug, router])

  const defaults = useMemo(getMonthDefaults, [])
  const [from, setFrom] = useState<string>(defaults.from)
  const [to, setTo] = useState<string>(defaults.to)
  const [staffFilter, setStaffFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | PayoutStatus>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [markPaidId, setMarkPaidId] = useState<string | null>(null)
  const [markPaidDefault, setMarkPaidDefault] = useState<PaymentMethod>('cash')
  const [editingPayout, setEditingPayout] = useState<StaffPayout | null>(null)
  const [editBonus, setEditBonus] = useState<string>('0')
  const [editDeductions, setEditDeductions] = useState<string>('0')
  const [editNotes, setEditNotes] = useState<string>('')

  const { data: staffData } = useQuery({
    queryKey: ['staff', slug],
    queryFn: () => apiFetch<{ data: StaffMember[] }>(`/api/v1/tenants/${slug}/staff`),
  })

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (staffFilter !== 'all') params.set('staffId', staffFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    return params.toString()
  }, [from, to, staffFilter, statusFilter])

  const { data: payoutsData, isLoading } = useQuery({
    queryKey: ['staff-payouts', slug, queryString],
    queryFn: () => apiFetch<{ data: StaffPayout[] }>(`/api/v1/tenants/${slug}/staff-payouts?${queryString}`),
    enabled: !!user && user.role !== 'staff',
  })

  const payouts = payoutsData?.data ?? []

  const totals = useMemo(() => {
    let paid = 0
    let pending = 0
    for (const p of payouts) {
      if (p.status === 'paid') paid += p.netAmount
      else if (p.status === 'pending') pending += p.netAmount
    }
    return { paid, pending }
  }, [payouts])

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${slug}/staff-payouts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-payouts', slug] })
      toast('Ödeme kaydı silindi')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function openEdit(p: StaffPayout) {
    setEditingPayout(p)
    setEditBonus(String(p.bonus))
    setEditDeductions(String(p.deductions))
    setEditNotes(p.notes ?? '')
  }

  const editMutation = useMutation({
    mutationFn: () => {
      if (!editingPayout) throw new Error('Kayıt yok')
      return apiFetch(`/api/v1/tenants/${slug}/staff-payouts/${editingPayout.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          bonus: Number(editBonus) || 0,
          deductions: Number(editDeductions) || 0,
          notes: editNotes || null,
        }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-payouts', slug] })
      toast('Ödeme güncellendi')
      setEditingPayout(null)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const editGross = editingPayout?.grossEarned ?? 0
  const editNet = editGross + (Number(editBonus) || 0) - (Number(editDeductions) || 0)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Personel Ödemeleri</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Yeni Ödeme
        </Button>
      </div>

      {/* Filtreler */}
      <div className="bg-white rounded-xl border border-salon-border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-salon-muted">Başlangıç</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-salon-muted">Bitiş</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-salon-muted">Personel</label>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Tümü</option>
            {(staffData?.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.fullName}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-salon-muted">Durum</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | PayoutStatus)}
            className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-salon-border p-4">
          <p className="text-xs text-salon-muted mb-1">Toplam Ödenen</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totals.paid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-salon-border p-4">
          <p className="text-xs text-salon-muted mb-1">Bekleyen</p>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(totals.pending)}</p>
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-white rounded-xl border border-salon-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-salon-border bg-salon-bg">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-salon-muted">Personel</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-salon-muted">Dönem</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Brüt</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Bonus</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Kesinti</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Net</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-salon-muted">Ödeme</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-salon-muted">Durum</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-salon-muted">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-salon-muted">Yükleniyor…</td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-salon-muted">Henüz ödeme kaydı yok.</td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="border-b border-salon-border last:border-0 hover:bg-salon-bg transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{p.staffName ?? '—'}</td>
                    <td className="px-4 py-3 text-salon-muted whitespace-nowrap">
                      {formatDate(p.periodStart)} — {formatDate(p.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(p.grossEarned)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(p.bonus)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(p.deductions)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">{formatCurrency(p.netAmount)}</td>
                    <td className="px-4 py-3 text-salon-muted whitespace-nowrap">{PAYMENT_LABELS[p.paymentMethod]}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                        p.status === 'paid' && 'bg-green-50 text-green-700 border-green-200',
                        p.status === 'pending' && 'bg-amber-50 text-amber-700 border-amber-200',
                        p.status === 'cancelled' && 'bg-gray-100 text-gray-600 border-gray-300',
                      )}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {p.status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                setMarkPaidDefault(p.paymentMethod)
                                setMarkPaidId(p.id)
                              }}
                              className="p-1.5 text-salon-muted hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Ödendi olarak işaretle"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEdit(p)}
                              className="p-1.5 text-salon-muted hover:text-primary hover:bg-primary-50 rounded transition-colors"
                              title="Düzenle"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Bu ödeme kaydını silmek istediğinize emin misiniz?')) {
                                  deleteMutation.mutate(p.id)
                                }
                              }}
                              className="p-1.5 text-salon-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {payouts.length > 0 && (
              <tfoot>
                <tr className="bg-salon-bg border-t border-salon-border">
                  <td colSpan={5} className="px-4 py-3 text-right text-xs font-medium text-salon-muted">Toplam</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {formatCurrency(payouts.reduce((sum, p) => sum + p.netAmount, 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modals */}
      <CreatePayoutModal slug={slug} open={createOpen} onOpenChange={setCreateOpen} />
      <MarkPaidModal
        slug={slug}
        payoutId={markPaidId}
        defaultPaymentMethod={markPaidDefault}
        onOpenChange={(open) => { if (!open) setMarkPaidId(null) }}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingPayout} onOpenChange={(open) => { if (!open) setEditingPayout(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ödemeyi Düzenle</DialogTitle>
          </DialogHeader>

          {editingPayout && (
            <div className="space-y-4">
              <div className="rounded-lg border border-salon-border bg-salon-bg px-3 py-2.5 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-salon-muted">Personel</span>
                  <span className="font-medium text-gray-900">{editingPayout.staffName ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-salon-muted">Brüt komisyon</span>
                  <span className="font-medium text-gray-900">{formatCurrency(editGross)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-salon-muted">Bonus (₺)</label>
                  <input
                    type="number"
                    min={0}
                    value={editBonus}
                    onChange={(e) => setEditBonus(e.target.value)}
                    className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-salon-muted">Kesinti (₺)</label>
                  <input
                    type="number"
                    min={0}
                    value={editDeductions}
                    onChange={(e) => setEditDeductions(e.target.value)}
                    className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-salon-muted">Not</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 flex justify-between items-center">
                <span className="text-sm text-salon-muted">Yeni Net</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(editNet)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-5">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">İptal</Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending}
              loading={editMutation.isPending}
            >
              Kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
