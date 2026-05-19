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
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

export interface InventoryItem {
  id: string
  name: string
  sku: string | null
  quantity: number
  currentStock: number
  lowStockThreshold: number
  unitCost: number
  sellingPrice: number | null
  unit: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  item?: InventoryItem
}

const schema = z.object({
  name: z.string().min(1, 'Ürün adı gerekli').max(120),
  sku: z.string().max(60).optional(),
  quantity: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0),
  unitCost: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0).optional(),
  unit: z.string().min(1, 'Birim gerekli').max(20),
})

type FormValues = z.infer<typeof schema>

export function InventoryItemModal({ open, onOpenChange, tenantSlug, item }: Props) {
  const qc = useQueryClient()
  const isEdit = !!item

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', sku: '', quantity: 0, lowStockThreshold: 5, unitCost: 0, sellingPrice: 0, unit: 'adet' },
  })

  useEffect(() => {
    if (open) {
      reset(item
        ? {
            name: item.name,
            sku: item.sku ?? '',
            quantity: item.quantity,
            lowStockThreshold: item.lowStockThreshold,
            unitCost: item.unitCost,
            sellingPrice: item.sellingPrice ?? 0,
            unit: item.unit,
          }
        : { name: '', sku: '', quantity: 0, lowStockThreshold: 5, unitCost: 0, sellingPrice: 0, unit: 'adet' }
      )
    }
  }, [open, item, reset])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        name: data.name,
        sku: data.sku ? data.sku : null,
        lowStockThreshold: data.lowStockThreshold,
        unitCost: data.unitCost,
        sellingPrice: data.sellingPrice && data.sellingPrice > 0 ? data.sellingPrice : null,
        unit: data.unit,
        ...(isEdit ? {} : { quantity: data.quantity }),
      }
      return isEdit
        ? apiFetch(`/api/v1/tenants/${tenantSlug}/inventory/${item!.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : apiFetch(`/api/v1/tenants/${tenantSlug}/inventory`, {
            method: 'POST',
            body: JSON.stringify(payload),
          })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['inventory-low-stock', tenantSlug] })
      toast(isEdit ? 'Ürün güncellendi' : 'Ürün oluşturuldu')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Ürün Düzenle' : 'Yeni Ürün'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inv-name">Ürün Adı</Label>
            <Input id="inv-name" placeholder="Saç boyası" error={errors.name?.message} {...register('name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-sku">SKU</Label>
              <Input id="inv-sku" placeholder="BOYA-001" {...register('sku')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-unit">Birim</Label>
              <Input id="inv-unit" placeholder="adet, ml, gr" error={errors.unit?.message} {...register('unit')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!isEdit && (
              <div className="space-y-2">
                <Label htmlFor="inv-qty">Başlangıç Stok</Label>
                <Input id="inv-qty" type="number" min={0} error={errors.quantity?.message} {...register('quantity')} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="inv-threshold">Düşük Stok Eşiği</Label>
              <Input
                id="inv-threshold"
                type="number"
                min={0}
                error={errors.lowStockThreshold?.message}
                {...register('lowStockThreshold')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inv-cost">Birim Maliyet (₺)</Label>
              <Input id="inv-cost" type="number" min={0} step="0.01" error={errors.unitCost?.message} {...register('unitCost')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-sell">Satış Fiyatı (₺)</Label>
              <Input id="inv-sell" type="number" min={0} step="0.01" {...register('sellingPrice')} />
            </div>
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
