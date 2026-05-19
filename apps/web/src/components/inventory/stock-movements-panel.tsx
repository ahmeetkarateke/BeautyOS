'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ArrowLeft, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { formatDate, formatTime, formatCurrency } from '@/lib/utils'
import { StockMovementModal } from './stock-movement-modal'

interface Movement {
  id: string
  inventoryId: string
  type: string
  quantity: number
  unitCost: number | null
  totalCost: number | null
  supplierId: string | null
  supplier: { id: string; name: string } | null
  appointmentId: string | null
  notes: string | null
  occurredAt: string
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  in: { label: 'Giriş', color: 'bg-green-50 text-green-700' },
  out: { label: 'Çıkış', color: 'bg-red-50 text-red-700' },
  adjustment_in: { label: 'Sayım Fazla', color: 'bg-blue-50 text-blue-700' },
  adjustment_out: { label: 'Sayım Eksik', color: 'bg-amber-50 text-amber-700' },
  waste: { label: 'Fire', color: 'bg-gray-200 text-gray-700' },
  return: { label: 'İade', color: 'bg-purple-50 text-purple-700' },
  transfer_in: { label: 'Transfer Giriş', color: 'bg-cyan-50 text-cyan-700' },
  transfer_out: { label: 'Transfer Çıkış', color: 'bg-orange-50 text-orange-700' },
}

interface Props {
  tenantSlug: string
  itemId: string
  itemName: string
  canEdit: boolean
  onBack: () => void
}

export function StockMovementsPanel({ tenantSlug, itemId, itemName, canEdit, onBack }: Props) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Movement | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: ['movements', tenantSlug, itemId],
    queryFn: () => apiFetch<{ data: Movement[] }>(
      `/api/v1/tenants/${tenantSlug}/inventory/${itemId}/movements`,
    ),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/movements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movements', tenantSlug, itemId] })
      qc.invalidateQueries({ queryKey: ['inventory', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['inventory-low-stock', tenantSlug] })
      toast('Hareket silindi')
      setDeleteTarget(undefined)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const movements = data?.data ?? []
  const latestId = movements[0]?.id

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-md hover:bg-salon-bg text-salon-muted"
            aria-label="Geri"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{itemName}</h2>
            <p className="text-xs text-salon-muted">Stok hareketleri</p>
          </div>
        </div>
        {canEdit && (
          <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" /> Yeni Hareket
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : movements.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-salon-border">
          <p className="text-salon-muted text-sm">Henüz hareket yok.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-salon-border divide-y divide-salon-border">
          {movements.map((m) => {
            const meta = TYPE_LABELS[m.type] ?? { label: m.type, color: 'bg-gray-100 text-gray-700' }
            const isLatest = m.id === latestId
            return (
              <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                <span className={`text-xs font-medium px-2 py-1 rounded ${meta.color}`}>{meta.label}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {m.quantity} adet
                    {m.totalCost !== null && (
                      <span className="text-xs text-salon-muted ml-2">{formatCurrency(m.totalCost)}</span>
                    )}
                  </p>
                  <p className="text-xs text-salon-muted mt-0.5">
                    {formatDate(m.occurredAt)} {formatTime(m.occurredAt)}
                    {m.supplier && ` • ${m.supplier.name}`}
                    {m.appointmentId && ' • Randevu'}
                  </p>
                  {m.notes && <p className="text-xs text-salon-muted mt-0.5 truncate">{m.notes}</p>}
                </div>
                {canEdit && isLatest && (
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="p-2 text-salon-muted hover:text-red-600 hover:bg-red-50 rounded-md"
                    title="Sil (son hareket)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <StockMovementModal
        open={addOpen}
        onOpenChange={setAddOpen}
        tenantSlug={tenantSlug}
        itemId={itemId}
        itemName={itemName}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(undefined) }}
        title="Hareketi Sil"
        description="Bu hareketi silmek istediğinizden emin misiniz? Stok miktarı geri alınacak."
        confirmLabel="Sil"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
