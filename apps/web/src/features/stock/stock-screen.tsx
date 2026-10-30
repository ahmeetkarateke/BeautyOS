'use client'

import { useMemo, useState } from 'react'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { InputField, SelectField, TextareaField } from '@/ui/field'
import { formatDate, formatMoney } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { addMovement, createItem, deleteItem, fetchInventory, fetchMovements, updateItem } from './api'
import {
  emptyProduct,
  MOVEMENT_TYPES,
  movementBody,
  movementLabel,
  productBody,
  sortItems,
  stockStatus,
  toProductValues,
  validateMovement,
  validateProduct,
  type Item,
  type MovementValues,
  type ProductValues,
} from './logic'

// Stok (tasarim.md Yönetim): ürünler, stok durumu (az/tükendi), ürün ekle/düzenle/sil ve stok hareketi. Yalnız sahip ve müdür.
const message = (err: unknown) => (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text()
const STATUS_TEXT = { ok: '', low: 'Az kaldı', out: 'Tükendi' } as const

export function StockScreen() {
  const me = useMe()
  if (me.role !== 'owner' && me.role !== 'manager') return <Forbidden />
  return <StockBody />
}

function StockBody() {
  const slug = useMe().tenant.slug
  const query = useApiQuery('inventory', (c, signal) => fetchInventory(c, slug, signal))
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [moving, setMoving] = useState<Item | null>(null)
  const items = useMemo(() => sortItems(query.data ?? []), [query.data])
  const lowCount = items.filter((i) => stockStatus(i) !== 'ok').length

  let body
  if (query.error && !query.data) {
    body = (
      <Card>
        <ErrorState subject="Stok listesi" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
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
  } else if (items.length === 0) {
    body = (
      <Card>
        <EmptyState
          title="Henüz ürün yok."
          description="Şampuan, boya gibi sarf malzemelerinizi ekleyin; azalınca uyarı alın."
          action={{ label: 'Ürün ekle', onClick: () => setEditing('new') }}
          centered
        />
      </Card>
    )
  } else {
    body = (
      <Card>
        <ul aria-label="Ürünler" className="m-0 grid list-none gap-0 p-0">
          {items.map((item) => {
            const status = stockStatus(item)
            return (
              <li key={item.id} className="flex items-center gap-2 border-b border-border-subtle py-2 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="flex min-h-(--size-row) min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-control px-1 text-left hover:bg-surface-subtle"
                >
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="text-sm text-text-muted">
                      {[item.sku, STATUS_TEXT[status], `${formatMoney(item.unitCost)} / ${item.unit}`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="flex-none font-semibold tabular-nums">
                    {item.quantity} {item.unit}
                  </span>
                </button>
                <Button size="sm" variant="secondary" onClick={() => setMoving(item)}>
                  Hareket ekle<span className="sr-only"> · {item.name}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      </Card>
    )
  }

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl leading-7 font-semibold">Stok</h1>
        <Button onClick={() => setEditing('new')}>Ürün ekle</Button>
      </div>
      {lowCount > 0 ? <Banner tone="warning">{lowCount} üründe stok azaldı ya da bitti. Listenin en üstündeler.</Banner> : null}
      {body}
      {editing ? (
        <ProductSheet
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            query.refetch()
          }}
        />
      ) : null}
      {moving ? (
        <MovementSheet
          item={moving}
          onClose={() => setMoving(null)}
          onDone={() => {
            setMoving(null)
            query.refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function ProductSheet({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [values, setValues] = useState<ProductValues>(() => (item ? toProductValues(item) : emptyProduct()))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const set = (key: keyof ProductValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setFailure(null)
    try {
      toast.show({ message: await action() })
      onSaved()
    } catch (err) {
      setFailure(message(err))
    } finally {
      setBusy(false)
      setConfirmRemove(false)
    }
  }

  function save() {
    const found = validateProduct(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const body = productBody(values)
    if (!item) {
      void run(async () => {
        await createItem(client, slug, body)
        return 'Ürün eklendi.'
      })
      return
    }
    // Miktar düzenlemede değişmez (stok yalnız hareketle değişir); değişen alanlar gider.
    const patch: Record<string, unknown> = {}
    if (body.name !== item.name) patch.name = body.name
    if ((body.sku ?? null) !== (item.sku ?? null)) patch.sku = body.sku ?? null
    if (body.unit !== item.unit) patch.unit = body.unit
    if (body.lowStockThreshold !== item.lowStockThreshold) patch.lowStockThreshold = body.lowStockThreshold
    if (body.unitCost !== item.unitCost) patch.unitCost = body.unitCost
    if ((body.sellingPrice ?? null) !== (item.sellingPrice ?? null)) patch.sellingPrice = body.sellingPrice ?? null
    if (Object.keys(patch).length === 0) {
      toast.show({ message: 'Değişiklik yapmadınız.' })
      return
    }
    void run(async () => {
      await updateItem(client, slug, item.id, patch)
      return 'Ürün kaydedildi.'
    })
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title={item ? 'Ürünü düzenle' : 'Ürün ekle'}
      footer={
        <Button disabled={busy} loading={busy && !confirmRemove} loadingText="Kaydediliyor…" onClick={save}>
          {item ? 'Değişiklikleri kaydet' : 'Ürün ekle'}
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <InputField
          label="Ürün adı"
          maxLength={120}
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          error={errors.name || undefined}
        />
        <InputField
          label="Stok kodu"
          optional
          maxLength={60}
          value={values.sku}
          onChange={(event) => set('sku', event.target.value)}
          error={errors.sku || undefined}
        />
        <InputField
          label="Birim"
          maxLength={20}
          hint="Örnek: adet, ml, kutu"
          value={values.unit}
          onChange={(event) => set('unit', event.target.value)}
          error={errors.unit || undefined}
        />
        {!item ? (
          <InputField
            label="Başlangıç miktarı"
            inputMode="numeric"
            value={values.quantityText}
            onChange={(event) => set('quantityText', event.target.value)}
            error={errors.quantityText || undefined}
          />
        ) : (
          <p className="text-sm text-text-muted">
            Mevcut stok: {item.quantity} {item.unit}. Miktar “Hareket ekle” ile değişir.
          </p>
        )}
        <InputField
          label="Uyarı eşiği"
          inputMode="numeric"
          hint="Stok bu sayıya inince ürün “Az kaldı” görünür."
          value={values.thresholdText}
          onChange={(event) => set('thresholdText', event.target.value)}
          error={errors.thresholdText || undefined}
        />
        <InputField
          label="Birim maliyet (₺)"
          inputMode="decimal"
          value={values.costText}
          onChange={(event) => set('costText', event.target.value)}
          error={errors.costText || undefined}
        />
        <InputField
          label="Satış fiyatı (₺)"
          optional
          inputMode="decimal"
          value={values.priceText}
          onChange={(event) => set('priceText', event.target.value)}
          error={errors.priceText || undefined}
        />
        {item ? (
          <Button variant="danger" disabled={busy} onClick={() => setConfirmRemove(true)}>
            Ürünü sil
          </Button>
        ) : null}
      </div>
      {confirmRemove && item ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setConfirmRemove(false)
          }}
          title="Ürün silinsin mi?"
          description={`“${item.name}” silinir. Hareketi ya da reçete bağlantısı varsa silinemez.`}
          actionLabel="Ürünü sil"
          loading={busy}
          loadingText="Siliniyor…"
          onConfirm={() =>
            void run(async () => {
              await deleteItem(client, slug, item.id)
              return 'Ürün silindi.'
            })
          }
        />
      ) : null}
    </Sheet>
  )
}

function MovementSheet({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const history = useApiQuery(`inventory:${item.id}:movements`, (c, signal) => fetchMovements(c, slug, item.id, signal))
  const [values, setValues] = useState<MovementValues>({ type: 'in', quantityText: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function save() {
    if (busy) return
    const found = validateMovement(values, item.quantity)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    setFailure(null)
    try {
      await addMovement(client, slug, item.id, movementBody(values))
      toast.show({ message: 'Stok hareketi kaydedildi.' })
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
      title="Stok hareketi ekle"
      description={`${item.name} · mevcut ${item.quantity} ${item.unit}`}
      footer={
        <Button disabled={busy} loading={busy} loadingText="Kaydediliyor…" onClick={() => void save()}>
          Hareketi kaydet
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <SelectField label="Hareket türü" value={values.type} onChange={(event) => setValues((v) => ({ ...v, type: event.target.value }))}>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {movementLabel(t)}
            </option>
          ))}
        </SelectField>
        <InputField
          label="Adet"
          inputMode="numeric"
          value={values.quantityText}
          onChange={(event) => {
            setValues((v) => ({ ...v, quantityText: event.target.value }))
            setErrors((e) => ({ ...e, quantityText: '' }))
          }}
          error={errors.quantityText || undefined}
        />
        <TextareaField
          label="Not"
          optional
          maxLength={500}
          value={values.notes}
          onChange={(event) => setValues((v) => ({ ...v, notes: event.target.value }))}
          error={errors.notes || undefined}
        />
        <div className="grid gap-1.5">
          <h3 className="m-0 text-sm font-medium">Son hareketler</h3>
          {history.error && !history.data ? (
            <p className="text-sm text-text-muted">Hareketler yüklenemedi.</p>
          ) : !history.data ? (
            <Skeleton className="w-1/2" />
          ) : history.data.length === 0 ? (
            <p className="text-sm text-text-muted">Henüz hareket yok.</p>
          ) : (
            <ul aria-label="Son hareketler" className="m-0 grid list-none gap-0 p-0 text-sm">
              {history.data.slice(0, 10).map((m) => (
                <li key={m.id} className="flex justify-between gap-3 border-b border-border-subtle py-1.5 last:border-b-0">
                  <span>
                    {movementLabel(m.type)} · {formatDate(m.occurredAt, 'short')}
                  </span>
                  <span className="tabular-nums">{m.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  )
}
