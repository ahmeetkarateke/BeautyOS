'use client'

import { useState } from 'react'
import { GENERIC_ERROR } from '@/content/errors'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useHashToken } from '@/lib/v2/hash-token'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { buildDayRange, DayStrip } from '@/ui/day-strip'
import { formatDateTime, formatMoney } from '@/ui/format'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { ErrorState } from '@/ui/states'
import { TimeSlots } from '@/ui/time-slots'
import { cancelBooking, fetchCalendar, fetchSlots, lookupBooking, rescheduleBooking } from './api'
import type { BookingLookup } from './api'
import { doneCopy, icsFileName, manageErrorText, slotDate, slotLabel } from './logic'
import { PublicShell } from './public-shell'

const todayIstanbul = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
const errorText = (error: unknown) => (error instanceof ApiError ? (manageErrorText(error.code) ?? error.text()) : GENERIC_ERROR)
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

const STATUS_TEXT: Record<string, string> = {
  pending: 'Salon onayı bekleniyor',
  confirmed: 'Onaylandı',
  cancelled: 'İptal edildi',
}

function InvalidLink() {
  return <PublicShell title="Bağlantı geçersiz" lead="Randevu bağlantısı geçersiz ya da süresi dolmuş. Salonun size gönderdiği bağlantıyı yeniden açın ya da salonu arayın." />
}

// ADR-0046: belirteç adresin # parçasındadır; okunup adresten silinir, yalnız bellekte tutulur.
export function ManageScreen() {
  const token = useHashToken()
  if (token.status === 'reading') return <PublicShell title="Randevunuz" />
  if (token.status === 'missing') return <InvalidLink />
  return <ManageBooking token={token.token} />
}

