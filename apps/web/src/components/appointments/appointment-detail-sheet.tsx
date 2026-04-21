'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Phone, Clock, User, Scissors, CreditCard } from 'lucide-react'
import type { AppointmentEventProps } from './appointment-calendar'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: AppointmentEventProps | null
  onChangeStatus: () => void
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending:     { label: 'Bekliyor',     className: 'bg-yellow-100 text-yellow-700' },
  confirmed:   { label: 'Onaylı',       className: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Devam Ediyor', className: 'bg-purple-100 text-purple-700' },
  completed:   { label: 'Tamamlandı',   className: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'İptal Edildi', className: 'bg-red-100 text-red-600' },
  no_show:     { label: 'Gelmedi',      className: 'bg-gray-100 text-gray-600' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS.pending
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  )
}

export function AppointmentDetailSheet({ open, onOpenChange, detail, onChangeStatus }: Props) {
  if (!detail) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Randevu Detayı</span>
            <StatusBadge status={detail.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Müşteri */}
          <div className="flex items-start gap-3">
            <User className="w-4 h-4 text-salon-muted mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">{detail.customerName}</p>
              {detail.customerPhone && (
                <a
                  href={`tel:${detail.customerPhone}`}
                  className="text-xs text-primary flex items-center gap-1 mt-0.5"
                >
                  <Phone className="w-3 h-3" />
                  {detail.customerPhone}
                </a>
              )}
            </div>
          </div>

          {/* Hizmet + Personel */}
          <div className="flex items-start gap-3">
            <Scissors className="w-4 h-4 text-salon-muted mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">{detail.serviceName}</p>
              <p className="text-xs text-salon-muted">{detail.staffName}</p>
            </div>
          </div>

          {/* Saat */}
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-salon-muted flex-shrink-0" />
            <p className="text-sm text-gray-700">
              {new Date(detail.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {new Date(detail.endTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Ücret */}
          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-salon-muted flex-shrink-0" />
            <p className="text-sm font-medium text-gray-900">{formatCurrency(detail.priceCharged)}</p>
          </div>

          {/* Not */}
          {detail.notes && (
            <div className="rounded-lg bg-salon-bg px-3 py-2 text-xs text-salon-muted">
              {detail.notes}
            </div>
          )}

          {/* Ref kodu */}
          {detail.referenceCode && (
            <p className="text-xs text-salon-muted">Ref: {detail.referenceCode}</p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
          {!['completed', 'cancelled', 'no_show'].includes(detail.status) && (
            <Button className="flex-1" onClick={onChangeStatus}>
              Durum Değiştir
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
