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
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

export interface HairFormulaItem {
  id: string
  date: string
  formula: string
  brand: string | null
  processTime: number | null
  result: string | null
  staffId: string | null
  staffName?: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  customerId: string
  formula?: HairFormulaItem | null
}

interface StaffOption {
  id: string
  fullName: string
}

interface StaffListResponse {
  data: StaffOption[]
}

const schema = z.object({
  date: z.string().optional(),
  formula: z.string().min(1, 'Zorunlu').max(300, 'En fazla 300 karakter'),
  brand: z.string().max(100).optional(),
  processTime: z.string().optional(),
  result: z.string().max(500).optional(),
  staffId: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function HairFormulaModal({ open, onOpenChange, tenantSlug, customerId, formula }: Props) {
  const qc = useQueryClient()
  const isEdit = !!formula

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const { data: staffData } = useQuery({
    queryKey: ['staff', tenantSlug],
    queryFn: () => apiFetch<StaffListResponse>(`/api/v1/tenants/${tenantSlug}/staff`),
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      reset({
        date: formula?.date ? formula.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        formula: formula?.formula ?? '',
        brand: formula?.brand ?? '',
        processTime: formula?.processTime != null ? String(formula.processTime) : '',
        result: formula?.result ?? '',
        staffId: formula?.staffId ?? '',
      })
    }
  }, [open, formula, reset])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload: Record<string, unknown> = {
        formula: data.formula,
      }
      if (data.brand) payload.brand = data.brand
      if (data.result) payload.result = data.result
      if (data.staffId) payload.staffId = data.staffId
      if (data.processTime) {
        const n = parseInt(data.processTime, 10)
        if (Number.isFinite(n) && n > 0) payload.processTime = n
      }
      if (data.date) {
        payload.date = new Date(`${data.date}T12:00:00.000Z`).toISOString()
      }

      const url = isEdit
        ? `/api/v1/tenants/${tenantSlug}/hair-formulas/${formula!.id}`
        : `/api/v1/tenants/${tenantSlug}/customers/${customerId}/hair-formulas`
      return apiFetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hair-formulas', tenantSlug, customerId] })
      toast(isEdit ? 'Formül güncellendi' : 'Formül eklendi')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Saç Formülü Düzenle' : 'Yeni Saç Formülü'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input type="date" {...register('date')} />
            </div>
            <div className="space-y-2">
              <Label>İşlem Süresi (dk)</Label>
              <Input type="number" min={1} max={360} placeholder="30" {...register('processTime')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Formül *</Label>
            <Input placeholder="3.65 + 6%, 30dk" error={errors.formula?.message} {...register('formula')} />
          </div>
          <div className="space-y-2">
            <Label>Marka</Label>
            <Input placeholder="Schwarzkopf" {...register('brand')} />
          </div>
          <div className="space-y-2">
            <Label>Uygulayan Personel</Label>
            <Select {...register('staffId')}>
              <option value="">Seçilmedi</option>
              {staffData?.data.map((s) => (
                <option key={s.id} value={s.id}>{s.fullName}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sonuç / Not</Label>
            <Textarea placeholder="Saç çok iyi tutundu, müşteri memnun..." {...register('result')} />
          </div>
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
