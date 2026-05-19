'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { formatCurrency } from '@/lib/utils'

interface ServicePackageItem {
  id: string
  name: string
  totalSessions: number
  price: number
  validityDays: number | null
  isActive: boolean
  service?: { id: string; name: string } | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  customerId: string
  customerName?: string
}

const schema = z.object({
  packageId: z.string().uuid('Paket seçin'),
  pricePaid: z.coerce.number().positive('Geçerli tutar giriniz'),
  notes: z.string().trim().max(500).optional(),
})

type FormValues = z.infer<typeof schema>

export function SellPackageModal({ open, onOpenChange, tenantSlug, customerId, customerName }: Props) {
  const qc = useQueryClient()
  const [selectedPackageId, setSelectedPackageId] = useState<string>('')

  const { data: pkgData } = useQuery({
    queryKey: ['packages', tenantSlug],
    queryFn: () => apiFetch<{ data: ServicePackageItem[] }>(`/api/v1/tenants/${tenantSlug}/packages`),
    enabled: open,
  })
  const packages = pkgData?.data ?? []

  const selectedPackage = useMemo(
    () => packages.find((p) => p.id === selectedPackageId),
    [packages, selectedPackageId],
  )

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { packageId: '', pricePaid: 0, notes: '' },
  })

  const packageIdValue = watch('packageId')

  useEffect(() => {
    setSelectedPackageId(packageIdValue ?? '')
  }, [packageIdValue])

  useEffect(() => {
    if (selectedPackage) {
      setValue('pricePaid', selectedPackage.price)
    }
  }, [selectedPackage, setValue])

  useEffect(() => {
    if (open) {
      reset({ packageId: '', pricePaid: 0, notes: '' })
      setSelectedPackageId('')
    }
  }, [open, reset])

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/customer-packages`, {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          packageId: data.packageId,
          pricePaid: data.pricePaid,
          notes: data.notes?.trim() ? data.notes.trim() : null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-packages', tenantSlug, customerId] })
      qc.invalidateQueries({ queryKey: ['customer', tenantSlug, customerId] })
      toast('Paket müşteriye satıldı')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paket Sat{customerName ? ` — ${customerName}` : ''}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sp-package">Paket</Label>
            <Select id="sp-package" error={errors.packageId?.message} {...register('packageId')}>
              <option value="">Paket seçin</option>
              {packages.filter((p) => p.isActive).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.service ? `· ${p.service.name}` : ''} · {p.totalSessions} seans · {formatCurrency(p.price)}
                </option>
              ))}
            </Select>
            {packages.length === 0 && (
              <p className="text-xs text-salon-muted">Tanımlı paket yok. Önce &quot;Paketler&quot; sayfasından paket oluşturun.</p>
            )}
          </div>

          {selectedPackage && (
            <div className="rounded-md border border-salon-border bg-salon-bg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-salon-muted">Hizmet</span>
                <span className="font-medium">{selectedPackage.service?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-salon-muted">Seans</span>
                <span className="font-medium">{selectedPackage.totalSessions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-salon-muted">Liste Fiyatı</span>
                <span className="font-medium">{formatCurrency(selectedPackage.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-salon-muted">Geçerlilik</span>
                <span className="font-medium">
                  {selectedPackage.validityDays ? `${selectedPackage.validityDays} gün` : 'Süresiz'}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sp-price">Ödenen Tutar (₺)</Label>
            <Input
              id="sp-price"
              type="number"
              min={0}
              step="0.01"
              error={errors.pricePaid?.message}
              {...register('pricePaid')}
            />
            <p className="text-xs text-salon-muted">İndirim veya farklı tutar uygulayabilirsiniz.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sp-notes">Not (opsiyonel)</Label>
            <Input id="sp-notes" placeholder="Örn: Açık fişten kesildi" {...register('notes')} />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={mutation.isPending || packages.length === 0} className="flex-1">
              {mutation.isPending ? 'Kaydediliyor...' : 'Sat'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
