'use client'

import Link from 'next/link'
import { useState } from 'react'
import { hoursBody, salonRows, validateHours, type HourRow } from '@/features/staff/logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button, buttonClassName } from '@/ui/button'
import { Card } from '@/ui/card'
import { Switch } from '@/ui/choice'
import { InputField, SelectField, TextareaField } from '@/ui/field'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { StatusBadge } from '@/ui/status-badge'
import { useToast } from '@/ui/toast'
import { fetchSettings, patchSettings, type SalonSettings } from './api'
import { MODULES, moduleToggle, onlinePatch, salonPatch, sectionsFor, validateOnline, validateSalon, type OnlineValues, type SalonValues } from './logic'

// Ayarlar (tasarim.md §8.1 `ayarlar`, `ayarlar/<bölüm>`): sahip ve müdür; Modüller ve Terimler yalnız sahip.
// Kapsam bu parçada: Salon bilgileri, Online randevu (onay ayarı dahil), Çalışma saatleri, Modüller; Terimler "Yakında".
const message = (err: unknown) => (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text()

export function SettingsHub() {
  const me = useMe()
  const sections = sectionsFor(me.role)
  if (sections.length === 0) return <Forbidden />
  const base = `/panel/${encodeURIComponent(me.tenant.slug)}/ayarlar`
  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <h1 className="text-xl leading-7 font-semibold">Ayarlar</h1>
      <Card>
        <ul aria-label="Ayar bölümleri" className="m-0 grid list-none gap-0 p-0">
          {sections.map((section) => (
            <li key={section.key} className="border-b border-border-subtle last:border-b-0">
              <Link
                href={`${base}/${section.key}`}
                className="grid min-h-(--size-row) gap-0.5 rounded-control px-1 py-3 text-text no-underline hover:bg-surface-subtle"
              >
                <span className="font-medium">{section.label}</span>
                <span className="text-sm text-text-muted">{section.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

export function SettingsSection({ section }: { section: string }) {
  const me = useMe()
  const allowed = sectionsFor(me.role).find((s) => s.key === section)
  const slug = me.tenant.slug
  const query = useApiQuery(allowed ? 'settings:full' : null, (c, signal) => fetchSettings(c, slug, signal))
  const back = `/panel/${encodeURIComponent(slug)}/ayarlar`

  if (!allowed) {
    // Bilinmeyen bölüm ya da rol dışı bölüm: yetkisiz ekran (varlığı belli edilmez).
    return <Forbidden action={<Link href={back}>Ayarlara dön</Link>} />
  }
  let body
  if (query.error && !query.data) {
    body = (
      <Card>
        <ErrorState subject="Ayarlar" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
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
  } else if (section === 'salon') body = <SalonForm data={query.data} onSaved={query.refetch} />
  else if (section === 'online-randevu') body = <OnlineForm data={query.data} onSaved={query.refetch} />
  else if (section === 'calisma-saatleri') body = <HoursForm data={query.data} onSaved={query.refetch} />
  else if (section === 'moduller') body = <ModulesForm data={query.data} onSaved={query.refetch} />
  else
    body = (
      <Card>
        <EmptyState title="Bu bölüm yakında." description="Terimler henüz buradan düzenlenemiyor." centered />
        <div className="flex justify-center pb-4">
          <StatusBadge status="soon" />
        </div>
      </Card>
    )

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl leading-7 font-semibold">{allowed.label}</h1>
        <Link href={back} className={buttonClassName({ variant: 'secondary' })}>
          Ayarlar
        </Link>
      </div>
      {body}
    </div>
  )
}

/** Ortak kaydetme: yalnız değişen alanlar gider; değişiklik yoksa istek atılmaz. */
function useSave(onSaved: () => void) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function save(patch: Record<string, unknown>, done: string) {
    if (busy) return
    if (Object.keys(patch).length === 0) {
      toast.show({ message: 'Değişiklik yapmadınız.' })
      return
    }
    setBusy(true)
    setFailure(null)
    try {
      await patchSettings(client, slug, patch)
      toast.show({ message: done })
      onSaved()
    } catch (err) {
      setFailure(message(err))
    } finally {
      setBusy(false)
    }
  }
  return { busy, failure, save }
}

function SalonForm({ data, onSaved }: { data: SalonSettings; onSaved: () => void }) {
  const original: SalonValues = { name: data.name, phone: data.settings?.phone ?? '', address: data.settings?.address ?? '' }
  const [values, setValues] = useState<SalonValues>(original)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { busy, failure, save } = useSave(onSaved)
  const set = (key: keyof SalonValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }
  return (
    <Card>
      <div className="grid gap-4">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <InputField
          label="Salon adı"
          maxLength={100}
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          error={errors.name || undefined}
        />
        <InputField
          label="Telefon"
          type="tel"
          maxLength={20}
          value={values.phone}
          onChange={(event) => set('phone', event.target.value)}
          error={errors.phone || undefined}
        />
        <InputField
          label="Adres"
          maxLength={255}
          value={values.address}
          onChange={(event) => set('address', event.target.value)}
          error={errors.address || undefined}
        />
        <div>
          <Button
            loading={busy}
            loadingText="Kaydediliyor…"
            onClick={() => {
              const found = validateSalon(values, original)
              setErrors(found)
              if (Object.keys(found).length === 0) void save(salonPatch(values, original), 'Salon bilgileri kaydedildi.')
            }}
          >
            Kaydet
          </Button>
        </div>
      </div>
    </Card>
  )
}

function OnlineForm({ data, onSaved }: { data: SalonSettings; onSaved: () => void }) {
  const original: OnlineValues = {
    enabled: data.settings?.publicBookingEnabled ?? true,
    approval: data.settings?.onlineBookingApproval ?? 'manual',
    whatsapp: data.settings?.whatsappNumber ?? '',
    about: data.settings?.aboutText ?? '',
  }
  const [values, setValues] = useState<OnlineValues>(original)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { busy, failure, save } = useSave(onSaved)
  const smsOff = useMe().tenant.bookingMode === 'approval_required'
  const set = <K extends keyof OnlineValues>(key: K, value: OnlineValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }
  return (
    <Card>
      <div className="grid gap-4">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <Switch
          label="Online randevu sayfası açık"
          description="Kapalıysa müşteriler sayfadan randevu alamaz."
          checked={values.enabled}
          onCheckedChange={(on) => set('enabled', on)}
        />
        {smsOff ? (
          // Kalıcı karar (müdür): SMS doğrulaması yokken sunucu her talebi onaya bırakır; "otomatik" seçeneği yanıltıcı olurdu.
          <Banner tone="info">SMS doğrulaması açılana kadar online talepler salon onayına düşer.</Banner>
        ) : (
          <SelectField
            label="Online randevular"
            value={values.approval}
            onChange={(event) => set('approval', event.target.value as OnlineValues['approval'])}
            hint={
              values.approval === 'manual' ? 'Her talebi siz onaylarsınız; onaylanana dek randevu kesinleşmez.' : 'Talep gelince randevu kendiliğinden onaylanır.'
            }
          >
            <option value="manual">Onayımla kesinleşsin</option>
            <option value="auto">Otomatik onaylansın</option>
          </SelectField>
        )}
        <InputField
          label="WhatsApp numarası"
          optional
          type="tel"
          maxLength={20}
          value={values.whatsapp}
          onChange={(event) => set('whatsapp', event.target.value)}
          error={errors.whatsapp || undefined}
        />
        <TextareaField
          label="Hakkında"
          optional
          maxLength={500}
          hint="Online randevu sayfasında görünür."
          value={values.about}
          onChange={(event) => set('about', event.target.value)}
          error={errors.about || undefined}
        />
        <div>
          <Button
            loading={busy}
            loadingText="Kaydediliyor…"
            onClick={() => {
              const found = validateOnline(values)
              setErrors(found)
              if (Object.keys(found).length === 0) void save(onlinePatch(values, original), 'Online randevu ayarları kaydedildi.')
            }}
          >
            Kaydet
          </Button>
        </div>
      </div>
    </Card>
  )
}

function HoursForm({ data, onSaved }: { data: SalonSettings; onSaved: () => void }) {
  const [rows, setRows] = useState<HourRow[]>(() => salonRows(data.settings?.workingHours))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { busy, failure, save } = useSave(onSaved)
  const patch = (key: string, change: Partial<HourRow>) => {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...change } : r)))
    setErrors({})
  }
  return (
    <Card>
      <div className="grid gap-3">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        {errors._all ? <Banner tone="error">{errors._all}</Banner> : null}
        <p className="text-sm text-text-muted">Özel saati olmayan uzmanlar bu saatlerle çalışır.</p>
        {rows.map((row) => (
          <div key={row.key} className="grid gap-2 border-b border-border-subtle pb-3 last:border-b-0">
            <Switch label={row.label} checked={row.open} onCheckedChange={(open) => patch(row.key, { open })} />
            {row.open ? (
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label={`${row.label} başlangıç`}
                  type="time"
                  value={row.start}
                  onChange={(event) => patch(row.key, { start: event.target.value })}
                  error={errors[row.key] || undefined}
                />
                <InputField label={`${row.label} bitiş`} type="time" value={row.end} onChange={(event) => patch(row.key, { end: event.target.value })} />
              </div>
            ) : null}
          </div>
        ))}
        <div>
          <Button
            loading={busy}
            loadingText="Kaydediliyor…"
            onClick={() => {
              const found = validateHours(rows)
              setErrors(found)
              if (Object.keys(found).length === 0) void save({ workingHours: hoursBody(rows) }, 'Çalışma saatleri kaydedildi.')
            }}
          >
            Saatleri kaydet
          </Button>
        </div>
      </div>
    </Card>
  )
}

function ModulesForm({ data, onSaved }: { data: SalonSettings; onSaved: () => void }) {
  const me = useMe()
  const original = data.settings?.activeModules ?? me.tenant.activeModules
  const [active, setActive] = useState<string[]>([...original])
  const { busy, failure, save } = useSave(onSaved)
  const changed = active.length !== original.length || active.some((k) => !original.includes(k))
  return (
    <Card>
      <div className="grid gap-4">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <p className="text-sm text-text-muted">Kapattığınız bölüm menüden kalkar; verileri silinmez. Bugün ve Ayarlar kapatılamaz.</p>
        {MODULES.map((module) => (
          <Switch
            key={module.key}
            label={module.label}
            description={module.locked ? 'Her zaman açık.' : undefined}
            checked={active.includes(module.key)}
            disabled={module.locked}
            onCheckedChange={(on) => setActive((current) => moduleToggle(current, module.key, on))}
          />
        ))}
        <div>
          <Button
            loading={busy}
            loadingText="Kaydediliyor…"
            onClick={() => void save(changed ? { activeModules: active } : {}, 'Modüller kaydedildi. Menü, sayfayı yenileyince güncellenir.')}
          >
            Kaydet
          </Button>
        </div>
      </div>
    </Card>
  )
}
