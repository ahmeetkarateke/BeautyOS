'use client'

import { useState } from 'react'
import { istanbulDateStr } from '@/features/appointments/day-logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Checkbox } from '@/ui/choice'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { InputField, SelectField, TextareaField } from '@/ui/field'
import { formatDate, formatMoney } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { cancelInvoice, createInvoice, deleteInvoice, fetchInvoices, fetchSuppliers, postInvoice, type Invoice } from './api'
import {
  emptyItem,
  invoiceActions,
  invoiceBody,
  invoiceStatusLabel,
  invoiceTotals,
  validateInvoice,
  type InvoiceAction,
  type InvoiceValues,
  type ItemValues,
} from './logic'

// Alış faturaları (tasarim.md Yönetim 2): liste, yeni fatura, faturayı işle (stok ve cari hareketi sunucuda), iptal, taslağı silme.
const message = (err: unknown) => (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text()
const has = (permissions: readonly string[], key: string) => permissions.includes(key)

export function InvoicesScreen() {
  const me = useMe()
  if (!has(me.permissions, 'purchase_invoice.read')) return <Forbidden />
  return <InvoicesBody canWrite={has(me.permissions, 'purchase_invoice.write')} />
}

const ACTION_LABEL: Record<InvoiceAction, string> = { post: 'Faturayı işle', cancel: 'Faturayı iptal et', delete: 'Taslağı sil' }

function InvoicesBody({ canWrite }: { canWrite: boolean }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const query = useApiQuery('invoices', (c, signal) => fetchInvoices(c, slug, signal))
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<{ invoice: Invoice; action: InvoiceAction } | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function run() {
    if (!pending) return
    setBusy(true)
    setFailure(null)
    try {
      const { invoice, action } = pending
      if (action === 'post') await postInvoice(client, slug, invoice.id)
      else if (action === 'cancel') await cancelInvoice(client, slug, invoice.id)
      else await deleteInvoice(client, slug, invoice.id)
      toast.show({ message: action === 'post' ? 'Fatura işlendi.' : action === 'cancel' ? 'Fatura iptal edildi.' : 'Taslak silindi.' })
      query.refetch()
    } catch (err) {
      setFailure(message(err))
      query.refetch()
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  let body
  if (query.error && !query.data) {
    body = (
      <Card>
        <ErrorState subject="Alış faturaları" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
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
          title="Henüz alış faturası yok."
          description="Tedarikçiden aldığınız faturaları girin; işleyince stok ve cari hesap kendiliğinden güncellenir."
          action={canWrite ? { label: 'Fatura ekle', onClick: () => setCreating(true) } : undefined}
          centered
        />
      </Card>
    )
  } else {
    body = (
      <Card>
        <ul aria-label="Alış faturaları" className="m-0 grid list-none gap-0 p-0">
          {query.data.map((invoice) => (
            <li key={invoice.id} className="grid gap-2 border-b border-border-subtle py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{invoice.supplierName}</span>
                  <span className="text-sm text-text-muted">
                    {[invoice.invoiceNumber, formatDate(invoice.invoiceDate, 'short'), invoiceStatusLabel(invoice.status)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex-none font-semibold tabular-nums">{formatMoney(invoice.total)}</span>
              </div>
              {canWrite && invoiceActions(invoice.status).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {invoiceActions(invoice.status).map((action) => (
                    <Button key={action} size="sm" variant={action === 'delete' ? 'text' : 'secondary'} onClick={() => setPending({ invoice, action })}>
                      {ACTION_LABEL[action]}
                      <span className="sr-only"> · {invoice.supplierName}</span>
                    </Button>
                  ))}
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
        <h1 className="text-xl leading-7 font-semibold">Alış faturaları</h1>
        {canWrite ? <Button onClick={() => setCreating(true)}>Fatura ekle</Button> : null}
      </div>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      {body}
      {creating ? (
        <InvoiceSheet
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            query.refetch()
          }}
        />
      ) : null}
      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setPending(null)
          }}
          title={pending.action === 'post' ? 'Fatura işlensin mi?' : pending.action === 'cancel' ? 'Fatura iptal edilsin mi?' : 'Taslak silinsin mi?'}
          description={
            pending.action === 'post'
              ? 'İşlenince kalemler stoğa girer ve tedarikçi cari hesabına borç yazılır. Taslak olarak geri alınamaz; yanlışsa iptal edebilirsiniz.'
              : pending.action === 'cancel'
                ? 'İşlenmiş faturanın stok ve cari hareketleri geri alınır.'
                : 'Taslak fatura silinir.'
          }
          actionLabel={ACTION_LABEL[pending.action]}
          destructive={pending.action !== 'post'}
          loading={busy}
          loadingText="Kaydediliyor…"
          onConfirm={() => void run()}
        />
      ) : null}
    </div>
  )
}

function InvoiceSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const suppliers = useApiQuery('invoice-suppliers', (c, signal) => fetchSuppliers(c, slug, signal))
  const [today] = useState(() => istanbulDateStr(new Date()))
  const [values, setValues] = useState<InvoiceValues>(() => ({
    supplierId: '',
    invoiceNumber: '',
    invoiceDate: today,
    dueDate: '',
    notes: '',
    items: [emptyItem()],
    postNow: false,
  }))
  const [errors, setErrors] = useState<{ fields: Record<string, string>; items: Record<string, string>[] }>({ fields: {}, items: [] })
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const totals = invoiceTotals(values.items)

  const setField = <K extends keyof InvoiceValues>(key: K, value: InvoiceValues[K]) => setValues((v) => ({ ...v, [key]: value }))
  const setItem = (index: number, key: keyof ItemValues, value: string) =>
    setValues((v) => ({ ...v, items: v.items.map((it, i) => (i === index ? { ...it, [key]: value } : it)) }))

  async function save() {
    if (busy) return
    const found = validateInvoice(values)
    setErrors(found)
    if (Object.keys(found.fields).length > 0 || found.items.some((e) => Object.keys(e).length > 0)) return
    setBusy(true)
    setFailure(null)
    try {
      await createInvoice(client, slug, invoiceBody(values))
      toast.show({ message: values.postNow ? 'Fatura işlendi.' : 'Taslak kaydedildi.' })
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
      size="lg"
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title="Fatura ekle"
      footer={
        <Button disabled={busy} loading={busy} loadingText="Kaydediliyor…" onClick={() => void save()}>
          {values.postNow ? 'Faturayı işle' : 'Taslak olarak kaydet'}
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <SelectField
          label="Tedarikçi"
          value={values.supplierId}
          onChange={(event) => setField('supplierId', event.target.value)}
          error={errors.fields.supplierId}
        >
          <option value="">Seçin</option>
          {(suppliers.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <InputField
          label="Fatura numarası"
          optional
          maxLength={50}
          value={values.invoiceNumber}
          onChange={(event) => setField('invoiceNumber', event.target.value)}
          error={errors.fields.invoiceNumber}
        />
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Fatura tarihi"
            type="date"
            value={values.invoiceDate}
            onChange={(event) => setField('invoiceDate', event.target.value)}
            error={errors.fields.invoiceDate}
          />
          <InputField
            label="Vade tarihi"
            optional
            type="date"
            value={values.dueDate}
            onChange={(event) => setField('dueDate', event.target.value)}
            error={errors.fields.dueDate}
          />
        </div>
        <fieldset className="m-0 grid gap-3 border-0 p-0">
          <legend className="mb-1 text-sm font-medium">Kalemler</legend>
          {errors.fields.items ? <Banner tone="error">{errors.fields.items}</Banner> : null}
          {values.items.map((item, index) => (
            <div key={index} className="grid gap-2 rounded-card border border-border p-3">
              <InputField
                label={`Kalem ${index + 1} adı`}
                maxLength={200}
                value={item.name}
                onChange={(event) => setItem(index, 'name', event.target.value)}
                error={errors.items[index]?.name}
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <InputField
                  label={`Kalem ${index + 1} adet`}
                  inputMode="numeric"
                  value={item.quantityText}
                  onChange={(event) => setItem(index, 'quantityText', event.target.value)}
                  error={errors.items[index]?.quantityText}
                />
                <InputField
                  label={`Kalem ${index + 1} birim fiyat (₺)`}
                  inputMode="decimal"
                  value={item.priceText}
                  onChange={(event) => setItem(index, 'priceText', event.target.value)}
                  error={errors.items[index]?.priceText}
                />
                <InputField
                  label={`Kalem ${index + 1} KDV (%)`}
                  inputMode="decimal"
                  value={item.taxText}
                  onChange={(event) => setItem(index, 'taxText', event.target.value)}
                  error={errors.items[index]?.taxText}
                />
                <InputField
                  label={`Kalem ${index + 1} indirim (₺)`}
                  inputMode="decimal"
                  value={item.discountText}
                  onChange={(event) => setItem(index, 'discountText', event.target.value)}
                  error={errors.items[index]?.discountText}
                />
              </div>
              {values.items.length > 1 ? (
                <div>
                  <Button size="sm" variant="text" onClick={() => setValues((v) => ({ ...v, items: v.items.filter((_, i) => i !== index) }))}>
                    Kalemi kaldır<span className="sr-only"> · {index + 1}</span>
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          <div>
            <Button variant="secondary" onClick={() => setValues((v) => ({ ...v, items: [...v.items, emptyItem()] }))}>
              Kalem ekle
            </Button>
          </div>
        </fieldset>
        <dl role="status" className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
          <dt className="text-text-muted">Ara toplam</dt>
          <dd className="m-0 text-right">{formatMoney(totals.net)}</dd>
          <dt className="text-text-muted">KDV</dt>
          <dd className="m-0 text-right">{formatMoney(totals.tax)}</dd>
          <dt className="font-medium">Genel toplam</dt>
          <dd className="m-0 text-right font-semibold">{formatMoney(totals.total)}</dd>
        </dl>
        <TextareaField
          label="Not"
          optional
          maxLength={1000}
          value={values.notes}
          onChange={(event) => setField('notes', event.target.value)}
          error={errors.fields.notes}
        />
        <Checkbox
          label="Kaydedince hemen işle"
          description="İşlenen fatura stoğa girer ve tedarikçi cari hesabına borç yazılır."
          checked={values.postNow}
          onCheckedChange={(on) => setField('postNow', on)}
        />
      </div>
    </Sheet>
  )
}
