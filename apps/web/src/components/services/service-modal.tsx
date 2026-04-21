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
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface Service {
  id: string
  name: string
  category?: string
  durationMinutes: number
  price: number
  isActive: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  service?: Service
}

const schema = z.object({
  name: z.string().min(2, 'En az 2 karakter'),
  category: z.string().optional(),
  durationMinutes: z.coerce.number().int().min(5, 'En az 5 dakika'),
  price: z.coerce.number().min(0, 'Geçerli fiyat giriniz'),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function ServiceModal({ open, onOpenChange, tenantSlug, service }: Props) {
  const qc = useQueryClient()
  const isEdit = !!service

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', category: '', durationMinutes: 60, price: 0, isActive: true },
  })

  useEffect(() => {
    if (open) {
      reset(service
        ? { name: service.name, category: service.category ?? '', durationMinutes: service.durationMinutes, price: service.price, isActive: service.isActive }
        : { name: '', category: '', durationMinutes: 60, price: 0, isActive: true }
      )
    }
  }, [open, service, reset])

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit
        ? apiFetch(`/api/v1/tenants/${tenantSlug}/services/${service!.id}`, { method: 'PATCH', body: JSON.stringify(data) })
        : apiFetch(`/api/v1/tenants/${tenantSlug}/services`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services', tenantSlug] })
      toast(isEdit ? 'Hizmet güncellendi' : 'Hizmet oluşturuldu')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Hizmet Düzenle' : 'Yeni Hizmet'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="svc-name">Hizmet Adı</Label>
            <Input id="svc-name" placeholder="Protez Tırnak" error={errors.name?.message} {...register('name')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="svc-category">Kategori</Label>
            <Input id="svc-category" placeholder="Tırnak, Saç, Güzellik..." {...register('category')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="svc-duration">Süre (dk)</Label>
              <Input id="svc-duration" type="number" min={5} error={errors.durationMinutes?.message} {...register('durationMinutes')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-price">Fiyat (₺)</Label>
              <Input id="svc-price" type="number" min={0} step="0.01" error={errors.price?.message} {...register('price')} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-primary" {...register('isActive')} />
            <span className="text-sm text-gray-700">Aktif (online rezervasyona açık)</span>
          </label>
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
