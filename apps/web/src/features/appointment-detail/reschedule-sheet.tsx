'use client'

import { useMemo, useState } from 'react'
import { fetchSlots } from '@/features/appointment-create/api'
import { slotStartAt } from '@/features/appointment-create/create-logic'
import { clockLabel, type DayAppointment } from '@/features/appointments/day-logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { DayStrip, buildDayRange } from '@/ui/day-strip'
import { formatDate } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { ErrorState } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { rescheduleAppointment } from './api'

// Saati değiştir (tasarim.md §5): aynı hizmet ve personel için 14 günlük şerit + boş saatler. Dokunmatik ve klavyede sürükle-bırakın karşılığıdır.
// Saat dolarsa (SLOT_TAKEN) hata saat bölümünde görünür, saatler yenilenir, seçim temizlenir.
const DAYS = 14
const SLOT_ERRORS = new Set(['SLOT_TAKEN', 'SLOT_CONFLICT', 'APPOINTMENT_CONFLICT'])

export function RescheduleSheet({ appointment, today, onClose, onDone }: { appointment: DayAppointment; today: string; onClose: () => void; onDone: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [date, setDate] = useState(today)
  const [choice, setChoice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serviceId = appointment.serviceId ?? ''
  const slots = useApiQuery(serviceId ? `slots:${serviceId}:${appointment.staffKey}:${date}` : null, (c, signal) => fetchSlots(c, slug, serviceId, appointment.staffKey, date, signal))
  const free = useMemo(() => (slots.data ?? []).filter((s) => s.available), [slots.data])
  const slotId = free.some((s) => s.id === choice) ? choice : ''
  const days = useMemo(() => buildDayRange(today, DAYS).map((d) => ({ date: d })), [today])

  async function save() {
    if (!slotId) return
    setBusy(true)
    setError(null)
    try {
      await rescheduleAppointment(client, slug, appointment.id, slotStartAt(slotId))
      toast.show({ message: 'Randevunun saati değiştirildi.' })
      onDone()
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })
      setError(apiError.text())
      if (SLOT_ERRORS.has(apiError.code)) {
        setChoice('')
        slots.refetch()
      } else if (apiError.code === 'STATUS_LOCKED') onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Saati değiştir"
      description={`${appointment.customerName} · ${appointment.serviceName} · şu an ${formatDate(appointment.start, 'short')} ${clockLabel(appointment.start)}`}
      footer={
        <Button disabled={!slotId || busy} loading={busy} loadingText="Kaydediliyor…" onClick={() => void save()}>
          Saati değiştir
        </Button>
      }
    >
      <div className="grid gap-3 pb-2">
        <DayStrip days={days} selected={date} onSelect={(d) => { setDate(d); setChoice(''); setError(null) }} />
        {error ? <Banner tone="error">{error}</Banner> : null}
        {slots.error && !slots.data ? (
          <ErrorState subject="Boş saatler" onRetry={slots.refetch} retrying={slots.loading} className="px-0" />
        ) : !slots.data ? (
          <SkeletonGroup className="grid gap-2">
            <Skeleton />
            <Skeleton className="w-2/3" />
          </SkeletonGroup>
        ) : free.length === 0 ? (
          <p className="text-sm text-text-muted">Bu gün boş saat yok. Başka bir gün seçin.</p>
        ) : (
          <div role="group" aria-label="Boş saatler" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {free.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === slotId}
                onClick={() => { setChoice(s.id); setError(null) }}
                className={
                  s.id === slotId
                    ? 'min-h-11 cursor-pointer rounded-control border border-primary bg-primary text-sm font-medium text-on-primary tabular-nums'
                    : 'min-h-11 cursor-pointer rounded-control border border-border bg-surface text-sm font-medium text-text tabular-nums hover:border-text-muted'
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}
