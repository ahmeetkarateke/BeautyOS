'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

const CATEGORIES = ['Saç', 'Tırnak', 'Cilt', 'Masaj', 'Diğer'] as const

const serviceItem = z.object({
  name: z.string().min(2, 'Hizmet adı giriniz'),
  category: z.enum(CATEGORIES, { required_error: 'Kategori seçiniz' }),
  duration: z.coerce.number().min(5, 'En az 5 dakika'),
  price: z.coerce.number().min(0, 'Fiyat girin'),
})

const schema = z.object({
  services: z.array(serviceItem).min(1).max(5),
})

type FormData = z.infer<typeof schema>

interface Step2ServicesProps {
  slug: string
  onNext: () => void
  onBack: () => void
}

export function Step2Services({ slug, onNext, onBack }: Step2ServicesProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      services: [{ name: '', category: 'Saç', duration: 60, price: 0 }],
    },
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {fields.map((field, index) => (
        <div key={field.id} className="rounded-lg border border-salon-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-salon-muted">Hizmet {index + 1}</span>
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

          <div className="space-y-1.5">
            <Label>Hizmet Adı *</Label>
            <Input
              placeholder="Saç boyama"
              error={errors.services?.[index]?.name?.message}
              {...register(`services.${index}.name`)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kategori *</Label>
            <Select
              error={errors.services?.[index]?.category?.message}
              {...register(`services.${index}.category`)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Süre (dk) *</Label>
              <Input
                type="number"
                min={5}
                step={5}
                placeholder="60"
                error={errors.services?.[index]?.duration?.message}
                {...register(`services.${index}.duration`)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fiyat (₺) *</Label>
              <Input
                type="number"
                min={0}
                step={10}
                placeholder="150"
                error={errors.services?.[index]?.price?.message}
                {...register(`services.${index}.price`)}
              />
            </div>
          </div>
        </div>
      ))}

      {fields.length < 5 && (
        <button
          type="button"
          onClick={() => append({ name: '', category: 'Saç', duration: 60, price: 0 })}
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
