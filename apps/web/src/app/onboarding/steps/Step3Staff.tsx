'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { STAFF_COLORS } from '@/lib/staff-colors'

const staffItem = z.object({
  name: z.string().min(2, 'Ad soyad giriniz'),
  email: z.string().email('Geçerli e-posta girin'),
  password: z.string().min(6, 'Şifre en az 6 karakter'),
  title: z.string().min(2, 'Unvan giriniz'),
  color: z.string(),
})

const schema = z.object({
  staff: z.array(staffItem).min(1).max(3),
})

type FormData = z.infer<typeof schema>

interface Step3StaffProps {
  slug: string
  onNext: () => void
  onBack: () => void
}

export function Step3Staff({ slug, onNext, onBack }: Step3StaffProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      staff: [{ name: '', email: '', password: '', title: '', color: STAFF_COLORS[0] }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'staff' })
  const watchedStaff = watch('staff')

  async function onSubmit(data: FormData) {
    try {
      await Promise.all(
        data.staff.map((member) =>
          apiFetch(`/api/v1/tenants/${slug}/staff`, {
            method: 'POST',
            body: JSON.stringify(member),
          }),
        ),
      )
      onNext()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir sorun oluştu', 'error')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {fields.map((field, index) => (
        <div key={field.id} className="rounded-lg border border-salon-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-salon-muted">Personel {index + 1}</span>
            {fields.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-salon-muted hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ad Soyad *</Label>
              <Input
                placeholder="Ayşe Kaya"
                error={errors.staff?.[index]?.name?.message}
                {...register(`staff.${index}.name`)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unvan *</Label>
              <Input
                placeholder="Kuaför"
                error={errors.staff?.[index]?.title?.message}
                {...register(`staff.${index}.title`)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>E-posta *</Label>
            <Input
              type="email"
              placeholder="ayse@salon.com"
              error={errors.staff?.[index]?.email?.message}
              {...register(`staff.${index}.email`)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Şifre *</Label>
            <Input
              type="password"
              placeholder="••••••••"
              error={errors.staff?.[index]?.password?.message}
              {...register(`staff.${index}.password`)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Renk</Label>
            <div className="flex gap-2 flex-wrap">
              {STAFF_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue(`staff.${index}.color`, color)}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: color,
                    outline: watchedStaff[index]?.color === color ? `3px solid ${color}` : '3px solid transparent',
                    outlineOffset: '2px',
                  }}
                  aria-label={`Renk: ${color}`}
                />
              ))}
            </div>
          </div>
        </div>
      ))}

      {fields.length < 3 && (
        <button
          type="button"
          onClick={() =>
            append({
              name: '',
              email: '',
              password: '',
              title: '',
              color: STAFF_COLORS[fields.length % STAFF_COLORS.length],
            })
          }
          className="flex items-center gap-2 text-sm text-primary hover:text-primary-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Başka ekle
        </button>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Geri
        </Button>
        <Button type="submit" loading={isSubmitting}>
          İleri
        </Button>
      </div>
    </form>
  )
}
