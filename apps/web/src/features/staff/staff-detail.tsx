'use client'

import Link from 'next/link'
import { useState } from 'react'
import { fetchServices } from '@/features/appointment-create/api'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Avatar, personTone } from '@/ui/avatar'
import { Banner } from '@/ui/banner'
import { Button, buttonClassName } from '@/ui/button'
import { Switch } from '@/ui/choice'
import { Card } from '@/ui/card'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { InputField, SelectField } from '@/ui/field'
import { formatDate } from '@/ui/format'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { StatusBadge } from '@/ui/status-badge'
import { Tab, TabList, TabPanel, Tabs } from '@/ui/tabs'
import { useToast } from '@/ui/toast'
import {
  addLeave,
  assignService,
  fetchAssignments,
  fetchLeaves,
  fetchSalonHours,
  fetchStaffProfiles,
  removeLeave,
  unassignService,
  updateStaffProfile,
  type StaffProfile,
} from './api'
import {
  commissionLine,
  hoursBody,
  leaveTypeLabel,
  salonRows,
  sortLeaves,
  usesSalonHours,
  validateHours,
  validateProfile,
  weekRows,
  type HourRow,
  type Leave,
} from './logic'

// Personel ayrıntısı (tasarim.md §8.1 `personel-detay/<id>`): Profil, Hizmetleri, Çalışma saatleri, İzinler; Ödemeler yakında.
// Sunucu kuralları: profil ve saatleri sahip/müdür, hizmet ataması ve izinleri yalnız sahip yazar.
const message = (err: unknown) => (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text()

export function StaffDetailScreen({ staffId }: { staffId: string }) {
  const me = useMe()
  const slug = me.tenant.slug
  // Rol yetkisizse istek hiç atılmaz (anahtar null).
  const query = useApiQuery(me.role === 'owner' || me.role === 'manager' ? 'staff:profiles' : null, (c, signal) => fetchStaffProfiles(c, slug, signal))
  const [tab, setTab] = useState('profil')
  if (me.role !== 'owner' && me.role !== 'manager') return <Forbidden />
  const back = `/panel/${encodeURIComponent(slug)}/personel`

  if (query.error && !query.data) {
    return (
      <Card>
        <ErrorState subject="Personel bilgileri" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
      </Card>
    )
  }
  if (!query.data) {
    return (
      <SkeletonGroup>
        <Card>
          <div className="grid gap-4">
            <Skeleton className="w-1/3" />
            <Skeleton className="w-2/3" />
          </div>
        </Card>
      </SkeletonGroup>
    )
  }
  const person = query.data.find((p) => p.id === staffId)
  if (!person) {
    return (
      <Card>
        <EmptyState title="Personel bulunamadı." description="Kayıt silinmiş ya da bu bağlantı hatalı olabilir." centered />
        <div className="flex justify-center pb-4">
          <Link href={back} className={buttonClassName({ variant: 'secondary' })}>
            Personel listesine dön
          </Link>
        </div>
      </Card>
    )
  }
  const isOwner = me.role === 'owner'

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={person.fullName} tone={personTone(person.id)} size="lg" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h1 className="text-xl leading-7 font-semibold [overflow-wrap:anywhere]">{person.fullName}</h1>
          <p className="text-sm text-text-muted">{person.title || 'Unvan yok'}</p>
        </div>
        <Link href={back} className={buttonClassName({ variant: 'secondary' })}>
          Personel listesi
        </Link>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabList aria-label="Personel bölümleri">
          <Tab value="profil">Profil</Tab>
          <Tab value="hizmetler">Hizmetleri</Tab>
          <Tab value="saatler">Çalışma saatleri</Tab>
          <Tab value="izinler">İzinler</Tab>
          <Tab value="odemeler">Ödemeler</Tab>
        </TabList>
        <TabPanel value="profil">
          <ProfileTab person={person} onSaved={query.refetch} />
        </TabPanel>
        <TabPanel value="hizmetler">{tab === 'hizmetler' ? <ServicesTab staffId={person.id} canWrite={isOwner} /> : null}</TabPanel>
        <TabPanel value="saatler">
          <HoursTab person={person} onSaved={query.refetch} />
        </TabPanel>
        <TabPanel value="izinler">{tab === 'izinler' ? <LeavesTab staffId={person.id} canWrite={isOwner} /> : null}</TabPanel>
        <TabPanel value="odemeler">
          <Card>
            <p className="flex items-center gap-2 text-base text-text-secondary">
              Personel ödemeleri <StatusBadge status="soon" />
            </p>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  )
}

