'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatCurrency } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { Phone, Clock, User, Scissors, CreditCard, Pencil, Trash2, FileText } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
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

const MAX_NOTES = 500
const TERMINAL = ['completed', 'cancelled', 'no_show']

export function AppointmentDetailSheet({ open, onOpenChange, detail, tenantSlug, onChangeStatus }: Props) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isManager = user?.role === 'owner' || user?.role === 'manager'

  const [editingTime, setEditingTime] = useState(false)
  const [newStart, setNewStart] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  async function handleSaveNotes() {
    if (!detail) return
    setSavingNotes(true)
    try {
      await apiFetch(`/api/v1/tenants/${tenantSlug}/appointments/${detail.appointmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: notesValue }),
      })
      qc.invalidateQueries({ queryKey: ['appointments-calendar', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['appointments', tenantSlug] })
      toast('Not kaydedildi')
      setEditingNotes(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir sorun oluştu', 'error')
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleDelete() {
    if (!detail) return
    setDeleting(true)
    try {
      await apiFetch(`/api/v1/tenants/${tenantSlug}/appointments/${detail.appointmentId}`, {
        method: 'DELETE',
      })
      qc.invalidateQueries({ queryKey: ['appointments-calendar', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['appointments', tenantSlug] })
      toast('Randevu silindi')
      setDeleteOpen(false)
      onOpenChange(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir sorun oluştu', 'error')
    } finally {
      setDeleting(false)
    }
  }

  function openNotesEdit() {
    setNotesValue(detail?.notes ?? '')
    setEditingNotes(true)
  }

  if (!detail) return null

  const isTerminal = TERMINAL.includes(detail.status)

  return (
    <>
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
                    {!isTerminal && (
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
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-salon-muted mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value.slice(0, MAX_NOTES))}
                      rows={3}
                      placeholder="Randevu notu..."
                      className="w-full border border-salon-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-salon-muted">{notesValue.length}/{MAX_NOTES}</span>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setEditingNotes(false)}
                          className="text-xs text-salon-muted hover:text-gray-700"
                        >
                          İptal
                        </button>
                        <button
                          onClick={handleSaveNotes}
                          disabled={savingNotes}
                          className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50"
                        >
                          {savingNotes ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    {detail.notes ? (
                      <p className="text-sm text-gray-700 flex-1">{detail.notes}</p>
                    ) : (
                      <p className="text-sm text-salon-muted flex-1 italic">Not yok</p>
                    )}
                    {isManager && (
                      <button
                        onClick={openNotesEdit}
                        className="text-salon-muted hover:text-primary transition-colors flex-shrink-0"
                        title={detail.notes ? 'Notu düzenle' : 'Not ekle'}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Ref kodu */}
            {detail.referenceCode && (
              <p className="text-xs text-salon-muted">Ref: {detail.referenceCode}</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Kapat
            </Button>
            {!isTerminal && (
              <Button className="flex-1" onClick={onChangeStatus}>
                Durum Değiştir
              </Button>
            )}
            {isManager && (
              <Button
                variant="destructive"
                size="icon"
                disabled={isTerminal}
                title={isTerminal ? 'Tamamlanan randevu silinemez' : 'Randevuyu sil'}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Randevuyu Sil"
        description="Bu randevu kalıcı olarak silinecek, emin misiniz?"
        confirmLabel="Sil"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
