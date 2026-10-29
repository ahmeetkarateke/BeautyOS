'use client'

import { useState } from 'react'
import { setAppointmentStatus } from '@/features/appointments/api'
import { clockLabel, type DayAppointment } from '@/features/appointments/day-logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useCan, useMe } from '@/lib/v2/session'
import { Banner } from '@/ui/banner'
import { Button, buttonClassName } from '@/ui/button'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { cn } from '@/ui/cn'
import { formatDate, formatMoney } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { StatusBadge } from '@/ui/status-badge'
import { useToast } from '@/ui/toast'
import { availableActions, isLocked, whatsappHref, type DetailAction } from './actions'
import { deleteAppointment } from './api'
import { RescheduleSheet } from './reschedule-sheet'

// Randevu ayrıntısı (tasarim.md §5): bilgi + iletişim + duruma göre eylemler. Tamamlama ve ödeme W16'dadır.
// Sunucu her eylemi yine doğrular; arayüz yalnız izinli ve duruma uygun eylemi gösterir.
export function AppointmentDetailSheet({ appointment, today, now, onClose, onChanged }: { appointment: DayAppointment | null; today: string; now?: Date; onClose: () => void; onChanged: () => void }) {
  return (
    <Sheet
      open={appointment !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Randevu ayrıntısı"
    >
      {appointment ? <DetailBody key={appointment.id} appointment={appointment} today={today} now={now} onClose={onClose} onChanged={onChanged} /> : null}
    </Sheet>
  )
}

type Pending = Exclude<DetailAction, 'start' | 'reschedule'> | null

const CONFIRM: Record<Exclude<Pending, null>, { title: string; description: (a: DayAppointment) => string; label: string; loading: string; destructive: boolean }> = {
  cancel: {
    title: 'Randevuyu iptal etmek istiyor musunuz?',
    description: (a) => `${a.customerName} için ${clockLabel(a.start)} randevusu iptal edilir. Bu işlem geri alınamaz.`,
    label: 'Randevuyu iptal et',
    loading: 'İptal ediliyor…',
    destructive: true,
  },
  noShow: {
    title: 'Müşteri gelmedi olarak işaretlensin mi?',
    description: (a) => `${a.customerName} için ${clockLabel(a.start)} randevusu “Gelmedi” olur ve artık değiştirilemez.`,
    label: 'Gelmedi olarak işaretle',
    loading: 'Kaydediliyor…',
    destructive: false,
  },
  delete: {
    title: 'Randevuyu silmek istiyor musunuz?',
    description: (a) => `${a.customerName} için ${clockLabel(a.start)} randevusu takvimden kalkar. Bu işlem geri alınamaz.`,
    label: 'Randevuyu sil',
    loading: 'Siliniyor…',
    destructive: true,
  },
}

function DetailBody({ appointment, today, now, onClose, onChanged }: { appointment: DayAppointment; today: string; now?: Date; onClose: () => void; onChanged: () => void }) {
  const client = useApiClient()
  const me = useMe()
  const slug = me.tenant.slug
  const toast = useToast()
  const canReschedule = useCan('appointment.reschedule')
  const canDelete = me.role === 'owner' || me.role === 'manager'
  const [busy, setBusy] = useState<DetailAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [rescheduling, setRescheduling] = useState(false)

  const locked = isLocked(appointment.status)
  const actions = availableActions(appointment.status, { canReschedule, canDelete, hasService: appointment.serviceId !== null })
  const wa = appointment.customerPhone ? whatsappHref(appointment.customerPhone) : null

  async function run(action: 'start' | 'cancel' | 'noShow' | 'delete') {
    setBusy(action)
    setError(null)
    try {
      if (action === 'delete') await deleteAppointment(client, slug, appointment.id)
      else await setAppointmentStatus(client, slug, appointment.id, action === 'start' ? 'in_progress' : action === 'cancel' ? 'cancelled' : 'no_show')
      toast.show({ message: action === 'start' ? 'Randevu başladı.' : action === 'cancel' ? 'Randevu iptal edildi.' : action === 'noShow' ? 'Randevu “Gelmedi” olarak işaretlendi.' : 'Randevu silindi.' })
      setPending(null)
      onChanged()
      onClose()
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })
      setError(apiError.text())
      setPending(null)
      // Başkası kapattıysa ya da sildiyse ekran gerçeğe dönsün.
      if (apiError.code === 'STATUS_LOCKED' || apiError.code === 'APPOINTMENT_LOCKED' || apiError.code === 'NOT_FOUND') onChanged()
    } finally {
      setBusy(null)
    }
  }

  const label: Record<DetailAction, string> = { start: 'Başlat', reschedule: 'Saati değiştir', noShow: 'Gelmedi', cancel: 'İptal et', delete: 'Sil' }

  return (
    <div className="grid gap-4 pb-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
        <dt className="text-text-muted">Müşteri</dt>
        <dd className="m-0 font-medium">{appointment.customerName}</dd>
        {appointment.customerPhone ? (
          <>
            <dt className="text-text-muted">Telefon</dt>
            <dd className="m-0 tabular-nums">{appointment.customerPhone}</dd>
          </>
        ) : null}
        <dt className="text-text-muted">Hizmet</dt>
        <dd className="m-0">{appointment.serviceName}</dd>
        <dt className="text-text-muted">Uzman</dt>
        <dd className="m-0">{appointment.staffName}</dd>
        <dt className="text-text-muted">Zaman</dt>
        <dd className="m-0 tabular-nums">
          {formatDate(appointment.start, 'long')} · {clockLabel(appointment.start)} – {clockLabel(appointment.end)}
        </dd>
        <dt className="text-text-muted">Durum</dt>
        <dd className="m-0">
          <StatusBadge status={appointment.status} />
        </dd>
        {me.role !== 'staff' ? (
          <>
            <dt className="text-text-muted">Ücret</dt>
            <dd className="m-0 tabular-nums">{formatMoney(appointment.price)}</dd>
          </>
        ) : null}
        {appointment.notes ? (
          <>
            <dt className="text-text-muted">Not</dt>
            <dd className="m-0">{appointment.notes}</dd>
          </>
        ) : null}
      </dl>

      {appointment.customerPhone ? (
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${appointment.customerPhone.replace(/\s/g, '')}`} aria-label={`Ara: ${appointment.customerName}`} className={cn(buttonClassName({ variant: 'secondary' }))}>
            Ara
          </a>
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp: ${appointment.customerName}`} className={cn(buttonClassName({ variant: 'secondary' }))}>
              WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}

      {locked ? <p className="text-sm text-text-muted">Bu randevu kapandı; artık değiştirilemez.</p> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) =>
            action === 'start' ? (
              <Button key={action} loading={busy === 'start'} loadingText="Başlatılıyor…" disabled={busy !== null} onClick={() => void run('start')}>
                {label[action]}
              </Button>
            ) : action === 'reschedule' ? (
              <Button key={action} variant="secondary" disabled={busy !== null} onClick={() => setRescheduling(true)}>
                {label[action]}
              </Button>
            ) : (
              <Button key={action} variant={action === 'delete' ? 'danger' : 'secondary'} disabled={busy !== null} onClick={() => setPending(action)}>
                {label[action]}
              </Button>
            ),
          )}
        </div>
      ) : null}

      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPending(null)
          }}
          title={CONFIRM[pending].title}
          description={CONFIRM[pending].description(appointment)}
          actionLabel={CONFIRM[pending].label}
          loading={busy === pending}
          loadingText={CONFIRM[pending].loading}
          destructive={CONFIRM[pending].destructive}
          onConfirm={() => void run(pending)}
        />
      ) : null}

      {rescheduling ? (
        <RescheduleSheet
          appointment={appointment}
          today={today}
          now={now}
          onClose={() => setRescheduling(false)}
          onDone={() => {
            setRescheduling(false)
            onChanged()
            onClose()
          }}
        />
      ) : null}
    </div>
  )
}