function ProfileTab({ person, onSaved }: { person: StaffProfile; onSaved: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [title, setTitle] = useState(person.title ?? '')
  const [error, setError] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (busy) return
    const found = validateProfile({ title, bio: '' })
    setError(found.title ?? null)
    if (found.title) return
    if (title.trim() === (person.title ?? '')) {
      toast.show({ message: 'Değişiklik yapmadınız.' })
      return
    }
    setBusy(true)
    setFailure(null)
    try {
      await updateStaffProfile(client, slug, person.id, { title: title.trim() })
      toast.show({ message: 'Profil kaydedildi.' })
      onSaved()
    } catch (err) {
      setFailure(message(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="grid gap-4">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
          <dt className="text-text-muted">E-posta</dt>
          <dd className="m-0 [overflow-wrap:anywhere]">{person.email || 'Yok'}</dd>
        </dl>
        <InputField
          label="Unvan"
          maxLength={100}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            setError(null)
          }}
          error={error ?? undefined}
        />
        <div>
          <Button loading={busy} loadingText="Kaydediliyor…" onClick={() => void save()}>
            Profili kaydet
          </Button>
        </div>
      </div>
    </Card>
  )
}

function ServicesTab({ staffId, canWrite }: { staffId: string; canWrite: boolean }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const list = useApiQuery(`staff:${staffId}:services`, (c, signal) => fetchAssignments(c, slug, staffId, signal))
  const all = useApiQuery(canWrite ? 'staff:all-services' : null, (c, signal) => fetchServices(c, slug, signal))
  const [serviceId, setServiceId] = useState('')
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const assigned = new Set((list.data ?? []).map((a) => a.serviceId))
  const free = (all.data ?? []).filter((s) => !assigned.has(s.id))

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true)
    setFailure(null)
    try {
      await action()
      toast.show({ message: done })
      list.refetch()
    } catch (err) {
      setFailure(message(err))
    } finally {
      setBusy(false)
      setRemoving(null)
    }
  }

  if (list.error && !list.data)
    return (
      <Card>
        <ErrorState subject="Hizmetler" onRetry={list.refetch} retrying={list.loading} className="px-0" />
      </Card>
    )
  if (!list.data)
    return (
      <Card>
        <Skeleton className="w-1/2" />
      </Card>
    )
  return (
    <Card>
      <div className="grid gap-4">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        {list.data.length === 0 ? (
          <p className="text-base text-text-secondary">Bu uzmana henüz hizmet atanmamış. Hizmet atanmadan randevu alamaz.</p>
        ) : (
          <ul aria-label="Verdiği hizmetler" className="m-0 grid list-none gap-0 p-0">
            {list.data.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-b-0">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-medium">{a.serviceName}</span>
                  <span className="text-sm text-text-muted">{commissionLine(a.commissionType, a.commissionValue)}</span>
                </span>
                {canWrite ? (
                  <Button size="sm" variant="text" onClick={() => setRemoving({ id: a.serviceId, name: a.serviceName })}>
                    Kaldır
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canWrite ? (
          <div className="flex flex-wrap items-end gap-2">
            <SelectField label="Hizmet ekle" value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="min-w-48 flex-1">
              <option value="">Seçin</option>
              {free.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            <Button
              disabled={!serviceId || busy}
              loading={busy}
              loadingText="Ekleniyor…"
              onClick={() =>
                void run(async () => {
                  await assignService(client, slug, staffId, { serviceId })
                  setServiceId('')
                }, 'Hizmet atandı.')
              }
            >
              Hizmeti ata
            </Button>
          </div>
        ) : (
          <p className="text-xs text-text-muted">Hizmet atamasını yalnız salon sahibi değiştirebilir.</p>
        )}
      </div>
      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setRemoving(null)
          }}
          title="Hizmet kaldırılsın mı?"
          description={`“${removing.name}” bu uzmanın hizmetlerinden çıkar; yeni randevuda onu seçemezsiniz. Mevcut randevular etkilenmez.`}
          actionLabel="Hizmeti kaldır"
          loading={busy}
          loadingText="Kaldırılıyor…"
          onConfirm={() => void run(() => unassignService(client, slug, staffId, removing.id), 'Hizmet kaldırıldı.')}
        />
      ) : null}
    </Card>
  )
}

