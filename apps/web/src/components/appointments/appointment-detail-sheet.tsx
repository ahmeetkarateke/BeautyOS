'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { Phone, Clock, User, Scissors, CreditCard, Pencil } from 'lucide-react'
import type { AppointmentEventProps } from './appointment-calendar'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: AppointmentEventProps | null
  tenantSlug: string
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

function toDatetimeLocal(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AppointmentDetailSheet({ open, onOpenChange, detail, tenantSlug, onChangeStatus }: Props) {
  const qc = useQueryClient()
  const [editingTime, setEditingTime] = useState(false)
  const [newStart, setNewStart] = useState('')
  const [saving, setSaving] = useState(false)

  const TERMINAL = ['completed', 'cancelled', 'no_show']

  async function handleReschedule() {
    if (!detail || !newStart) return
    setSaving(true)
    try {
      await apiFetch(`/api/v1/tenants/${tenantSlug}/appointments/${detail.appointmentId}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ startAt: new Date(newStart).toISOString() }),
      })
      qc.invalidateQueries({ queryKey: ['appointments-calendar', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['appointments', tenantSlug] })
      toast('Randevu saati güncellendi')
      setEditingTime(false)
      onOpenChange(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir sorun oluştu', 'error')
    } finally {
      setSaving(false)
    }
  }

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
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-salon-muted flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              {editingTime ? (
                <div className="space-y-2">
                  <input
                    type="datetime-local"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full border border-salon-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingTime(false)}
                      className="text-xs text-salon-muted hover:text-gray-700"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleReschedule}
                      disabled={saving}
                      className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50"
                    >
                      {saving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-700">
                    {new Date(detail.startTime).toLocaleString('tr-TR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                    {' – '}
                    {new Date(detail.endTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {!TERMINAL.includes(detail.status) && (
                    <button
                      onClick={() => { setNewStart(toDatetimeLocal(detail.startTime)); setEditingTime(true) }}
                      className="text-salon-muted hover:text-primary transition-colors"
                      title="Saati değiştir"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
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
