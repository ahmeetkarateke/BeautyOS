'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

export interface Supplier {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  isActive: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  supplier?: Supplier
}

const schema = z.object({
  name: z.string().min(1, 'Tedarikçi adı gerekli').max(120),
  phone: z.string().max(40).optional(),
  email: z.union([z.literal(''), z.string().email('Geçersiz e-posta')]).optional(),
  notes: z.string().max(500).optional(),
})

type FormValues = z.infer<typeof schema>

export function SupplierModal({ open, onOpenChange, tenantSlug, supplier }: Props) {
  const qc = useQueryClient()
  const isEdit = !!supplier

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', email: '', notes: '' },
  })

  useEffect(() => {
    if (open) {
      reset(supplier
        ? { name: supplier.name, phone: supplier.phone ?? '', email: supplier.email ?? '', notes: supplier.notes ?? '' }
        : { name: '', phone: '', email: '', notes: '' }
      )
    }
  }, [open, supplier, reset])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        name: data.name,
        phone: data.phone ? data.phone : null,
        email: data.email ? data.email : null,
        notes: data.notes ? data.notes : null,
      }
      return isEdit
        ? apiFetch(`/api/v1/tenants/${tenantSlug}/suppliers/${supplier!.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : apiFetch(`/api/v1/tenants/${tenantSlug}/suppliers`, {
            method: 'POST',
            body: JSON.stringify(payload),
          })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers', tenantSlug] })
      toast(isEdit ? 'Tedarikçi güncellendi' : 'Tedarikçi oluşturuldu')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sup-name">Tedarikçi Adı</Label>
            <Input id="sup-name" placeholder="Kozmetik A.Ş." error={errors.name?.message} {...register('name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sup-phone">Telefon</Label>
              <Input id="sup-phone" placeholder="0212 ..." {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-email">E-posta</Label>
              <Input id="sup-email" type="email" placeholder="info@..." error={errors.email?.message} {...register('email')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sup-notes">Notlar</Label>
            <Textarea id="sup-notes" placeholder="Opsiyonel" {...register('notes')} />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
