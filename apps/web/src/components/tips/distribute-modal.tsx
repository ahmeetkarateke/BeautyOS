'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { formatCurrency } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  poolAmount: number
}

type Mode = 'amount' | 'weight'

interface StaffApiItem {
  id: string
  fullName?: string
  user?: { fullName: string }
}

interface StaffResponse {
  data: StaffApiItem[]
}

interface Allocation {
  selected: boolean
  amount: string
  weight: string
}

export function DistributeModal({ open, onOpenChange, tenantSlug, poolAmount }: Props) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>('amount')
  const [allocations, setAllocations] = useState<Record<string, Allocation>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: staffData } = useQuery<StaffResponse>({
    queryKey: ['staff', tenantSlug],
    queryFn: () => apiFetch<StaffResponse>(`/api/v1/tenants/${tenantSlug}/staff`),
    enabled: open,
  })

  const staff = useMemo(
    () => (staffData?.data ?? []).map((s) => ({
      id: s.id,
      fullName: s.user?.fullName ?? s.fullName ?? 'Personel',
    })),
    [staffData],
  )

  useEffect(() => {
    if (!open) return
    setAllocations((prev) => {
      const next: Record<string, Allocation> = {}
      for (const s of staff) {
        next[s.id] = prev[s.id] ?? { selected: false, amount: '', weight: '1' }
      }
      return next
    })
  }, [open, staff])

  const allocSum = useMemo(() => {
    return Object.entries(allocations)
      .filter(([, a]) => a.selected)
      .reduce((sum, [, a]) => sum + (Number(a.amount) || 0), 0)
  }, [allocations])

  const weightSum = useMemo(() => {
    return Object.entries(allocations)
      .filter(([, a]) => a.selected)
      .reduce((sum, [, a]) => sum + (Number(a.weight) || 0), 0)
  }, [allocations])

  const selectedIds = Object.entries(allocations).filter(([, a]) => a.selected).map(([id]) => id)

  const splitEqual = () => {
    if (selectedIds.length === 0) {
      toast('En az bir personel seçin.', 'error')
      return
    }
    const perStaff = Math.round((poolAmount / selectedIds.length) * 100) / 100
    setAllocations((prev) => {
      const next = { ...prev }
      let allocated = 0
      selectedIds.forEach((id, idx) => {
        const amt = idx === selectedIds.length - 1
          ? Math.round((poolAmount - allocated) * 100) / 100
          : perStaff
        allocated += perStaff
        next[id] = { ...next[id], amount: amt.toFixed(2), weight: '1' }
      })
      return next
    })
  }

  const mutation = useMutation({
    mutationFn: () => {
      const distributions = selectedIds.map((id) => {
        const a = allocations[id]
        return mode === 'amount'
          ? { staffId: id, amount: Number(a.amount) }
          : { staffId: id, shareWeight: Number(a.weight) }
      })
      return apiFetch(`/api/v1/tenants/${tenantSlug}/tips/distribute`, {
        method: 'POST',
        body: JSON.stringify({ distributions }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tips', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['tips-summary', tenantSlug] })
      toast('Havuz dağıtıldı')
      setConfirmOpen(false)
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
      setConfirmOpen(false)
    },
  })

  const handleConfirm = () => {
    if (selectedIds.length === 0) {
      toast('En az bir personel seçin.', 'error')
      return
    }
    if (mode === 'amount') {
      if (Math.abs(allocSum - poolAmount) > 0.01) {
        toast(`Toplam ${formatCurrency(allocSum)} havuz toplamına (${formatCurrency(poolAmount)}) eşit olmalı.`, 'error')
        return
      }
    } else {
      if (weightSum <= 0) {
        toast('Toplam ağırlık 0\'dan büyük olmalı.', 'error')
        return
      }
    }
    setConfirmOpen(true)
  }

  const diff = allocSum - poolAmount

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Havuzu Dağıt</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-primary-50 p-4 flex items-center justify-between">
              <span className="text-sm text-salon-muted">Havuzdaki Tutar</span>
              <span className="text-xl font-semibold text-primary">{formatCurrency(poolAmount)}</span>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === 'amount' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('amount')}
              >
                Tutar Gir
              </Button>
              <Button
                type="button"
                variant={mode === 'weight' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('weight')}
              >
                Ağırlık (Oran)
              </Button>
              {mode === 'amount' && (
                <Button type="button" variant="outline" size="sm" onClick={splitEqual} className="ml-auto">
                  Eşit Dağıt
                </Button>
              )}
            </div>

            <div className="border border-salon-border rounded-lg divide-y divide-salon-border max-h-80 overflow-y-auto">
              {staff.length === 0 && (
                <p className="p-4 text-sm text-salon-muted">Personel bulunamadı.</p>
              )}
              {staff.map((s) => {
                const a = allocations[s.id] ?? { selected: false, amount: '', weight: '1' }
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3">
                    <input
                      type="checkbox"
                      checked={a.selected}
                      onChange={(e) =>
                        setAllocations((prev) => ({
                          ...prev,
                          [s.id]: { ...a, selected: e.target.checked },
                        }))
                      }
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="flex-1 text-sm font-medium">{s.fullName}</span>
                    {mode === 'amount' ? (
                      <div className="w-32">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          disabled={!a.selected}
                          value={a.amount}
                          onChange={(e) =>
                            setAllocations((prev) => ({
                              ...prev,
                              [s.id]: { ...a, amount: e.target.value },
                            }))
                          }
                        />
                      </div>
                    ) : (
                      <div className="w-24">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="1.0"
                          disabled={!a.selected}
                          value={a.weight}
                          onChange={(e) =>
                            setAllocations((prev) => ({
                              ...prev,
                              [s.id]: { ...a, weight: e.target.value },
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {mode === 'amount' ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-salon-muted">Toplam Dağıtılan</span>
                <span className={Math.abs(diff) > 0.01 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                  {formatCurrency(allocSum)} / {formatCurrency(poolAmount)}
                  {Math.abs(diff) > 0.01 && ` (Fark: ${formatCurrency(diff)})`}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm">
                <span className="text-salon-muted">Toplam Ağırlık</span>
                <span className="font-semibold">{weightSum.toFixed(2)}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                İptal
              </Button>
              <Button type="button" className="flex-1" onClick={handleConfirm}>
                Dağıt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Dağıtımı onayla"
        description={`${formatCurrency(poolAmount)} havuzu ${selectedIds.length} personele dağıtılacak. Onaylıyor musunuz?`}
        confirmLabel="Dağıt"
        variant="default"
        onConfirm={() => mutation.mutate()}
        loading={mutation.isPending}
      />
    </>
  )
}
