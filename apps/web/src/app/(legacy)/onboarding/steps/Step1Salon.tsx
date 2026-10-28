'use client'

import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { OnboardingInput, OnboardingActions } from '../OnboardingInput'
import { WorkingHoursPicker, DEFAULT_WORKING_HOURS, type WorkingHoursMap } from '@/components/working-hours-picker'

const BUSINESS_TYPES = [
  { value: 'barbershop',    label: 'Berber / Kuaför' },
  { value: 'beauty_center', label: 'Güzellik Merkezi / Spa' },
  { value: 'nail_studio',   label: 'Nail Art Stüdyosu' },
  { value: 'aesthetic',     label: 'Estetik & Medikal Estetik' },
  { value: 'other',         label: 'Diğer' },
] as const

const schema = z.object({
  name: z.string().min(2, 'Salon adı en az 2 karakter olmalıdır'),
  address: z.string().min(5, 'Adres giriniz'),
  phone: z.string().min(10, 'Geçerli bir telefon numarası girin'),
  businessType: z.enum(['barbershop', 'beauty_center', 'nail_studio', 'aesthetic', 'other']).optional(),
})

type FormData = z.infer<typeof schema>

interface Step1SalonProps {
  slug: string
  onNext: () => void
}

export function Step1Salon({ slug, onNext }: Step1SalonProps) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const [workingHours, setWorkingHours] = useState<WorkingHoursMap>(DEFAULT_WORKING_HOURS)

  const selectedType = watch('businessType')

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) =>
      apiFetch(`/api/v1/tenants/${slug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ ...data, workingHours }),
      }),
    onSuccess: () => onNext(),
    onError: (err) => toast(err instanceof Error ? err.message : 'Bir sorun oluştu', 'error'),
  })

  return (
    <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <OnboardingInput
          label="Salon Adı *"
          placeholder="Güzellik Salonu"
          error={errors.name?.message}
          {...register('name')}
        />
        <OnboardingInput
          label="Adres *"
          placeholder="Kadıköy, İstanbul"
          error={errors.address?.message}
          {...register('address')}
        />
        <OnboardingInput
          label="Telefon *"
          type="tel"
          placeholder="0555 123 4567"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Çalışma Saatleri *</p>
          <WorkingHoursPicker value={workingHours} onChange={setWorkingHours} variant="dark" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
          İşletme Türü <span className="normal-case text-white/30">(isteğe bağlı)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {BUSINESS_TYPES.map((bt) => (
            <label
              key={bt.value}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
              style={{
                background: selectedType === bt.value ? 'rgba(107,72,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: selectedType === bt.value ? '1px solid rgba(107,72,255,0.6)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <input
                type="radio"
                value={bt.value}
                {...register('businessType')}
                className="accent-primary"
              />
              <span className={cn('text-xs font-medium', selectedType === bt.value ? 'text-primary' : 'text-white/50')}>
                {bt.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <OnboardingActions isPending={isPending} submitLabel="İleri" />
    </form>
  )
}
