'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { STAFF_COLORS } from '@/lib/staff-colors'
import { OnboardingInput, OnboardingActions } from '../OnboardingInput'

interface Service {
  id: string
  name: string
}

const staffItem = z.object({
  name: z.string().min(2, 'Ad soyad giriniz'),
  email: z.string().email('Geçerli e-posta girin'),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
  title: z.string().min(2, 'Unvan giriniz'),
  color: z.string(),
  serviceIds: z.array(z.string()),
  leaveDates: z.array(z.string()),
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
    defaultValues: { staff: [{ name: '', email: '', password: '', title: '', color: STAFF_COLORS[0], serviceIds: [], leaveDates: [] }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'staff' })
  const watchedStaff = watch('staff')

  const { data: servicesData } = useQuery({
    queryKey: ['services', slug],
    queryFn: () => apiFetch<{ data: Service[] }>(`/api/v1/tenants/${slug}/services`),
  })
  const services = servicesData?.data ?? []

  function toggleService(index: number, serviceId: string) {
    const current = watchedStaff[index]?.serviceIds ?? []
    const next = current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId]
    setValue(`staff.${index}.serviceIds`, next)
  }

  function addLeaveDate(index: number, date: string) {
    if (!date) return
    const current = watchedStaff[index]?.leaveDates ?? []
    if (current.includes(date)) return
    setValue(`staff.${index}.leaveDates`, [...current, date].sort())
  }

  function removeLeaveDate(index: number, date: string) {
    const current = watchedStaff[index]?.leaveDates ?? []
    setValue(`staff.${index}.leaveDates`, current.filter((d) => d !== date))
  }

  async function onSubmit(data: FormData) {
    try {
      const results = await Promise.all(
        data.staff.map(({ name, color, serviceIds: _s, leaveDates: _l, ...rest }) =>
          apiFetch<{ id: string }>(`/api/v1/tenants/${slug}/staff`, {
            method: 'POST',
            body: JSON.stringify({ ...rest, fullName: name, colorCode: STAFF_COLORS.indexOf(color) }),
          }),
        ),
      )

      await Promise.all([
        ...results.flatMap((result, i) =>
          (data.staff[i].serviceIds ?? []).map((serviceId) =>
            apiFetch(`/api/v1/tenants/${slug}/staff/${result.id}/services`, {
              method: 'POST',
              body: JSON.stringify({ serviceId, commissionType: 'percentage', commissionValue: 0 }),
            }),
          ),
        ),
        ...results.flatMap((result, i) =>
          (data.staff[i].leaveDates ?? []).map((leaveDate) =>
            apiFetch(`/api/v1/tenants/${slug}/staff/${result.id}/leaves`, {
              method: 'POST',
              body: JSON.stringify({ leaveDate, leaveType: 'day_off' }),
            }),
          ),
        ),
      ])

      onNext()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir sorun oluştu', 'error')
    }
  }

  const today = new Date().toISOString().split('T')[0]

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

          {/* Renk */}
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

          {/* Yetenekler */}
          {services.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Yapabileceği Hizmetler</p>
              <div className="flex flex-wrap gap-2">
                {services.map((svc) => {
                  const selected = (watchedStaff[index]?.serviceIds ?? []).includes(svc.id)
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleService(index, svc.id)}
                      className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                      style={
                        selected
                          ? { background: 'rgba(107,72,255,0.25)', borderColor: '#6B48FF', color: '#a78bfa' }
                          : { background: 'transparent', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }
                      }
                    >
                      {svc.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* İzin Günleri */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider">İzin Günleri <span className="normal-case">(opsiyonel)</span></p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                min={today}
                onChange={(e) => { addLeaveDate(index, e.target.value); e.target.value = '' }}
                className="flex-1 h-8 px-2 rounded-md text-xs bg-white/5 border border-white/10 text-white/70 focus:outline-none focus:border-purple-500"
              />
            </div>
            {(watchedStaff[index]?.leaveDates ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {(watchedStaff[index]?.leaveDates ?? []).map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
                  >
                    {d}
                    <button type="button" onClick={() => removeLeaveDate(index, d)} className="hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {fields.length < 3 && (
        <button
          type="button"
          onClick={() => append({ name: '', email: '', password: '', title: '', color: STAFF_COLORS[fields.length % STAFF_COLORS.length], serviceIds: [], leaveDates: [] })}
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
