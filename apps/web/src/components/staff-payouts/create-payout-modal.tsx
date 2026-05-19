'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { formatCurrency } from '@/lib/utils'

type PaymentMethod = 'cash' | 'card' | 'mixed' | 'online'

interface StaffMember {
  id: string
  fullName: string
}

interface CalculateResult {
  staffId: string
  staffName: string
  periodStart: string
  periodEnd: string
  grossEarned: number
  transactionCount: number
}

interface CreatePayoutModalProps {
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultStaffId?: string
}

function getDefaultPeriod(): { start: string; end: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  return { start: fmt(first), end: fmt(now) }
}

export function CreatePayoutModal({ slug, open, onOpenChange, defaultStaffId }: CreatePayoutModalProps) {
  const qc = useQueryClient()
  const defaults = useMemo(getDefaultPeriod, [])

  const [staffId, setStaffId] = useState<string>(defaultStaffId ?? '')
  const [periodStart, setPeriodStart] = useState<string>(defaults.start)
  const [periodEnd, setPeriodEnd] = useState<string>(defaults.end)
  const [bonus, setBonus] = useState<string>('0')
  const [deductions, setDeductions] = useState<string>('0')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState<string>('')
  const [preview, setPreview] = useState<CalculateResult | null>(null)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    if (open) {
      setStaffId(defaultStaffId ?? '')
      setPeriodStart(defaults.start)
      setPeriodEnd(defaults.end)
      setBonus('0')
      setDeductions('0')
      setPaymentMethod('cash')
      setNotes('')
      setPreview(null)
    }
  }, [open, defaultStaffId, defaults.start, defaults.end])

  const { data: staffData } = useQuery({
    queryKey: ['staff', slug],
    queryFn: () => apiFetch<{ data: StaffMember[] }>(`/api/v1/tenants/${slug}/staff`),
    enabled: open,
  })

  const staffList = staffData?.data ?? []

  async function handlePreview() {
    if (!staffId || !periodStart || !periodEnd) {
      toast('Personel ve dönem seçilmeli', 'error')
      return
    }
    if (periodStart > periodEnd) {
      toast('Başlangıç tarihi bitiş tarihinden büyük olamaz', 'error')
      return
    }
    setPreviewing(true)
    try {
      const res = await apiFetch<CalculateResult>(
        `/api/v1/tenants/${slug}/staff-payouts/calculate?staffId=${staffId}&from=${periodStart}&to=${periodEnd}`,
      )
      setPreview(res)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hesaplama başarısız', 'error')
    } finally {
      setPreviewing(false)
    }
  }

  const grossEarned = preview?.grossEarned ?? 0
  const bonusNum = Number(bonus) || 0
  const deductionsNum = Number(deductions) || 0
  const netAmount = grossEarned + bonusNum - deductionsNum

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tenants/${slug}/staff-payouts`, {
        method: 'POST',
        body: JSON.stringify({
          staffId,
          periodStart,
          periodEnd,
          bonus: bonusNum,
          deductions: deductionsNum,
          paymentMethod,
          ...(notes ? { notes } : {}),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-payouts', slug] })
      toast('Ödeme kaydı oluşturuldu')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const canSave = !!staffId && !!periodStart && !!periodEnd && periodStart <= periodEnd

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Yeni Personel Ödemesi</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-salon-muted">Personel</label>
            <select
              value={staffId}
              onChange={(e) => { setStaffId(e.target.value); setPreview(null) }}
              className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Personel seçin...</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-salon-muted">Başlangıç</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => { setPeriodStart(e.target.value); setPreview(null) }}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-salon-muted">Bitiş</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => { setPeriodEnd(e.target.value); setPreview(null) }}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={!staffId || previewing}
          >
            {previewing ? 'Hesaplanıyor…' : 'Komisyonu Hesapla'}
          </Button>

          {preview && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-salon-muted">Hak edilen komisyon</span>
                <span className="font-semibold text-primary">{formatCurrency(preview.grossEarned)}</span>
              </div>
              <div className="flex justify-between text-xs text-salon-muted">
                <span>İşlem sayısı</span>
                <span>{preview.transactionCount}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-salon-muted">Bonus (₺)</label>
              <input
                type="number"
                min={0}
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-salon-muted">Kesinti (₺)</label>
              <input
                type="number"
                min={0}
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="rounded-lg border border-salon-border bg-salon-bg px-3 py-2.5 flex justify-between items-center">
            <span className="text-sm text-salon-muted">Hesaplanan Net</span>
            <span className="text-lg font-bold text-gray-900">{formatCurrency(netAmount)}</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-salon-muted">Ödeme Yöntemi</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="cash">Nakit</option>
              <option value="card">Kart</option>
              <option value="mixed">Karışık</option>
              <option value="online">Online</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-salon-muted">Not (opsiyonel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <DialogClose asChild>
            <Button variant="ghost" size="sm">İptal</Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!canSave || createMutation.isPending}
            loading={createMutation.isPending}
          >
            Kaydet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
