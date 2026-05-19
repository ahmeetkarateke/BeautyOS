'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  customerId: string
}

const schema = z.object({
  url: z.string().url('Geçerli https URL giriniz').refine((v) => /^https:\/\//i.test(v), 'Yalnızca https URL kabul edilir'),
  caption: z.string().max(200).optional(),
  category: z.string().max(50).optional(),
  takenAt: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function PhotoUploadModal({ open, onOpenChange, tenantSlug, customerId }: Props) {
  const qc = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (open) {
      reset({
        url: '',
        caption: '',
        category: 'general',
        takenAt: new Date().toISOString().slice(0, 10),
      })
    }
  }, [open, reset])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload: Record<string, unknown> = { url: data.url }
      if (data.caption) payload.caption = data.caption
      if (data.category) payload.category = data.category
      if (data.takenAt) payload.takenAt = new Date(`${data.takenAt}T12:00:00.000Z`).toISOString()

      return apiFetch(`/api/v1/tenants/${tenantSlug}/customers/${customerId}/photos`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-photos', tenantSlug, customerId] })
      toast('Fotoğraf eklendi')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fotoğraf Ekle</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-salon-muted -mt-3 mb-3">Fotoğraf yükleme yakında. Şimdilik https URL yapıştırın.</p>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Fotoğraf URL *</Label>
            <Input placeholder="https://..." error={errors.url?.message} {...register('url')} />
          </div>
          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Input placeholder="Boyama sonrası" {...register('caption')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select {...register('category')}>
                <option value="general">Genel</option>
                <option value="hair_before">Saç Öncesi</option>
                <option value="hair_after">Saç Sonrası</option>
                <option value="nail">Tırnak</option>
                <option value="skin">Cilt</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input type="date" {...register('takenAt')} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Ekleniyor...' : 'Ekle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