// Kişiye özel saati olmayan personel salon saatleriyle çalışır (sunucu böyle çözer). Saat ancak kullanıcı "Kişiye özel saat belirle"ye
// basıp düzenlerse yazılır; ilgisiz bir alanı kaydetmek saatleri yazmaz.
function HoursTab({ person, onSaved }: { person: StaffProfile; onSaved: () => void }) {
  const slug = useMe().tenant.slug
  const own = weekRows(person.workingHours)
  const [custom, setCustom] = useState(false)
  const salon = useApiQuery(usesSalonHours(own) ? 'staff:salon-hours' : null, (c, signal) => fetchSalonHours(c, slug, signal))

  if (!usesSalonHours(own)) return <HoursEditor person={person} initial={own} onSaved={onSaved} />
  if (custom) return <HoursEditor person={person} initial={salonRows(salon.data)} onSaved={onSaved} />
  if (salon.error && !salon.data) {
    return (
      <Card>
        <ErrorState subject="Salon saatleri" onRetry={salon.refetch} retrying={salon.loading} className="px-0" />
      </Card>
    )
  }
  if (salon.data === undefined && salon.loading) {
    return (
      <Card>
        <Skeleton className="w-1/2" />
      </Card>
    )
  }
  return (
    <Card>
      <div className="grid gap-3">
        <Banner tone="info">Salon çalışma saatleri kullanılıyor. Bu uzmana özel saat tanımlanmamış.</Banner>
        <ul aria-label="Salon çalışma saatleri" className="m-0 grid list-none gap-0 p-0">
          {salonRows(salon.data).map((row) => (
            <li key={row.key} className="flex justify-between gap-3 border-b border-border-subtle py-2 last:border-b-0">
              <span>{row.label}</span>
              <span className="tabular-nums text-text-secondary">{row.open ? `${row.start} – ${row.end}` : 'Kapalı'}</span>
            </li>
          ))}
        </ul>
        <div>
          <Button variant="secondary" onClick={() => setCustom(true)}>
            Kişiye özel saat belirle
          </Button>
        </div>
      </div>
    </Card>
  )
}

function HoursEditor({ person, initial, onSaved }: { person: StaffProfile; initial: HourRow[]; onSaved: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [rows, setRows] = useState<HourRow[]>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const patch = (key: string, change: Partial<HourRow>) => {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...change } : r)))
    // Tüm hatalar (genel "en az bir gün açık" şeridi dahil) düzenlemeyle temizlenir.
    void key
    setErrors({})
  }

  async function save() {
    if (busy) return
    const found = validateHours(rows)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    setFailure(null)
    try {
      await updateStaffProfile(client, slug, person.id, { workingHours: hoursBody(rows) })
      toast.show({ message: 'Çalışma saatleri kaydedildi.' })
      onSaved()
    } catch (err) {
      setFailure(message(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="grid gap-3">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        {errors._all ? <Banner tone="error">{errors._all}</Banner> : null}
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
            ) : (
              <p className="text-sm text-text-muted">Kapalı: bu gün randevu alınmaz.</p>
            )}
          </div>
        ))}
        <div>
          <Button loading={busy} loadingText="Kaydediliyor…" onClick={() => void save()}>
            Saatleri kaydet
          </Button>
        </div>
      </div>
    </Card>
  )
}

