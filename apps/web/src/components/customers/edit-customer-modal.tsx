'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface Customer {
  id: string
  fullName: string
  phone: string
  email?: string | null
  birthDate?: string | null
  allergyNotes?: string | null
  preferenceNotes?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  customer: Customer
}

const schema = z.object({
  fullName: z.string().min(2, 'En az 2 karakter'),
  phone: z.string().min(7, 'Geçerli telefon giriniz'),
  email: z.string().email('Geçerli e-posta').optional().or(z.literal('')),
  birthDate: z.string().optional(),
  allergyNotes: z.string().optional(),
  preferenceNotes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function EditCustomerModal({ open, onOpenChange, tenantSlug, customer }: Props) {
  const qc = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (open) {
      reset({
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email ?? '',
        birthDate: customer.birthDate ? customer.birthDate.split('T')[0] : '',
        allergyNotes: customer.allergyNotes ?? '',
        preferenceNotes: customer.preferenceNotes ?? '',
      })
    }
  }, [open, customer, reset])

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/customers/${customer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: data.fullName,
          phone: data.phone,
          email: data.email || undefined,
          birthDate: data.birthDate || undefined,
          allergyNotes: data.allergyNotes || undefined,
          preferenceNotes: data.preferenceNotes || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', tenantSlug, customer.id] })
      qc.invalidateQueries({ queryKey: ['customers', tenantSlug] })
      toast('Müşteri bilgileri güncellendi')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Müşteri Düzenle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Ad Soyad</Label>
            <Input placeholder="Ayşe Yılmaz" error={errors.fullName?.message} {...register('fullName')} />
          </div>
          <div className="space-y-2">
            <Label>Telefon</Label>
            <Input type="tel" error={errors.phone?.message} {...register('phone')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input type="email" error={errors.email?.message} {...register('email')} />
            </div>
            <div className="space-y-2">
              <Label>Doğum Tarihi</Label>
              <Input type="date" {...register('birthDate')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Alerji Notları</Label>
            <Textarea placeholder="Lateks alerjisi..." {...register('allergyNotes')} />
          </div>
          <div className="space-y-2">
            <Label>Tercih Notları</Label>
            <Textarea placeholder="Kısa süre kalmak istiyor..." {...register('preferenceNotes')} />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
