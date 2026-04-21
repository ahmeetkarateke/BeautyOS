'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  appointmentId: string
  currentStatus: string
  appointmentTitle: string
}

type Status = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

const statusOptions: { value: Status; label: string; className: string }[] = [
  { value: 'pending',     label: 'Bekliyor',       className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'confirmed',   label: 'Onaylandı',      className: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'in_progress', label: 'Devam Ediyor',   className: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'completed',   label: 'Tamamlandı',     className: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'cancelled',   label: 'İptal Edildi',   className: 'bg-red-100 text-red-600 border-red-200' },
  { value: 'no_show',     label: 'Gelmedi',        className: 'bg-gray-100 text-gray-600 border-gray-200' },
]

export function AppointmentStatusModal({
  open,
  onOpenChange,
  tenantSlug,
  appointmentId,
  currentStatus,
  appointmentTitle,
}: Props) {
  const [selected, setSelected] = useState<Status>(currentStatus as Status)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (status: Status) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments-calendar', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['appointments-today', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['dashboard', tenantSlug] })
      toast('Randevu durumu güncellendi')
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Durum Güncelle</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-salon-muted mb-4 truncate">{appointmentTitle}</p>

        <div className="grid grid-cols-2 gap-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={cn(
                'flex items-center justify-center px-3 py-2.5 rounded-md border text-sm font-medium transition-all',
                selected === opt.value
                  ? cn(opt.className, 'ring-2 ring-offset-1 ring-current')
                  : 'bg-white border-salon-border text-salon-muted hover:bg-salon-bg',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            className="flex-1"
            disabled={mutation.isPending || selected === currentStatus}
            onClick={() => mutation.mutate(selected)}
          >
            {mutation.isPending ? 'Güncelleniyor...' : 'Kaydet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
