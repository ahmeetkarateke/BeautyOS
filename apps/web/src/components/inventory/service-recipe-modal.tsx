'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface InventoryOption {
  id: string
  name: string
  unit: string
  currentStock: number
}

export interface Recipe {
  id: string
  inventoryId: string
  quantityPerUse: number
  notes: string | null
  isActive: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  serviceId: string
  recipe?: Recipe
}

const schema = z.object({
  inventoryId: z.string().uuid('Ürün seçiniz'),
  quantityPerUse: z.coerce.number().positive('0\'dan büyük olmalı'),
  notes: z.string().max(500).optional(),
})

type FormValues = z.infer<typeof schema>

export function ServiceRecipeModal({ open, onOpenChange, tenantSlug, serviceId, recipe }: Props) {
  const qc = useQueryClient()
  const isEdit = !!recipe

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { inventoryId: '', quantityPerUse: 1, notes: '' },
  })

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory', tenantSlug],
    queryFn: () => apiFetch<{ data: InventoryOption[] }>(`/api/v1/tenants/${tenantSlug}/inventory`),
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      reset(recipe
        ? { inventoryId: recipe.inventoryId, quantityPerUse: recipe.quantityPerUse, notes: recipe.notes ?? '' }
        : { inventoryId: '', quantityPerUse: 1, notes: '' }
      )
    }
  }, [open, recipe, reset])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      if (isEdit) {
        return apiFetch(`/api/v1/tenants/${tenantSlug}/inventory-recipes/${recipe!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            quantityPerUse: data.quantityPerUse,
            notes: data.notes ? data.notes : null,
          }),
        })
      }
      return apiFetch(`/api/v1/tenants/${tenantSlug}/services/${serviceId}/inventory-recipes`, {
        method: 'POST',
        body: JSON.stringify({
          inventoryId: data.inventoryId,
          quantityPerUse: data.quantityPerUse,
          notes: data.notes ? data.notes : null,
        }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-recipes', tenantSlug, serviceId] })
      toast(isEdit ? 'Malzeme güncellendi' : 'Malzeme eklendi')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Malzeme Düzenle' : 'Hizmete Malzeme Ekle'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rec-inv">Ürün</Label>
            <Select id="rec-inv" disabled={isEdit} error={errors.inventoryId?.message} {...register('inventoryId')}>
              <option value="">Seçiniz</option>
              {(inventoryData?.data ?? []).map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.unit}) — stok: {it.currentStock}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-qty">Hizmet Başına Miktar</Label>
            <Input
              id="rec-qty"
              type="number"
              min={0}
              step="0.001"
              placeholder="örn. 80 (ml) veya 1 (adet)"
              error={errors.quantityPerUse?.message}
              {...register('quantityPerUse')}
            />
            <p className="text-xs text-salon-muted">
              Her hizmet uygulandığında bu kadar düşürülecek.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-notes">Not</Label>
            <Textarea id="rec-notes" placeholder="Opsiyonel" {...register('notes')} />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
