'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
}

const schema = z.object({
  source: z.enum(['cash', 'card', 'salon_pool']),
  staffId: z.string().optional(),
  appointmentId: z.string().optional(),
  amount: z.coerce.number().positive('Tutar 0\'dan büyük olmalı'),
  notes: z.string().max(500).optional(),
})

type FormValues = z.input<typeof schema>

interface StaffItem {
  id: string
  fullName: string
}

interface StaffApiItem {
  id: string
  fullName?: string
  user?: { fullName: string }
}

interface AppointmentItem {
  id: string
  customerName: string
  serviceName: string
  startTime: string
}

interface AppointmentsResponse {
  data: AppointmentItem[]
}

interface StaffResponse {
  data: StaffApiItem[]
}

export function AddTipModal({ open, onOpenChange, tenantSlug }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { source: 'cash' },
  })

  const source = watch('source')

  const { data: staffData } = useQuery<StaffResponse>({
    queryKey: ['staff', tenantSlug],
    queryFn: () => apiFetch<StaffResponse>(`/api/v1/tenants/${tenantSlug}/staff`),
    enabled: open,
  })

  const staff: StaffItem[] = (staffData?.data ?? []).map((s) => ({
    id: s.id,
    fullName: s.user?.fullName ?? s.fullName ?? 'Personel',
  }))

  const { data: apptData } = useQuery<AppointmentsResponse>({
    queryKey: ['tip-appointments', tenantSlug, search],
    queryFn: () => {
      const qs = new URLSearchParams()
      qs.set('limit', '20')
      if (search.length >= 2) qs.set('search', search)
      return apiFetch<AppointmentsResponse>(`/api/v1/tenants/${tenantSlug}/appointments?${qs.toString()}`)
    },
    enabled: open && search.length === 0 || search.length >= 2,
  })

  const appointments = apptData?.data ?? []

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload: Record<string, unknown> = {
        source: data.source,
        amount: Number(data.amount),
      }
      if (data.staffId) payload.staffId = data.staffId
      if (data.appointmentId) payload.appointmentId = data.appointmentId
      if (data.notes) payload.notes = data.notes

      return apiFetch(`/api/v1/tenants/${tenantSlug}/tips`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tips', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['tips-summary', tenantSlug] })
      toast('Bahşiş eklendi')
      reset({ source: 'cash' })
      setSearch('')
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  const onSubmit = (data: FormValues) => {
    if (data.source !== 'salon_pool' && !data.staffId && !data.appointmentId) {
      toast('Personel veya randevu seçin (ya da Havuz kaynağı kullanın).', 'error')
      return
    }
    mutation.mutate(data)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Bahşiş</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source">Kaynak</Label>
            <Select id="source" {...register('source')}>
              <option value="cash">Nakit</option>
              <option value="card">Kart</option>
              <option value="salon_pool">Havuza (Salon)</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Tutar (TL)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="100"
              error={errors.amount?.message}
              {...register('amount')}
            />
          </div>

          {source !== 'salon_pool' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="staffId">Personel (isteğe bağlı)</Label>
                <Select id="staffId" {...register('staffId')}>
                  <option value="">— Personel seç —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="appointmentSearch">Randevu (isteğe bağlı)</Label>
                <Input
                  id="appointmentSearch"
                  placeholder="Müşteri adı ara…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select id="appointmentId" {...register('appointmentId')}>
                  <option value="">— Randevu seç —</option>
                  {appointments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.customerName} — {a.serviceName} ({new Date(a.startTime).toLocaleDateString('tr-TR')})
                    </option>
                  ))}
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Not (isteğe bağlı)</Label>
            <Textarea id="notes" rows={2} {...register('notes')} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Ekleniyor...' : 'Bahşiş Ekle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
