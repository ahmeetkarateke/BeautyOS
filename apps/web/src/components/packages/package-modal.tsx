'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

export interface ServicePackageItem {
  id: string
  name: string
  serviceId: string
  totalSessions: number
  price: number
  validityDays: number | null
  description: string | null
  isActive: boolean
  service?: { id: string; name: string; durationMinutes: number } | null
}

interface ServiceLite {
  id: string
  name: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  pkg?: ServicePackageItem
}

const schema = z.object({
  serviceId: z.string().uuid('Hizmet seçin'),
  name: z.string().trim().min(2, 'En az 2 karakter').max(100),
  totalSessions: z.coerce.number().int().min(1, 'En az 1').max(100, 'En fazla 100'),
  price: z.coerce.number().positive('Geçerli fiyat giriniz'),
  validityDays: z.union([z.literal(''), z.coerce.number().int().min(1).max(1095)]).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function PackageModal({ open, onOpenChange, tenantSlug, pkg }: Props) {
  const qc = useQueryClient()
  const isEdit = !!pkg

  const { data: servicesData } = useQuery({
    queryKey: ['services-active', tenantSlug],
    queryFn: () => apiFetch<{ data: ServiceLite[] }>(`/api/v1/tenants/${tenantSlug}/services`),
    enabled: open,
  })
  const services = servicesData?.data ?? []

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      serviceId: '',
      name: '',
      totalSessions: 6,
      price: 0,
      validityDays: '',
      description: '',
      isActive: true,
    },
  })

  useEffect(() => {
    if (open) {
      reset(pkg
        ? {
            serviceId: pkg.serviceId,
            name: pkg.name,
            totalSessions: pkg.totalSessions,
            price: pkg.price,
            validityDays: pkg.validityDays ?? '',
            description: pkg.description ?? '',
            isActive: pkg.isActive,
          }
        : { serviceId: '', name: '', totalSessions: 6, price: 0, validityDays: '', description: '', isActive: true })
    }
  }, [open, pkg, reset])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        serviceId: data.serviceId,
        name: data.name,
        totalSessions: data.totalSessions,
        price: data.price,
        validityDays: data.validityDays === '' || data.validityDays === undefined ? null : data.validityDays,
        description: data.description?.trim() ? data.description.trim() : null,
        isActive: data.isActive,
      }
      return isEdit
        ? apiFetch(`/api/v1/tenants/${tenantSlug}/packages/${pkg!.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : apiFetch(`/api/v1/tenants/${tenantSlug}/packages`, { method: 'POST', body: JSON.stringify(payload) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages', tenantSlug] })
      toast(isEdit ? 'Paket güncellendi' : 'Paket oluşturuldu')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Paket Düzenle' : 'Yeni Paket'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pkg-service">Hizmet</Label>
            <Select id="pkg-service" error={errors.serviceId?.message} {...register('serviceId')}>
              <option value="">Hizmet seçin</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pkg-name">Paket Adı</Label>
            <Input id="pkg-name" placeholder="6 Seans Cilt Bakımı" error={errors.name?.message} {...register('name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pkg-sessions">Seans Sayısı</Label>
              <Input id="pkg-sessions" type="number" min={1} max={100} error={errors.totalSessions?.message} {...register('totalSessions')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-price">Paket Fiyatı (₺)</Label>
              <Input id="pkg-price" type="number" min={0} step="0.01" error={errors.price?.message} {...register('price')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pkg-validity">Geçerlilik (gün)</Label>
            <Input
              id="pkg-validity"
              type="number"
              min={1}
              max={1095}
              placeholder="Boş bırakırsanız süresiz"
              error={errors.validityDays?.message}
              {...register('validityDays')}
            />
            <p className="text-xs text-salon-muted">1-1095 gün. Boş bırakılırsa süresiz olur.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pkg-desc">Açıklama (opsiyonel)</Label>
            <Input id="pkg-desc" placeholder="Kısa açıklama" error={errors.description?.message} {...register('description')} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-primary" {...register('isActive')} />
            <span className="text-sm text-gray-700">Aktif</span>
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
