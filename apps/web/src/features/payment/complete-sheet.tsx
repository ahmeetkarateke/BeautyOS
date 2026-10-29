'use client'

import { useState } from 'react'
import { clockLabel, type DayAppointment } from '@/features/appointments/day-logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { InputField } from '@/ui/field'
import { formatMoney } from '@/ui/format'
import { SegmentedControl } from '@/ui/segmented-control'
import { Sheet } from '@/ui/sheet'
import { useToast } from '@/ui/toast'
import { completeAppointment } from './api'
import { canEditAmount, completeBody, parseAmount, payLabel, type PaymentMethod } from './payment-logic'

// Tamamla ve ödeme al (tasarim.md §6): tutar (uzman için salt okunur, R3) → Nakit/Kart → "Ödeme al · ₺850".
// Tamamlama ve kasa hareketi sunucuda tek işlemde yapılır; çift basışta ikinci ödeme oluşmaz (STATUS_LOCKED).
// Paketten düşme ve karma ödeme için sunucu alanı yok: "Yakında".
const METHODS = [
  { value: 'cash', label: 'Nakit' },
  { value: 'card', label: 'Kart' },
] as const

const amountText = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ','))

export function CompleteSheet({
  appointment,
  onClose,
  onDone,
  onStale,
}: {
  appointment: DayAppointment
  onClose: () => void
  onDone: () => void
  onStale?: () => void
}) {
  const client = useApiClient()
  const me = useMe()
  const toast = useToast()
  const canEdit = canEditAmount(me.role)
  const [text, setText] = useState(() => amountText(appointment.price))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)

  const parsed = canEdit ? parseAmount(text) : ({ ok: true, value: appointment.price } as const)
  const amount = parsed.ok ? parsed.value : appointment.price

  async function pay() {
    if (busy) return
    if (!parsed.ok) {
      setAmountError(parsed.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await completeAppointment(client, me.tenant.slug, appointment.id, completeBody({ method, amount: parsed.value, listPrice: appointment.price, canEdit }))
      toast.show({ message: 'Ödeme alındı.' })
      onDone()
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })
      setError(apiError.text())
      // Başkası tamamlamış ya da gün kapanmış olabilir: ekran gerçeğe dönsün; çift ödeme sunucuda engellenir.
      if (apiError.code === 'STATUS_LOCKED' || apiError.code === 'NOT_FOUND') onStale?.()
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
      title="Tamamla ve ödeme al"
      description={`${appointment.customerName} · ${appointment.serviceName} · ${clockLabel(appointment.start)}`}
      footer={
        <Button disabled={busy || (canEdit && !parsed.ok && text.trim() === '')} loading={busy} loadingText="Kaydediliyor…" onClick={() => void pay()}>
          {parsed.ok ? payLabel(amount) : 'Ödeme al'}
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {error ? <Banner tone="error">{error}</Banner> : null}
        {canEdit ? (
          <InputField
            label="Tutar (₺)"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setAmountError(null)
            }}
            error={amountError ?? undefined}
            hint="Hizmet fiyatı yazılı gelir. İndirim yapacaksanız yeni tutarı yazın."
          />
        ) : (
          <InputField label="Tutar" readOnly value={formatMoney(appointment.price)} hint="Tutarı yalnız salon yönetimi değiştirebilir." />
        )}
        <div className="grid gap-2">
          <span id="odeme-yontemi" className="text-sm font-medium">
            Ödeme yöntemi
          </span>
          <SegmentedControl
            aria-label="Ödeme yöntemi"
            options={METHODS}
            value={method}
            onValueChange={(value) => setMethod(value as PaymentMethod)}
            fullWidth
          />
          <p className="text-xs text-text-muted">Paketten düşme ve karma ödeme yakında.</p>
        </div>
      </div>
    </Sheet>
  )
}