function ManageBooking({ token }: { token: string }) {
  const client = useApiClient()
  const lookup = useApiQuery('lookup', (c, signal) => lookupBooking(c, token, signal))
  const [mode, setMode] = useState<'view' | 'reschedule'>('view')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [result, setResult] = useState<{ title: string; lead: string } | null>(null)

  if (lookup.error) {
    if (lookup.error.status === 404 || lookup.error.status === 400) return <InvalidLink />
    return (
      <PublicShell title="Randevunuz">
        <ErrorState subject="Randevu bilgileri" onRetry={lookup.refetch} retrying={lookup.loading} />
      </PublicShell>
    )
  }
  const data = lookup.data
  if (!data) {
    return (
      <PublicShell title="Randevunuz">
        <SkeletonGroup>
          <Skeleton className="w-2/3" />
          <Skeleton className="w-full" />
        </SkeletonGroup>
      </PublicShell>
    )
  }

  async function run(action: () => Promise<void>) {
    setPending(true)
    setFailure(null)
    try {
      await action()
    } catch (error) {
      setFailure(errorText(error))
      if (error instanceof ApiError && ['BOOKING_NOT_FOUND', 'MODIFY_WINDOW_CLOSED', 'BOOKING_NOT_MODIFIABLE'].includes(error.code)) lookup.refetch()
    } finally {
      setPending(false)
    }
  }

  const doCancel = () =>
    run(async () => {
      await cancelBooking(client, token)
      setCancelOpen(false)
      setResult({ title: 'Randevunuz iptal edildi', lead: 'Yeni randevu için salonun online sayfasını kullanabilirsiniz.' })
    })

  const doCalendar = () =>
    run(async () => {
      const ics = await fetchCalendar(client, token)
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
      const link = document.createElement('a')
      link.href = url
      link.download = icsFileName(data.appointment.referenceCode)
      link.click()
      URL.revokeObjectURL(url)
    })

  if (result) {
    return (
      <PublicShell title={result.title} lead={result.lead}>
        <SalonContact data={data} />
      </PublicShell>
    )
  }

  if (mode === 'reschedule') {
    return (
      <RescheduleView
        data={data}
        pending={pending}
        failure={failure}
        onBack={() => {
          setFailure(null)
          setMode('view')
        }}
        onPick={(slotId, staffId) =>
          run(async () => {
            const done = await rescheduleBooking(client, token, slotId, staffId)
            setResult({ ...doneCopy(done.approvalRequired), title: done.approvalRequired ? 'Yeni saat talebiniz alındı' : 'Randevunuz yeni saate taşındı' })
          })
        }
      />
    )
  }

  const a = data.appointment
  const active = a.status === 'pending' || a.status === 'confirmed'
  return (
    <PublicShell title="Randevunuz" lead={data.tenant.name}>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <Banner tone={a.status === 'pending' ? 'warning' : 'info'}>{STATUS_TEXT[a.status] ?? 'Randevu kaydı'}</Banner>
      <dl className="grid gap-1 rounded-card border border-border bg-surface p-4 text-base">
        <dt className="text-sm text-text-muted">Zaman</dt>
        <dd className="tabular-nums">{formatDateTime(a.startAt)}</dd>
        <dt className="mt-2 text-sm text-text-muted">Hizmet</dt>
        <dd>{a.serviceName}</dd>
        <dt className="mt-2 text-sm text-text-muted">Uzman</dt>
        <dd>{a.staffName}</dd>
        {a.price !== undefined ? (
          <>
            <dt className="mt-2 text-sm text-text-muted">Tutar</dt>
            <dd className="tabular-nums">{formatMoney(a.price)}</dd>
          </>
        ) : null}
        <dt className="mt-2 text-sm text-text-muted">Referans kodu</dt>
        <dd className="font-semibold tabular-nums">{a.referenceCode}</dd>
      </dl>
      {active && data.canModify ? (
        <div className="grid gap-2">
          <p className="text-sm text-text-secondary">Randevunuzu {formatDateTime(data.modifyDeadline)} saatine kadar değiştirebilir ya da iptal edebilirsiniz.</p>
          {a.serviceId && a.staffId ? (
            <Button variant="secondary" onClick={() => setMode('reschedule')}>
              Saati değiştir
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setCancelOpen(true)}>
            Randevuyu iptal et
          </Button>
        </div>
      ) : active ? (
        <Banner tone="info">Randevuya 2 saatten az kaldı. Değişiklik ya da iptal için salonu arayın.</Banner>
      ) : null}
      {active ? (
        <Button variant="text" loading={pending} loadingText="Hazırlanıyor…" onClick={() => void doCalendar()}>
          Takvime ekle
        </Button>
      ) : null}
      <SalonContact data={data} />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Randevuyu iptal edelim mi?"
        description="İptal ettiğinizde bu saat salona geri açılır. Yeni randevu almanız gerekir."
        actionLabel="Randevuyu iptal et"
        cancelLabel="Vazgeç"
        destructive
        loading={pending}
        loadingText="İptal ediliyor…"
        onConfirm={() => void doCancel()}
      />
    </PublicShell>
  )
}

function SalonContact({ data }: { data: BookingLookup }) {
  const { phone, address } = data.tenant
  return (
    <div className="grid gap-1 text-sm text-text-secondary">
      {address ? <p>{address}</p> : null}
      {phone ? (
        <a href={telHref(phone)} className="inline-flex min-h-11 items-center">
          Salonu arayın: {phone}
        </a>
      ) : null}
    </div>
  )
}

function RescheduleView({ data, pending, failure, onBack, onPick }: { data: BookingLookup; pending: boolean; failure: string | null; onBack: () => void; onPick: (slotId: string, staffId?: string) => Promise<void> }) {
  const { serviceId, staffId } = data.appointment
  const [date, setDate] = useState(() => todayIstanbul())
  const [slotId, setSlotId] = useState<string | null>(null)
  const slots = useApiQuery(serviceId && staffId ? `reslots:${date}` : null, (c, signal) => fetchSlots(c, data.tenant.slug, { serviceId: serviceId as string, staffId: staffId as string, date }, signal))
  const free = (slots.data ?? []).filter((s) => s.available)
  return (
    <PublicShell title="Yeni saat seçin" lead={`Şu anki randevunuz: ${formatDateTime(data.appointment.startAt)}`}>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <DayStrip
        days={buildDayRange(todayIstanbul(), 14).map((d) => ({ date: d }))}
        selected={date}
        onSelect={(d) => {
          setDate(d)
          setSlotId(null)
        }}
      />
      {slots.error ? (
        <ErrorState subject="Boş saatler" onRetry={slots.refetch} retrying={slots.loading} />
      ) : (
        <TimeSlots
          slots={free.map((s) => slotLabel(s.id))}
          selected={slotId && slotDate(slotId) === date ? slotLabel(slotId) : null}
          loading={slots.loading && !slots.data}
          onSelect={(label) => setSlotId(free.find((s) => slotLabel(s.id) === label)?.id ?? null)}
        />
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack}>
          Vazgeç
        </Button>
        <Button fullWidth disabled={!slotId} loading={pending} loadingText="Kaydediliyor…" onClick={() => slotId && void onPick(slotId)}>
          Yeni saati onayla
        </Button>
      </div>
    </PublicShell>
  )
}
