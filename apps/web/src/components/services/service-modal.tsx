'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { SECTOR_DATA, DEFAULT_SECTOR } from '@/lib/sector-data'
import { Select } from '@/components/ui/select'

interface Service {
  id: string
  name: string
  category?: string
  durationMinutes: number
  price: number
  isActive: boolean
  followUpSchedule?: Array<{ day: number; label: string }> | null
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

interface FollowUpDay { day: number; label: string }

const followUpEntrySchema = z.object({
  day: z.number().int().min(1, 'En az 1').max(365, 'En fazla 365'),
  label: z.string().min(1, 'Açıklama gerekli').max(50, 'En fazla 50 karakter'),
})

const MAX_FOLLOW_UP = 10

export function ServiceModal({ open, onOpenChange, tenantSlug, service }: Props) {
  const qc = useQueryClient()
  const isEdit = !!service
  const [followUpDays, setFollowUpDays] = useState<FollowUpDay[]>([])
  const [followUpErrors, setFollowUpErrors] = useState<string[]>([])

  const { data: settingsData } = useQuery({
    queryKey: ['tenant-settings', tenantSlug],
    queryFn: () => apiFetch<{ settings?: { followUpEnabled?: boolean; businessType?: string; serviceCategories?: string[] } }>(`/api/v1/tenants/${tenantSlug}/settings`),
    enabled: open,
  })

  const followUpEnabled = settingsData?.settings?.followUpEnabled === true
  const businessType = settingsData?.settings?.businessType ?? ''
  const sector = SECTOR_DATA[businessType] ?? DEFAULT_SECTOR
  const categories = settingsData?.settings?.serviceCategories?.length
    ? settingsData.settings.serviceCategories
    : sector.categories

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
      setFollowUpDays(service?.followUpSchedule ?? [])
    }
  }, [open, service, reset])

  const activeFollowUp = followUpEnabled ? followUpDays : []

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        ...data,
        followUpSchedule: activeFollowUp.length > 0 ? activeFollowUp : null,
      }
      return isEdit
        ? apiFetch(`/api/v1/tenants/${tenantSlug}/services/${service!.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : apiFetch(`/api/v1/tenants/${tenantSlug}/services`, { method: 'POST', body: JSON.stringify(payload) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services', tenantSlug] })
      const count = activeFollowUp.length
      const label = isEdit ? 'Hizmet güncellendi' : 'Hizmet oluşturuldu'
      toast(count > 0 ? `${label} (${count} takip günü)` : label)
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
        <form
          onSubmit={handleSubmit((d) => {
            if (followUpEnabled && followUpDays.length > 0) {
              const errs = followUpDays.map((fd) => {
                const result = followUpEntrySchema.safeParse(fd)
                return result.success ? '' : result.error.issues[0].message
              })
              setFollowUpErrors(errs)
              if (errs.some(Boolean)) return
            }
            setFollowUpErrors([])
            mutation.mutate(d)
          })}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="svc-name">Hizmet Adı</Label>
            <Input id="svc-name" placeholder="Protez Tırnak" error={errors.name?.message} {...register('name')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="svc-category">Kategori</Label>
            <Select id="svc-category" {...register('category')}>
              <option value="">Seçiniz</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
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
          {followUpEnabled && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label>Takip Günleri</Label>
                <button
                  type="button"
                  disabled={followUpDays.length >= MAX_FOLLOW_UP}
                  onClick={() => setFollowUpDays((prev) => [...prev, { day: 1, label: '' }])}
                  className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                  Ekle
                </button>
              </div>
              {followUpDays.length === 0 ? (
                <p className="text-xs text-salon-muted">Henüz takip günü eklenmedi.</p>
              ) : (
                <div className="space-y-2">
                  {followUpDays.map((fd, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={365}
                          placeholder="Gün"
                          value={fd.day || ''}
                          onChange={(e) => {
                            setFollowUpDays((prev) =>
                              prev.map((item, idx) => idx === i ? { ...item, day: Number(e.target.value) } : item)
                            )
                            setFollowUpErrors((prev) => prev.map((err, idx) => idx === i ? '' : err))
                          }}
                          className="w-20 border border-salon-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <input
                          type="text"
                          placeholder="Açıklama (max 50 karakter)"
                          value={fd.label}
                          maxLength={50}
                          onChange={(e) => {
                            setFollowUpDays((prev) =>
                              prev.map((item, idx) => idx === i ? { ...item, label: e.target.value } : item)
                            )
                            setFollowUpErrors((prev) => prev.map((err, idx) => idx === i ? '' : err))
                          }}
                          className="flex-1 border border-salon-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFollowUpDays((prev) => prev.filter((_, idx) => idx !== i))
                            setFollowUpErrors((prev) => prev.filter((_, idx) => idx !== i))
                          }}
                          className="p-1.5 text-salon-muted hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {followUpErrors[i] && (
                        <p className="text-xs text-red-500 pl-1">{followUpErrors[i]}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
