'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { STAFF_COLORS } from '@/lib/staff-colors'
import { OnboardingInput, OnboardingActions } from '../OnboardingInput'

const staffItem = z.object({
  name: z.string().min(2, 'Ad soyad giriniz'),
  email: z.string().email('Geçerli e-posta girin'),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
  title: z.string().min(2, 'Unvan giriniz'),
  color: z.string(),
})

const schema = z.object({ staff: z.array(staffItem).min(1).max(3) })
type FormData = z.infer<typeof schema>

interface Step3StaffProps {
  slug: string
  onNext: () => void
  onBack: () => void
}

export function Step3Staff({ slug, onNext, onBack }: Step3StaffProps) {
  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { staff: [{ name: '', email: '', password: '', title: '', color: STAFF_COLORS[0] }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'staff' })
  const watchedStaff = watch('staff')

  async function onSubmit(data: FormData) {
    try {
      await Promise.all(
        data.staff.map(({ name, color, ...rest }) =>
          apiFetch(`/api/v1/tenants/${slug}/staff`, {
            method: 'POST',
            body: JSON.stringify({ ...rest, fullName: name, colorCode: STAFF_COLORS.indexOf(color) }),
          }),
        ),
      )
      onNext()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir sorun oluştu', 'error')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Personel {index + 1}</span>
            {fields.length > 1 && (
              <button type="button" onClick={() => remove(index)} className="text-white/20 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <OnboardingInput
              label="Ad Soyad *"
              placeholder="Ayşe Kaya"
              error={errors.staff?.[index]?.name?.message}
              {...register(`staff.${index}.name`)}
            />
            <OnboardingInput
              label="Unvan *"
              placeholder="Kuaför"
              error={errors.staff?.[index]?.title?.message}
              {...register(`staff.${index}.title`)}
            />
          </div>

          <OnboardingInput
            label="E-posta *"
            type="email"
            placeholder="ayse@salon.com"
            error={errors.staff?.[index]?.email?.message}
            {...register(`staff.${index}.email`)}
          />

          <OnboardingInput
            label="Şifre *"
            type="password"
            placeholder="En az 8 karakter"
            error={errors.staff?.[index]?.password?.message}
            {...register(`staff.${index}.password`)}
          />

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Renk</p>
            <div className="flex gap-2 flex-wrap">
              {STAFF_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue(`staff.${index}.color`, color)}
                  className="w-7 h-7 rounded-full transition-all duration-150 hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: color,
                    outline: watchedStaff[index]?.color === color ? `2px solid ${color}` : '2px solid transparent',
                    outlineOffset: '2px',
                    boxShadow: watchedStaff[index]?.color === color ? `0 0 8px ${color}60` : 'none',
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
          onClick={() => append({ name: '', email: '', password: '', title: '', color: STAFF_COLORS[fields.length % STAFF_COLORS.length] })}
          className="flex items-center gap-2 text-xs font-medium transition-colors"
          style={{ color: 'rgba(107,72,255,0.8)' }}
        >
          <Plus className="w-3.5 h-3.5" /> Başka personel ekle
        </button>
      )}

      <OnboardingActions onBack={onBack} isPending={isSubmitting} submitLabel="İleri" />
    </form>
  )
}
