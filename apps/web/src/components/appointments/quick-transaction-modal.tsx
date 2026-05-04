'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { SlotSelect } from '@/components/appointments/slot-select'
import { InlineCustomerCreate } from '@/components/appointments/inline-customer-create'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
}

const schema = z.object({
  customerId: z.string().min(1, 'Müşteri seçiniz'),
  serviceId: z.string().min(1, 'Hizmet seçiniz'),
  staffId: z.string().min(1, 'Personel seçiniz'),
  priceCharged: z.number({ invalid_type_error: 'Geçerli bir fiyat giriniz' }).min(0),
  paymentMethod: z.enum(['cash', 'card']),
})

type FormValues = z.infer<typeof schema>

interface Customer { id: string; fullName: string; phone: string }
interface Service { id: string; name: string; durationMinutes: number; price: number }
interface Staff {
  id: string
  title: string
  fullName: string
  email?: string | null
  skills: { serviceId: string }[]
}

export function QuickTransactionModal({ open, onOpenChange, tenantSlug }: Props) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isStaff = user?.role === 'staff'

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [slotId, setSlotId] = useState('')

  const { data: customersData } = useQuery({
    queryKey: ['customers', tenantSlug],
    queryFn: () => apiFetch<{ data: Customer[] }>(`/api/v1/tenants/${tenantSlug}/customers`),
    enabled: open,
  })

  const { data: servicesData } = useQuery({
    queryKey: ['services', tenantSlug],
    queryFn: () => apiFetch<{ data: Service[] }>(`/api/v1/tenants/${tenantSlug}/services`),
    enabled: open,
  })

  const { data: staffData } = useQuery({
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
    defaultValues: {
      customerId: '',
      serviceId: '',
      staffId: '',
      priceCharged: 0,
      paymentMethod: 'cash',
    },
  })

  const allStaff = staffData?.data ?? []
  const myProfile = isStaff ? allStaff.find((s) => s.email === user?.email) : undefined

  useEffect(() => {
    if (open) {
      reset({ customerId: '', serviceId: '', staffId: '', priceCharged: 0, paymentMethod: 'cash' })
      setDate(new Date().toISOString().slice(0, 10))
      setSlotId('')
    }
  }, [open, reset])

  useEffect(() => {
    if (open && isStaff && myProfile) {
      setValue('staffId', myProfile.id)
    }
  }, [open, isStaff, myProfile, setValue])

  const selectedServiceId = watch('serviceId')
  const selectedStaffId = watch('staffId')
  const paymentMethod = watch('paymentMethod')

  useEffect(() => {
    if (!selectedServiceId || !servicesData?.data) return
    const svc = servicesData.data.find((s) => s.id === selectedServiceId)
    if (svc) setValue('priceCharged', svc.price)
  }, [selectedServiceId, servicesData, setValue])

  // Clear slot when service, staff, or date changes
  useEffect(() => {
    setSlotId('')
  }, [selectedServiceId, selectedStaffId, date])

  const allServices = servicesData?.data ?? []
  const visibleServices = isStaff && myProfile
    ? allServices.filter((s) => myProfile.skills.some((sk) => sk.serviceId === s.id))
    : allServices

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const apt = await apiFetch<{ id: string }>(`/api/v1/tenants/${tenantSlug}/appointments`, {
        method: 'POST',
        body: JSON.stringify({
          customerId: values.customerId,
          serviceId: values.serviceId,
          staffId: values.staffId,
          startAt: slotId || new Date().toISOString(),
        }),
      })

      try {
        await apiFetch(`/api/v1/tenants/${tenantSlug}/appointments/${apt.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'completed',
            priceCharged: values.priceCharged,
            paymentMethod: values.paymentMethod,
          }),
        })
      } catch {
        throw new Error('İşlem kaydedilemedi, lütfen tekrar deneyin')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['appointments-calendar', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['finance', tenantSlug] })
      toast('İşlem kaydedildi')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hızlı İşlem</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {/* Customer */}
          <div className="space-y-2">
            <Label htmlFor="qt-customerId">Müşteri</Label>
            <Select id="qt-customerId" error={errors.customerId?.message} {...register('customerId')}>
              <option value="">Müşteri seçin...</option>
              {customersData?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} — {c.phone}
                </option>
              ))}
            </Select>
            <InlineCustomerCreate
              tenantSlug={tenantSlug}
              onCreated={(id) => setValue('customerId', id, { shouldValidate: true })}
            />
          </div>

          {/* Service */}
          <div className="space-y-2">
            <Label htmlFor="qt-serviceId">Hizmet</Label>
            <Select id="qt-serviceId" error={errors.serviceId?.message} {...register('serviceId')}>
              <option value="">Hizmet seçin...</option>
              {visibleServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMinutes} dk)
                </option>
              ))}
            </Select>
          </div>

          {/* Staff */}
          {!isStaff && (
            <div className="space-y-2">
              <Label htmlFor="qt-staffId">Personel</Label>
              <Select id="qt-staffId" error={errors.staffId?.message} {...register('staffId')}>
                <option value="">Personel seçin...</option>
                {allStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} — {s.title}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="qt-date">Tarih</Label>
            <Input
              id="qt-date"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Slot */}
          <div className="space-y-2">
            <Label>Saat (isteğe bağlı)</Label>
            <SlotSelect
              tenantSlug={tenantSlug}
              serviceId={selectedServiceId}
              staffId={selectedStaffId}
              date={date}
              value={slotId}
              onChange={setSlotId}
            />
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="qt-price">Fiyat (₺)</Label>
            <input
              id="qt-price"
              type="number"
              min={0}
              step="0.01"
              {...register('priceCharged', { valueAsNumber: true })}
              className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {errors.priceCharged && (
              <p className="text-xs text-red-500 mt-1">{errors.priceCharged.message}</p>
            )}
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label>Ödeme Yöntemi</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'card'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setValue('paymentMethod', m)}
                  className={cn(
                    'py-2 rounded-lg text-sm font-medium border transition-colors',
                    paymentMethod === m
                      ? 'bg-primary text-white border-primary'
                      : 'border-salon-border text-salon-muted hover:border-primary',
                  )}
                >
                  {m === 'cash' ? '💵 Nakit' : '💳 Kart'}
                </button>
              ))}
            </div>
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
              {mutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
