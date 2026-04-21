'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

const schema = z.object({
  name: z.string().min(2, 'Salon adı en az 2 karakter olmalıdır'),
  address: z.string().min(5, 'Adres giriniz'),
  phone: z.string().min(10, 'Geçerli bir telefon numarası girin'),
  workingHours: z.string().min(1, 'Çalışma saatlerini girin'),
})

type FormData = z.infer<typeof schema>

interface Step1SalonProps {
  slug: string
  onNext: () => void
}

export function Step1Salon({ slug, onNext }: Step1SalonProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      workingHours: 'Pzt-Cum 09:00-18:00',
    },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) =>
      apiFetch(`/api/v1/tenants/${slug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => onNext(),
    onError: (err) => toast(err instanceof Error ? err.message : 'Bir sorun oluştu', 'error'),
  })

  return (
    <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="salon-name">Salon Adı *</Label>
        <Input
          id="salon-name"
          placeholder="Güzellik Salonu"
          error={errors.name?.message}
          {...register('name')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="salon-address">Adres *</Label>
        <Input
          id="salon-address"
          placeholder="Kadıköy, İstanbul"
          error={errors.address?.message}
          {...register('address')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="salon-phone">Telefon *</Label>
        <Input
          id="salon-phone"
          type="tel"
          placeholder="0555 123 4567"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="working-hours">Çalışma Saatleri *</Label>
        <Input
          id="working-hours"
          placeholder="Pzt-Cum 09:00-18:00"
          error={errors.workingHours?.message}
          {...register('workingHours')}
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={isPending}>
          İleri
        </Button>
      </div>
    </form>
  )
}
