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

interface Supplier {
  id: string
  name: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  itemId: string
  itemName: string
}

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'in', label: 'Giriş (Alım)' },
  { value: 'out', label: 'Çıkış (Kullanım)' },
  { value: 'adjustment_in', label: 'Sayım Fazla' },
  { value: 'adjustment_out', label: 'Sayım Eksik' },
  { value: 'waste', label: 'Fire' },
  { value: 'return', label: 'İade' },
  { value: 'transfer_in', label: 'Transfer Giriş' },
  { value: 'transfer_out', label: 'Transfer Çıkış' },
]

const schema = z.object({
  type: z.enum([
    'in', 'out', 'adjustment_in', 'adjustment_out', 'waste', 'return', 'transfer_in', 'transfer_out',
  ]),
  quantity: z.coerce.number().int().positive('Miktar 0\'dan büyük olmalı'),
  unitCost: z.coerce.number().min(0).optional(),
  supplierId: z.string().optional(),
  notes: z.string().max(500).optional(),
})

type FormValues = z.infer<typeof schema>

export function StockMovementModal({ open, onOpenChange, tenantSlug, itemId, itemName }: Props) {
  const qc = useQueryClient()

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'in', quantity: 1 },
  })

  useEffect(() => {
    if (open) reset({ type: 'in', quantity: 1, unitCost: undefined, supplierId: '', notes: '' })
  }, [open, reset])

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', tenantSlug],
    queryFn: () => apiFetch<{ data: Supplier[] }>(`/api/v1/tenants/${tenantSlug}/suppliers`),
    enabled: open,
  })

  const type = watch('type')
  const showUnitCost = type === 'in'
  const showSupplier = type === 'in'

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload: Record<string, unknown> = {
        type: data.type,
        quantity: data.quantity,
      }
      if (showUnitCost && data.unitCost !== undefined && data.unitCost > 0) payload.unitCost = data.unitCost
      if (showSupplier && data.supplierId) payload.supplierId = data.supplierId
      if (data.notes) payload.notes = data.notes
      return apiFetch(`/api/v1/tenants/${tenantSlug}/inventory/${itemId}/movements`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['inventory-low-stock', tenantSlug] })
      qc.invalidateQueries({ queryKey: ['movements', tenantSlug, itemId] })
      toast('Hareket kaydedildi')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stok Hareketi — {itemName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mv-type">Hareket Tipi</Label>
            <Select id="mv-type" error={errors.type?.message} {...register('type')}>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mv-qty">Miktar</Label>
            <Input
              id="mv-qty"
              type="number"
              min={1}
              error={errors.quantity?.message}
              {...register('quantity')}
            />
          </div>
          {showUnitCost && (
            <div className="space-y-2">
              <Label htmlFor="mv-cost">Birim Maliyet (₺)</Label>
              <Input id="mv-cost" type="number" min={0} step="0.01" {...register('unitCost')} />
            </div>
          )}
          {showSupplier && (
            <div className="space-y-2">
              <Label htmlFor="mv-supplier">Tedarikçi</Label>
              <Select id="mv-supplier" {...register('supplierId')}>
                <option value="">Seçiniz (opsiyonel)</option>
                {(suppliersData?.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="mv-notes">Notlar</Label>
            <Textarea id="mv-notes" placeholder="Opsiyonel açıklama" {...register('notes')} />
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
