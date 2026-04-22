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
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { useAuthStore } from '@/store/auth'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  defaultStart?: Date
  defaultEnd?: Date
}

const schema = z.object({
  customerId: z.string().min(1, 'Müşteri seçiniz'),
  serviceId: z.string().min(1, 'Hizmet seçiniz'),
  staffId: z.string().min(1, 'Personel seçiniz'),
  startAt: z.string().min(1, 'Başlangıç tarihi giriniz'),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Customer { id: string; fullName: string; phone: string }
interface Service { id: string; name: string; durationMinutes: number }
interface Staff {
  id: string
  title: string
  fullName: string
  email?: string | null
  skills: { serviceId: string; serviceName: string }[]
}

export function NewAppointmentModal({ open, onOpenChange, tenantSlug, defaultStart, defaultEnd }: Props) {
  const qc = useQueryClient()

  const { data: customers } = useQuery({
    queryKey: ['customers', tenantSlug],
    queryFn: () => apiFetch<{ data: Customer[] }>(`/api/v1/tenants/${tenantSlug}/customers`),
    enabled: open,
  })

  const { data: services } = useQuery({
    queryKey: ['services', tenantSlug],
    queryFn: () => apiFetch<{ data: Service[] }>(`/api/v1/tenants/${tenantSlug}/services`),
    enabled: open,
  })

  const { data: staff } = useQuery({
    queryKey: ['staff', tenantSlug],
    queryFn: () => apiFetch<{ data: Staff[] }>(`/api/v1/tenants/${tenantSlug}/staff`),
    enabled: open,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (open) {
      reset({
        startAt: defaultStart
          ? new Date(defaultStart.getTime() - defaultStart.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16)
          : '',
        customerId: '',
        serviceId: '',
        staffId: '',
        notes: '',
      })
    }
  }, [open, defaultStart])

  const currentUser = useAuthStore((s) => s.user)
  const isStaff = currentUser?.role === 'staff'

  const selectedServiceId = watch('serviceId')
  const allStaff = staff?.data ?? []
  const selfStaff = isStaff
    ? allStaff.filter((s) => s.email === currentUser?.email)
    : allStaff
  const filteredStaff = selectedServiceId
    ? selfStaff.filter((s) => s.skills.some((sk) => sk.serviceId === selectedServiceId))
    : selfStaff

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/appointments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments-calendar', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['appointments', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['dashboard', tenantSlug] })
      toast('Randevu oluşturuldu')
      reset()
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Randevu</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customerId">Müşteri</Label>
            <Select id="customerId" error={errors.customerId?.message} {...register('customerId')}>
              <option value="">Müşteri seçin...</option>
              {customers?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} — {c.phone}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceId">Hizmet</Label>
            <Select
              id="serviceId"
              error={errors.serviceId?.message}
              {...register('serviceId')}
              onChange={(e) => {
                register('serviceId').onChange(e)
                setValue('staffId', '')
              }}
            >
              <option value="">Hizmet seçin...</option>
              {services?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMinutes} dk)
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="staffId">Personel</Label>
            <Select id="staffId" error={errors.staffId?.message} {...register('staffId')}>
              {filteredStaff.length === 0 && selectedServiceId ? (
                <option value="" disabled>Bu hizmet için uygun personel yok</option>
              ) : (
                <>
                  <option value="">Personel seçin...</option>
                  {filteredStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} — {s.title}
                    </option>
                  ))}
                </>
              )}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startAt">Tarih & Saat</Label>
            <Input
              id="startAt"
              type="datetime-local"
              min={new Date(new Date().setHours(0, 0, 0, 0)).toISOString().slice(0, 16)}
              error={errors.startAt?.message}
              {...register('startAt', {
                validate: (v) => {
                  const selected = new Date(v)
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  return selected >= today || 'Geçmiş bir güne randevu ekleyemezsiniz'
                },
              })}
            />
            {(() => {
              const val = watch('startAt')
              if (!val) return null
              const selected = new Date(val)
              const now = new Date()
              const todayStart = new Date()
              todayStart.setHours(0, 0, 0, 0)
              if (selected >= todayStart && selected < now) {
                return (
                  <p className="text-xs text-amber-600 mt-1">
                    Geçmiş saate randevu ekliyorsunuz — gelen müşteri kaydı olarak işlenecek.
                  </p>
                )
              }
              return null
            })()}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Not (isteğe bağlı)</Label>
            <Textarea id="notes" placeholder="Özel istek veya not..." {...register('notes')} />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-500">{(mutation.error as Error).message}</p>
          )}

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
              {mutation.isPending ? 'Oluşturuluyor...' : 'Randevu Oluştur'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