function LeavesTab({ staffId, canWrite }: { staffId: string; canWrite: boolean }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const list = useApiQuery(`staff:${staffId}:leaves`, (c, signal) => fetchLeaves(c, slug, staffId, signal))
  const [date, setDate] = useState('')
  const [type, setType] = useState('day_off')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [removingLeave, setRemovingLeave] = useState<Leave | null>(null)

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true)
    setFailure(null)
    try {
      await action()
      toast.show({ message: done })
      list.refetch()
    } catch (err) {
      setFailure(message(err))
    } finally {
      setBusy(false)
      setRemovingLeave(null)
    }
  }

  if (list.error && !list.data)
    return (
      <Card>
        <ErrorState subject="İzinler" onRetry={list.refetch} retrying={list.loading} className="px-0" />
      </Card>
    )
  if (!list.data)
    return (
      <Card>
        <Skeleton className="w-1/2" />
      </Card>
    )
  return (
    <Card>
      <div className="grid gap-4">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        {list.data.length === 0 ? (
          <p className="text-base text-text-secondary">Kayıtlı izin yok.</p>
        ) : (
          <ul aria-label="İzinler" className="m-0 grid list-none gap-0 p-0">
            {sortLeaves(list.data).map((leave) => (
              <li key={leave.id} className="flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-b-0">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium tabular-nums">{formatDate(`${leave.leaveDate}T12:00:00+03:00`, 'long')}</span>
                  <span className="text-sm text-text-muted">{[leaveTypeLabel(leave.leaveType), leave.note].filter(Boolean).join(' · ')}</span>
                </span>
                {canWrite ? (
                  <Button size="sm" variant="text" disabled={busy} onClick={() => setRemovingLeave(leave)}>
                    Sil
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canWrite ? (
          <div className="grid gap-3">
            <InputField
              label="İzin günü"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setDateError(null)
              }}
              error={dateError ?? undefined}
            />
            <SelectField label="İzin türü" value={type} onChange={(event) => setType(event.target.value)}>
              {['day_off', 'sick_leave', 'vacation', 'other'].map((t) => (
                <option key={t} value={t}>
                  {leaveTypeLabel(t)}
                </option>
              ))}
            </SelectField>
            <div>
              <Button
                loading={busy}
                loadingText="Ekleniyor…"
                onClick={() => {
                  if (!date) {
                    setDateError('İzin gününü seçin.')
                    return
                  }
                  void run(async () => {
                    await addLeave(client, slug, staffId, { leaveDate: date, leaveType: type })
                    setDate('')
                  }, 'İzin eklendi.')
                }}
              >
                İzin ekle
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-muted">İzinleri yalnız salon sahibi değiştirebilir.</p>
        )}
      </div>
      {removingLeave ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setRemovingLeave(null)
          }}
          title="İzin silinsin mi?"
          description={`${formatDate(`${removingLeave.leaveDate}T12:00:00+03:00`, 'long')} tarihli ${leaveTypeLabel(removingLeave.leaveType).toLowerCase()} kaydı silinir; o gün uzmana yeniden randevu verilebilir.`}
          actionLabel="İzni sil"
          loading={busy}
          loadingText="Siliniyor…"
          onConfirm={() => void run(() => removeLeave(client, slug, staffId, removingLeave.id), 'İzin silindi.')}
        />
      ) : null}
    </Card>
  )
}
