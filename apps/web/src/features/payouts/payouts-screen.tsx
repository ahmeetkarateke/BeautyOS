'use client'

import { useState } from 'react'
import { istanbulDateStr } from '@/features/appointments/day-logic'
import { fetchStaffProfiles } from '@/features/staff/api'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { InputField, SelectField, TextareaField } from '@/ui/field'
import { formatDate, formatMoney } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { calculatePayout, createPayout, fetchPayouts, markPaid, type StaffPayout } from './api'
import { createBody, methodLabel, netAmount, payoutStatusLabel, validatePayout, type PayoutValues } from './logic'

// Personel ödemeleri (tasarim.md Yönetim 3): dönem seç, hak edişi hesapla, ek ödeme/kesinti ekle, ödemeyi kaydet, ödendi işaretle. Yalnız sahip ve müdür.
const message = (err: unknown) => (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text()
const PAY_METHODS = ['cash', 'card', 'online'] as const

export function PayoutsScreen() {
  const me = useMe()
  if (me.role !== 'owner' && me.role !== 'manager') return <Forbidden />
  return <PayoutsBody />
}

function PayoutsBody() {
  const slug = useMe().tenant.slug
  const query = useApiQuery('payouts', (c, signal) => fetchPayouts(c, slug, signal))
  const [creating, setCreating] = useState(false)
  const [paying, setPaying] = useState<StaffPayout | null>(null)

  let body
  if (query.error && !query.data) {
    body = (
      <Card>
        <ErrorState subject="Personel ödemeleri" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
      </Card>
    )
  } else if (!query.data) {
    body = (
      <SkeletonGroup>
        <Card>
          <div className="grid gap-4">
            <Skeleton className="w-1/2" />
            <Skeleton className="w-2/3" />
          </div>
        </Card>
      </SkeletonGroup>
    )
  } else if (query.data.length === 0) {
    body = (
      <Card>
        <EmptyState
          title="Henüz ödeme kaydı yok."
          description="Dönem seçip personelin hak edişini hesaplayın ve ödemeyi kaydedin."
          action={{ label: 'Ödeme ekle', onClick: () => setCreating(true) }}
          centered
        />
      </Card>
    )
  } else {
    body = (
      <Card>
        <ul aria-label="Personel ödemeleri" className="m-0 grid list-none gap-0 p-0">
          {query.data.map((p) => (
            <li key={p.id} className="grid gap-2 border-b border-border-subtle py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{p.staffName ?? 'Personel'}</span>
                  <span className="text-sm text-text-muted tabular-nums">
                    {formatDate(`${p.periodStart}T12:00:00+03:00`, 'short')} – {formatDate(`${p.periodEnd}T12:00:00+03:00`, 'short')} ·{' '}
                    {payoutStatusLabel(p.status)}
                    {p.status === 'paid' ? ` · ${methodLabel(p.paymentMethod)}` : ''}
                  </span>
                </span>
                <span className="flex-none font-semibold tabular-nums">{formatMoney(p.netAmount)}</span>
              </div>
              {p.status === 'pending' ? (
                <div>
                  <Button size="sm" variant="secondary" onClick={() => setPaying(p)}>
                    Ödendi işaretle<span className="sr-only"> · {p.staffName}</span>
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    )
  }

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl leading-7 font-semibold">Personel ödemeleri</h1>
        <Button onClick={() => setCreating(true)}>Ödeme ekle</Button>
      </div>
      {body}
      {creating ? (
        <CreateSheet
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            query.refetch()
          }}
        />
      ) : null}
      {paying ? (
        <PaySheet
          payout={paying}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null)
            query.refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function CreateSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const staff = useApiQuery('payout-staff', (c, signal) => fetchStaffProfiles(c, slug, signal))
  const [today] = useState(() => istanbulDateStr(new Date()))
  const [values, setValues] = useState<PayoutValues>({ staffId: '', from: `${today.slice(0, 7)}-01`, to: today, bonusText: '', deductionsText: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const ready = values.staffId !== '' && Object.keys(validatePayout({ ...values, bonusText: '', deductionsText: '', notes: '' }, today)).length === 0
  const calc = useApiQuery(ready ? `payout-calc:${values.staffId}:${values.from}:${values.to}` : null, (c, signal) =>
    calculatePayout(c, slug, values.staffId, values.from, values.to, signal),
  )
  const net = calc.data ? netAmount(calc.data.grossEarned, values.bonusText, values.deductionsText) : null
  const set = <K extends keyof PayoutValues>(key: K, value: PayoutValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  async function save() {
    if (busy) return
    const found = validatePayout(values, today)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    setFailure(null)
    try {
      await createPayout(client, slug, createBody(values))
      toast.show({ message: 'Ödeme kaydı eklendi.' })
      onSaved()
    } catch (err) {
      setFailure(message(err))
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
      title="Ödeme ekle"
      description="Dönem içinde tamamlanan hizmetlerin primi otomatik hesaplanır."
      footer={
        <Button disabled={busy} loading={busy} loadingText="Kaydediliyor…" onClick={() => void save()}>
          Ödeme kaydı ekle
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <SelectField label="Personel" value={values.staffId} onChange={(event) => set('staffId', event.target.value)} error={errors.staffId || undefined}>
          <option value="">Seçin</option>
          {(staff.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Dönem başı"
            type="date"
            max={today}
            value={values.from}
            onChange={(event) => set('from', event.target.value)}
            error={errors.from || undefined}
          />
          <InputField
            label="Dönem sonu"
            type="date"
            max={today}
            value={values.to}
            onChange={(event) => set('to', event.target.value)}
            error={errors.to || undefined}
          />
        </div>
        <InputField
          label="Ek ödeme (₺)"
          optional
          inputMode="decimal"
          value={values.bonusText}
          onChange={(event) => set('bonusText', event.target.value)}
          error={errors.bonusText || undefined}
        />
        <InputField
          label="Kesinti (₺)"
          optional
          inputMode="decimal"
          value={values.deductionsText}
          onChange={(event) => set('deductionsText', event.target.value)}
          error={errors.deductionsText || undefined}
        />
        <TextareaField
          label="Not"
          optional
          maxLength={500}
          value={values.notes}
          onChange={(event) => set('notes', event.target.value)}
          error={errors.notes || undefined}
        />
        <dl role="status" className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
          <dt className="text-text-muted">Hak ediş (prim)</dt>
          <dd className="m-0 text-right">{calc.data ? formatMoney(calc.data.grossEarned) : calc.loading ? 'Hesaplanıyor…' : '—'}</dd>
          <dt className="font-medium">Ödenecek net tutar</dt>
          <dd className="m-0 text-right font-semibold">{net !== null ? formatMoney(net) : '—'}</dd>
        </dl>
        {calc.error && !calc.data ? <Banner tone="error">Hak ediş hesaplanamadı. Dönemi kontrol edip yeniden deneyin.</Banner> : null}
      </div>
    </Sheet>
  )
}

function PaySheet({ payout, onClose, onDone }: { payout: StaffPayout; onClose: () => void; onDone: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [method, setMethod] = useState<string>('cash')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function pay() {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await markPaid(client, slug, payout.id, method)
      toast.show({ message: 'Ödeme yapıldı olarak işaretlendi.' })
      onDone()
    } catch (err) {
      setFailure(message(err))
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
      title="Ödendi işaretle"
      description={`${payout.staffName ?? 'Personel'} · ${formatMoney(payout.netAmount)}`}
      footer={
        <Button disabled={busy} loading={busy} loadingText="Kaydediliyor…" onClick={() => void pay()}>
          Ödendi işaretle
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <SelectField label="Ödeme yöntemi" value={method} onChange={(event) => setMethod(event.target.value)}>
          {PAY_METHODS.map((m) => (
            <option key={m} value={m}>
              {methodLabel(m)}
            </option>
          ))}
        </SelectField>
      </div>
    </Sheet>
  )
}
