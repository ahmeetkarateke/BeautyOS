'use client'

import { useMemo, useState } from 'react'
import { fetchServices } from '@/features/appointment-create/api'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Switch } from '@/ui/choice'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { InputField, SelectField, TextareaField } from '@/ui/field'
import { formatMoney } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { createPackage, fetchPackages, removePackage, updatePackage } from './api'
import {
  emptyPackage,
  packageBody,
  packageMeta,
  perSession,
  sortPackages,
  toPackageValues,
  validatePackage,
  type PackageRow,
  type PackageValues,
} from './logic'

// Paketler (tasarim.md Yönetim 3): paket tanımları (hizmet, seans, fiyat, geçerlilik). Müşteriye satış ve seans düşme sonraki parçadır. Yalnız sahip ve müdür.
const message = (err: unknown) => (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text()

export function PackagesScreen() {
  const me = useMe()
  if (me.role !== 'owner' && me.role !== 'manager') return <Forbidden />
  return <PackagesBody />
}

function PackagesBody() {
  const slug = useMe().tenant.slug
  const query = useApiQuery('packages', (c, signal) => fetchPackages(c, slug, signal))
  const [editing, setEditing] = useState<PackageRow | 'new' | null>(null)
  const packages = useMemo(() => sortPackages(query.data ?? []), [query.data])

  let body
  if (query.error && !query.data) {
    body = (
      <Card>
        <ErrorState subject="Paketler" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
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
  } else if (packages.length === 0) {
    body = (
      <Card>
        <EmptyState
          title="Henüz paket yok."
          description="Seans paketleri hazırlayın: müşteri peşin öder, her gelişinde bir seans düşer."
          action={{ label: 'Paket ekle', onClick: () => setEditing('new') }}
          centered
        />
      </Card>
    )
  } else {
    body = (
      <Card>
        <ul aria-label="Paketler" className="m-0 grid list-none gap-0 p-0">
          {packages.map((pkg) => (
            <li key={pkg.id} className="border-b border-border-subtle last:border-b-0">
              <button
                type="button"
                onClick={() => setEditing(pkg)}
                className="grid min-h-(--size-row) w-full cursor-pointer gap-0.5 rounded-control px-1 py-3 text-left hover:bg-surface-subtle"
              >
                <span className="truncate font-medium">{pkg.name}</span>
                <span className="text-sm text-text-muted">
                  {[pkg.serviceName, packageMeta(pkg), `seans başı ${formatMoney(perSession(pkg.price, pkg.totalSessions))}`, pkg.isActive ? '' : 'Pasif']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    )
  }

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl leading-7 font-semibold">Paketler</h1>
        <Button onClick={() => setEditing('new')}>Paket ekle</Button>
      </div>
      {body}
      {editing ? (
        <PackageSheet
          key={editing === 'new' ? 'new' : editing.id}
          pkg={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            query.refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function PackageSheet({ pkg, onClose, onSaved }: { pkg: PackageRow | null; onClose: () => void; onSaved: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const services = useApiQuery('package-services', (c, signal) => fetchServices(c, slug, signal))
  const [values, setValues] = useState<PackageValues>(() => (pkg ? toPackageValues(pkg) : emptyPackage()))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const set = <K extends keyof PackageValues>(key: K, value: PackageValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
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
    const found = validatePackage(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const body = packageBody(values)
    if (!pkg) {
      void run(async () => {
        await createPackage(client, slug, body)
        return 'Paket eklendi.'
      })
      return
    }
    const before = packageBody(toPackageValues(pkg))
    const patch = Object.fromEntries(Object.entries(body).filter(([key, value]) => before[key] !== value))
    if (Object.keys(patch).length === 0) {
      toast.show({ message: 'Değişiklik yapmadınız.' })
      return
    }
    void run(async () => {
      await updatePackage(client, slug, pkg.id, patch)
      return 'Paket kaydedildi.'
    })
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title={pkg ? 'Paketi düzenle' : 'Paket ekle'}
      footer={
        <Button disabled={busy} loading={busy && !confirmRemove} loadingText="Kaydediliyor…" onClick={save}>
          {pkg ? 'Değişiklikleri kaydet' : 'Paket ekle'}
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <SelectField label="Hizmet" value={values.serviceId} onChange={(event) => set('serviceId', event.target.value)} error={errors.serviceId || undefined}>
          <option value="">Seçin</option>
          {(services.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <InputField
          label="Paket adı"
          maxLength={100}
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          error={errors.name || undefined}
        />
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Seans sayısı"
            inputMode="numeric"
            value={values.sessionsText}
            onChange={(event) => set('sessionsText', event.target.value)}
            error={errors.sessionsText || undefined}
          />
          <InputField
            label="Paket fiyatı (₺)"
            inputMode="decimal"
            value={values.priceText}
            onChange={(event) => set('priceText', event.target.value)}
            error={errors.priceText || undefined}
          />
        </div>
        <InputField
          label="Geçerlilik (gün)"
          optional
          inputMode="numeric"
          hint="Boşsa paket süresiz geçerlidir."
          value={values.validityText}
          onChange={(event) => set('validityText', event.target.value)}
          error={errors.validityText || undefined}
        />
        <TextareaField
          label="Açıklama"
          optional
          maxLength={500}
          value={values.description}
          onChange={(event) => set('description', event.target.value)}
          error={errors.description || undefined}
        />
        <Switch
          label="Etkin"
          description="Pasif paket yeni satışta seçilemez; mevcut müşteri paketleri sürer."
          checked={values.isActive}
          onCheckedChange={(on) => set('isActive', on)}
        />
        {pkg ? (
          <Button variant="danger" disabled={busy} onClick={() => setConfirmRemove(true)}>
            Paketi kaldır
          </Button>
        ) : null}
      </div>
      {confirmRemove && pkg ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setConfirmRemove(false)
          }}
          title="Paket kaldırılsın mı?"
          description={`“${pkg.name}” pasif olur ve yeni satışta seçilemez. Kullanan etkin müşteri paketi varsa kaldırılamaz.`}
          actionLabel="Paketi kaldır"
          loading={busy}
          loadingText="Kaldırılıyor…"
          onConfirm={() =>
            void run(async () => {
              await removePackage(client, slug, pkg.id)
              return 'Paket kaldırıldı.'
            })
          }
        />
      ) : null}
    </Sheet>
  )
}
