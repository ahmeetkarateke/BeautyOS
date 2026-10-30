'use client'

import { useState } from 'react'
import { fetchStaffProfiles } from '@/features/staff/api'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useCan, useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Checkbox } from '@/ui/choice'
import { InputField, SelectField, TextareaField } from '@/ui/field'
import { formatDate, formatMoney } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { createTip, distributeTips, fetchTips, fetchTipSummary } from './api'
import { distributeBody, shareOf, sourceLabel, tipBody, validateDistribute, validateTip, type TipValues } from './logic'

// Bahşiş: aylık toplam, dağıtılmayan havuz, kayıtlar; bahşiş ekle ve seçilen personele eşit dağıt. Yetki sunucuda zorlanır.
const message = (err: unknown) => (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text()

export function TipsScreen() {
  const canView = useCan('tip.view')
  if (!canView) return <Forbidden />
  return <TipsBody />
}

function TipsBody() {
  const slug = useMe().tenant.slug
  const canRecord = useCan('tip.record')
  const list = useApiQuery('tips', (c, signal) => fetchTips(c, slug, signal))
  const summary = useApiQuery('tips-summary', (c, signal) => fetchTipSummary(c, slug, signal))
  const [adding, setAdding] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const pool = summary.data?.undistributedTotal ?? 0
  const refresh = () => {
    list.refetch()
    summary.refetch()
  }

  let body
  if (list.error && !list.data) {
    body = (
      <Card>
        <ErrorState subject="Bahşiş kayıtları" onRetry={list.refetch} retrying={list.loading} lastLoadedAt={list.loadedAt} className="px-0" />
      </Card>
    )
  } else if (!list.data) {
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
  } else if (list.data.length === 0) {
    body = (
      <Card>
        <EmptyState
          title="Henüz bahşiş kaydı yok."
          description="Müşteriden alınan bahşişi kaydedin; sonra personele dağıtın."
          action={canRecord ? { label: 'Bahşiş ekle', onClick: () => setAdding(true) } : undefined}
          centered
        />
      </Card>
    )
  } else {
    body = (
      <Card>
        <ul aria-label="Bahşiş kayıtları" className="m-0 grid list-none gap-0 p-0">
          {list.data.map((t) => (
            <li key={t.id} className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0">
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate font-medium">{t.staffName ?? 'Salon havuzu'}</span>
                <span className="text-sm text-text-muted tabular-nums">
                  {formatDate(t.collectedAt, 'short')} · {sourceLabel(t.source)} · {t.isDistributed ? 'Dağıtıldı' : 'Dağıtılmadı'}
                  {t.customerName ? ` · ${t.customerName}` : ''}
                </span>
              </span>
              <span className="flex-none font-semibold tabular-nums">{formatMoney(t.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    )
  }

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl leading-7 font-semibold">Bahşiş</h1>
        {canRecord ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setDistributing(true)} disabled={pool <= 0}>
              Dağıt
            </Button>
            <Button onClick={() => setAdding(true)}>Bahşiş ekle</Button>
          </div>
        ) : null}
      </div>
      {summary.data ? (
        <Card>
          <dl className="m-0 grid grid-cols-2 gap-4 tabular-nums">
            <div>
              <dt className="text-sm text-text-muted">Bu ay toplam</dt>
              <dd className="m-0 text-lg font-semibold">{formatMoney(summary.data.totalAmount)}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-muted">Dağıtılmamış</dt>
              <dd className="m-0 text-lg font-semibold">{formatMoney(summary.data.undistributedTotal)}</dd>
            </div>
          </dl>
        </Card>
      ) : summary.error ? (
        <Banner tone="error">Özet yüklenemedi. Kayıtlar aşağıda listelenir.</Banner>
      ) : null}
      {body}
      {adding ? (
        <AddSheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            refresh()
          }}
        />
      ) : null}
      {distributing ? (
        <DistributeSheet
          pool={pool}
          onClose={() => setDistributing(false)}
          onSaved={() => {
            setDistributing(false)
            refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function AddSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const staff = useApiQuery('tip-staff', (c, signal) => fetchStaffProfiles(c, slug, signal))
  const [values, setValues] = useState<TipValues>({ staffId: '', amountText: '', source: 'cash', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const set = <K extends keyof TipValues>(key: K, value: TipValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  async function save() {
    if (busy) return
    const found = validateTip(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    setFailure(null)
    try {
      await createTip(client, slug, tipBody(values))
      toast.show({ message: 'Bahşiş eklendi.' })
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
      title="Bahşiş ekle"
      footer={
        <Button disabled={busy} loading={busy} loadingText="Kaydediliyor…" onClick={() => void save()}>
          Bahşişi kaydet
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <InputField
          label="Tutar (₺)"
          inputMode="decimal"
          value={values.amountText}
          onChange={(event) => set('amountText', event.target.value)}
          error={errors.amountText || undefined}
        />
        <SelectField label="Nasıl alındı" value={values.source} onChange={(event) => set('source', event.target.value)}>
          <option value="cash">Nakit</option>
          <option value="card">Kart</option>
          <option value="salon_pool">Salon havuzu</option>
        </SelectField>
        <SelectField label="Personel" hint="Seçmezseniz bahşiş havuza girer." value={values.staffId} onChange={(event) => set('staffId', event.target.value)}>
          <option value="">Havuz (sonra dağıtılır)</option>
          {(staff.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </SelectField>
        <TextareaField label="Not" optional maxLength={500} value={values.notes} onChange={(event) => set('notes', event.target.value)} error={errors.notes || undefined} />
      </div>
    </Sheet>
  )
}

function DistributeSheet({ pool, onClose, onSaved }: { pool: number; onClose: () => void; onSaved: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const staff = useApiQuery('tip-dist-staff', (c, signal) => fetchStaffProfiles(c, slug, signal))
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const share = shareOf(pool, picked.length)

  async function save() {
    if (busy) return
    const found = validateDistribute(picked, pool)
    setError(found)
    if (found) return
    setBusy(true)
    setFailure(null)
    try {
      await distributeTips(client, slug, distributeBody(picked))
      toast.show({ message: 'Bahşiş dağıtıldı.' })
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
      title="Bahşişi dağıt"
      description={`Dağıtılmamış ${formatMoney(pool)} seçtiğiniz personele eşit bölünür.`}
      footer={
        <Button disabled={busy} loading={busy} loadingText="Dağıtılıyor…" onClick={() => void save()}>
          Bahşişi dağıt
        </Button>
      }
    >
      <div className="grid gap-3 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        {staff.error && !staff.data ? <Banner tone="error">Personel listesi yüklenemedi. Sayfayı yenileyin.</Banner> : null}
        {(staff.data ?? []).map((s) => (
          <Checkbox
            key={s.id}
            label={s.fullName}
            checked={picked.includes(s.id)}
            onCheckedChange={(on) => {
              setPicked((p) => (on ? [...p, s.id] : p.filter((id) => id !== s.id)))
              setError(null)
            }}
          />
        ))}
        {error ? (
          <p role="alert" className="m-0 text-sm text-danger-text">
            {error}
          </p>
        ) : null}
        <p role="status" className="m-0 text-sm text-text-muted tabular-nums">
          {share !== null ? `Kişi başı yaklaşık ${formatMoney(share)}` : 'Personel seçin.'}
        </p>
      </div>
    </Sheet>
  )
}
