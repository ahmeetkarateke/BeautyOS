'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

type PaymentMethod = 'cash' | 'card' | 'mixed' | 'online'

interface MarkPaidModalProps {
  slug: string
  payoutId: string | null
  defaultPaymentMethod?: PaymentMethod
  onOpenChange: (open: boolean) => void
}

export function MarkPaidModal({ slug, payoutId, defaultPaymentMethod, onOpenChange }: MarkPaidModalProps) {
  const qc = useQueryClient()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultPaymentMethod ?? 'cash')
  const [notes, setNotes] = useState<string>('')

  useEffect(() => {
    if (payoutId) {
      setPaymentMethod(defaultPaymentMethod ?? 'cash')
      setNotes('')
    }
  }, [payoutId, defaultPaymentMethod])

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tenants/${slug}/staff-payouts/${payoutId}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod,
          ...(notes ? { notes } : {}),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-payouts', slug] })
      toast('Ödeme yapıldı olarak işaretlendi')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={!!payoutId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ödendi Olarak İşaretle</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            loading={mutation.isPending}
          >
            Ödendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
