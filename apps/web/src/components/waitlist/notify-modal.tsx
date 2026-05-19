'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, Mail, MessageCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface WaitlistEntryLite {
  id: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  serviceName: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  entry: WaitlistEntryLite
}

function normalizePhoneForWa(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

function buildWaMessage(entry: WaitlistEntryLite): string {
  const svc = entry.serviceName ? ` (${entry.serviceName})` : ''
  return `Merhaba ${entry.customerName}, beklediğiniz randevu${svc} için uygun bir zaman dilimi açıldı. Randevunuzu oluşturmak ister misiniz?`
}

export function NotifyWaitlistModal({ open, onOpenChange, tenantSlug, entry }: Props) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/waitlist/${entry.id}/notify`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waitlist', tenantSlug] })
      toast('Bildirildi olarak işaretlendi')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const waNumber = normalizePhoneForWa(entry.customerPhone)
  const waMessage = encodeURIComponent(buildWaMessage(entry))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Müşteriyi Bilgilendir</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-salon-border p-3 bg-salon-bg">
            <p className="text-sm font-medium text-gray-900">{entry.customerName}</p>
            {entry.serviceName && (
              <p className="text-xs text-salon-muted mt-0.5">{entry.serviceName}</p>
            )}
          </div>

          <div className="space-y-2">
            <a
              href={`tel:${entry.customerPhone}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-salon-border hover:bg-salon-bg transition-colors text-sm"
            >
              <Phone className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Müşteriyi ara</div>
                <div className="text-xs text-salon-muted">{entry.customerPhone}</div>
              </div>
            </a>

            <a
              href={`https://wa.me/${waNumber}?text=${waMessage}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-salon-border hover:bg-salon-bg transition-colors text-sm"
            >
              <MessageCircle className="w-4 h-4 text-green-600" />
              <div className="flex-1">
                <div className="font-medium text-gray-900">WhatsApp ile gönder</div>
                <div className="text-xs text-salon-muted">Hazır mesaj ile aç</div>
              </div>
            </a>

            {entry.customerEmail && (
              <a
                href={`mailto:${entry.customerEmail}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-salon-border hover:bg-salon-bg transition-colors text-sm"
              >
                <Mail className="w-4 h-4 text-blue-600" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">E-posta gönder</div>
                  <div className="text-xs text-salon-muted">{entry.customerEmail}</div>
                </div>
              </a>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Kapat
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'İşleniyor...' : 'Bildirildi Olarak İşaretle'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
