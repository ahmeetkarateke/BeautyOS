'use client'

import { useState } from 'react'
import { istanbulDateStr } from '@/features/appointments/day-logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useCan, useMe } from '@/lib/v2/session'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { InputField } from '@/ui/field'
import { SegmentedControl } from '@/ui/segmented-control'
import { Sheet } from '@/ui/sheet'
import { useToast } from '@/ui/toast'
import { createQuickRevenue } from './api'
import { parseAmount, payLabel, type PaymentMethod } from './payment-logic'
import { quickSaleBody, validateQuickSale, type QuickSaleErrors, type QuickSaleValues } from './quick-sale-logic'

// Randevusuz işlem (tasarim.md `hizli-islem`): ürün satışı gibi randevusu olmayan tahsilat. Sunucu şeması açıklama, tutar, yöntem ve tarihtir;
// müşteri/hizmet/personel seçimi sunucuda henüz yok. Resepsiyon yalnız bugüne yazar (tarih alanı çıkmaz).
const METHODS = [
  { value: 'cash', label: 'Nakit' },
  { value: 'card', label: 'Kart' },
] as const

export function QuickSaleSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const canPickDate = useCan('finance.report.range')
  const [today] = useState(() => istanbulDateStr(new Date()))
  const [values, setValues] = useState<QuickSaleValues>({ description: '', amountText: '', method: 'cash', date: today })
  const [errors, setErrors] = useState<QuickSaleErrors>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const set = <K extends keyof QuickSaleValues>(key: K, value: QuickSaleValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }
  const amount = parseAmount(values.amountText)

  async function save() {
    if (busy) return
    const found = validateQuickSale(values, { today, canPickDate })
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    setBusy(true)
    setFailure(null)
    try {
      await createQuickRevenue(client, slug, quickSaleBody(values, { today, canPickDate }))
      toast.show({ message: 'Ödeme alındı.' })
      onDone()
    } catch (err) {
      setFailure((err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title="Randevusuz işlem"
      description="Randevusu olmayan tahsilatı kasaya işleyin."
      footer={
        <Button disabled={busy} loading={busy} loadingText="Kaydediliyor…" onClick={() => void save()}>
          {amount.ok ? payLabel(amount.value) : 'Ödeme al'}
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <InputField
          label="Açıklama"
          maxLength={200}
          autoComplete="off"
          hint="Örnek: Ürün satışı"
          value={values.description}
          onChange={(event) => set('description', event.target.value)}
          error={errors.description}
        />
        <InputField
          label="Tutar (₺)"
          inputMode="decimal"
          autoComplete="off"
          value={values.amountText}
          onChange={(event) => set('amountText', event.target.value)}
          error={errors.amountText}
        />
        <div className="grid gap-2">
          <span className="text-sm font-medium">Ödeme yöntemi</span>
          <SegmentedControl
            aria-label="Ödeme yöntemi"
            options={METHODS}
            value={values.method}
            onValueChange={(value) => set('method', value as PaymentMethod)}
            fullWidth
          />
        </div>
        {canPickDate ? (
          <InputField label="Tarih" type="date" max={today} value={values.date} onChange={(event) => set('date', event.target.value)} error={errors.date} />
        ) : null}
      </div>
    </Sheet>
  )
}
