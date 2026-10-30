'use client'

import { useState } from 'react'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { InputField, TextareaField } from '@/ui/field'
import { formatMoney } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { useToast } from '@/ui/toast'
import { closeDay } from './api'
import { closeBody, differenceView, validateCount } from './logic'

// Günü kapat (tasarim.md gün sonu): beklenen nakit sunucudan gelir; sayım isteğe bağlı, fark canlı gösterilir.
// Kapanıştan sonra o güne tamamlama ve gelir yazılamaz (DAY_CLOSED); yalnız sahip/müdür yeniden açar.
export function CloseDaySheet({ date, expectedCash, onClose, onDone }: { date: string; expectedCash: number; onClose: () => void; onDone: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [countText, setCountText] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [countError, setCountError] = useState<string | null>(null)

  const count = validateCount(countText)
  const diff = count.ok && count.value !== null ? differenceView(expectedCash, count.value) : null

  async function save() {
    if (busy) return
    if (!count.ok) {
      setCountError(count.error)
      return
    }
    setBusy(true)
    setFailure(null)
    try {
      await closeDay(client, slug, date, closeBody(count.value, note))
      toast.show({ message: 'Gün sonu kaydedildi.' })
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
      title="Günü kapat"
      description="Kapanıştan sonra bu güne yeni ödeme yazılamaz. Gerekirse sahip ya da müdür günü yeniden açar."
      footer={
        <Button disabled={busy} loading={busy} loadingText="Kaydediliyor…" onClick={() => void save()}>
          Günü kapat
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <p className="text-base">
          Beklenen nakit: <strong className="tabular-nums">{formatMoney(expectedCash)}</strong>
        </p>
        <InputField
          label="Sayılan nakit (₺)"
          optional
          inputMode="decimal"
          autoComplete="off"
          hint="Kasadaki parayı sayıp yazın; farkı hemen görürsünüz."
          value={countText}
          onChange={(event) => {
            setCountText(event.target.value)
            setCountError(null)
          }}
          error={countError ?? undefined}
        />
        {diff ? (
          <p role="status" data-tone={diff.tone} className="text-base font-medium">
            {diff.text}
          </p>
        ) : null}
        <TextareaField label="Not" optional maxLength={300} hint="Fark varsa nedenini yazın." value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
    </Sheet>
  )
}
