'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { SECTOR_DATA, DEFAULT_SECTOR } from '@/lib/sector-data'
import { OnboardingInput, OnboardingSelect, OnboardingActions } from '../OnboardingInput'

const serviceItem = z.object({
  name: z.string().min(2, 'Hizmet adı giriniz'),
  category: z.string().min(1, 'Kategori seçiniz'),
  duration: z.coerce.number().min(5, 'En az 5 dakika'),
  price: z.coerce.number().min(0, 'Fiyat girin'),
})

const schema = z.object({ services: z.array(serviceItem).min(1).max(5) })
type FormData = z.infer<typeof schema>

interface Step2ServicesProps {
  slug: string
  onNext: () => void
  onBack: () => void
}

export function Step2Services({ slug, onNext, onBack }: Step2ServicesProps) {
  const { data: settingsData } = useQuery({
    queryKey: ['tenant-settings', slug],
    queryFn: () => apiFetch<{ settings?: { businessType?: string } }>(`/api/v1/tenants/${slug}/settings`),
  })

  const businessType = settingsData?.settings?.businessType ?? ''
  const sector = SECTOR_DATA[businessType] ?? DEFAULT_SECTOR

  const { register, handleSubmit, control, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { services: [{ name: '', category: '', duration: 60, price: 0 }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'services' })

  async function onSubmit(data: FormData) {
    try {
      await Promise.all(
        data.services.map(({ duration, ...rest }) =>
          apiFetch(`/api/v1/tenants/${slug}/services`, {
            method: 'POST',
            body: JSON.stringify({ ...rest, durationMinutes: duration }),
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
      {fields.map((field, index) => {
        const nameValue = watch(`services.${index}.name`)
        return (
          <div
            key={field.id}
            className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Hizmet {index + 1}</span>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="text-white/20 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <OnboardingInput
              placeholder="Hizmet adı"
              error={errors.services?.[index]?.name?.message}
              {...register(`services.${index}.name`)}
            />

            {sector.suggestions.length > 0 && !nameValue && (
              <div className="flex flex-wrap gap-1.5">
                {sector.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setValue(`services.${index}.name`, s)}
                    className="px-2.5 py-1 text-xs rounded-full transition-all duration-150"
                    style={{ background: 'rgba(107,72,255,0.12)', border: '1px solid rgba(107,72,255,0.3)', color: 'rgba(139,104,255,1)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <OnboardingSelect
              error={errors.services?.[index]?.category?.message}
              {...register(`services.${index}.category`)}
            >
              <option value="">Kategori seçiniz</option>
              {sector.categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </OnboardingSelect>

            <div className="grid grid-cols-2 gap-3">
              <OnboardingInput
                type="number"
                min={5}
                step={5}
                placeholder="60 dk"
                label="Süre (dk) *"
                error={errors.services?.[index]?.duration?.message}
                {...register(`services.${index}.duration`)}
              />
              <OnboardingInput
                type="number"
                min={0}
                step={10}
                placeholder="150 ₺"
                label="Fiyat (₺) *"
                error={errors.services?.[index]?.price?.message}
                {...register(`services.${index}.price`)}
              />
            </div>
          </div>
        )
      })}

      {fields.length < 5 && (
        <button
          type="button"
          onClick={() => append({ name: '', category: '', duration: 60, price: 0 })}
          className="flex items-center gap-2 text-xs font-medium transition-colors"
          style={{ color: 'rgba(107,72,255,0.8)' }}
        >
          <Plus className="w-3.5 h-3.5" /> Başka hizmet ekle
        </button>
      )}

      <OnboardingActions onBack={onBack} isPending={isSubmitting} submitLabel="İleri" />
    </form>
  )
}
