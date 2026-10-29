'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Phone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchDayAppointments, setAppointmentStatus } from '@/features/appointments/api'
import { AppointmentCard } from '@/features/appointments/appointment-card'
import { clockLabel, istanbulDateStr, istanbulMinutes, minutesLabel, upNext, type DayAppointment } from '@/features/appointments/day-logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Button, buttonClassName } from '@/ui/button'
import { Card } from '@/ui/card'
import { cn } from '@/ui/cn'
import { formatDate } from '@/ui/format'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState } from '@/ui/states'
import { StatusBadge } from '@/ui/status-badge'
import { SummaryStrip } from '@/ui/summary-strip'
import { useToast } from '@/ui/toast'

// Günüm (tasarim.md §8.1 `gunum`, uzman): "Sıradaki kim?" Yalnız kendi randevuları (sunucu da kapsamı zorlar).
// İzinlerim için uç yok: "Yakında". Fiyat alanı uzmanda salt okunurdur (R3); bu ekran fiyat göstermez/değiştirmez.
const MINUTE = 60_000

function useClock(fixed?: Date): Date {
  const [now, setNow] = useState(() => fixed ?? new Date())
  useEffect(() => {
    if (fixed) return
    const id = setInterval(() => setNow(new Date()), MINUTE)
    return () => clearInterval(id)
  }, [fixed])
  return now
}

const minutesOf = (a: DayAppointment) => Math.round((a.end.getTime() - a.start.getTime()) / MINUTE)
const telHref = (phone: string) => `tel:${phone.replace(/\s/g, '')}`

function timeLeftText(a: DayAppointment, nowMin: number): string {
  if (a.status === 'in_progress') return 'Devam ediyor'
  const left = istanbulMinutes(a.start) - nowMin
  return left > 0 ? `${left} dk sonra` : 'Başlama saati geldi'
}

export function MyDayScreen({ now: fixedNow }: { now?: Date }) {
  const me = useMe()
  const slug = me.tenant.slug
  const staffId = me.staffId
  const router = useRouter()
  const client = useApiClient()
  const toast = useToast()
  const clock = useClock(fixedNow)
  const today = istanbulDateStr(clock)
  const nowMin = istanbulMinutes(clock)
  const base = `/panel/${encodeURIComponent(slug)}`
  const [startingId, setStartingId] = useState<string | null>(null)

  const day = useApiQuery(staffId ? `my-day:${staffId}:${today}` : null, (c, signal) => fetchDayAppointments(c, slug, today, signal, staffId ?? undefined))

  async function start(appointment: DayAppointment) {
    setStartingId(appointment.id)
    try {
      await setAppointmentStatus(client, slug, appointment.id, 'in_progress')
      toast.show({ message: 'Randevu başladı.' })
      day.refetch()
    } catch (err) {
      toast.show({ message: (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text(), tone: 'error' })
    } finally {
      setStartingId(null)
    }
  }

  // Randevu ayrıntısı W14'te; o zamana dek takvim adresi ("hazırlanıyor" bilgisi).
  const openAppointment = (id: string) => router.push(`${base}/takvim?randevu=${encodeURIComponent(id)}`)

  const appointments = day.data ?? []
  const sorted = [...appointments].sort((a, b) => a.start.getTime() - b.start.getTime())
  const active = sorted.filter((a) => a.status !== 'cancelled')
  const next = upNext(appointments, nowMin, 1)[0]

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-0.5">
        <h1 className="text-xl leading-7 font-semibold">Günüm</h1>
        <p className="text-sm text-text-muted">
          {formatDate(clock, 'weekday')}, {formatDate(clock, 'long')} · Saat {minutesLabel(nowMin)}
          {day.data ? ` · ${active.length} randevu` : ''}
        </p>
      </div>
      <Link href={`${base}/takvim?yeni=1`} className={cn(buttonClassName(), 'max-lg:hidden')}>
        Randevu oluştur
      </Link>
    </div>
  )

  if (!staffId) {
    return (
      <div className="grid gap-4">
        {header}
        <Card>
          <EmptyState
            title="Bu hesapta uzman profili yok."
            description="Günüm yalnız uzman profili olan hesaplarda çalışır."
            action={{ label: 'Bugün’e dön', onClick: () => router.push(`${base}/bugun`) }}
            className="px-0"
          />
        </Card>
      </div>
    )
  }

  if (day.error && !day.data) {
    return (
      <div className="grid gap-4">
        {header}
        <Card>
          <ErrorState subject="Randevularınız" onRetry={day.refetch} retrying={day.loading} lastLoadedAt={day.loadedAt} className="px-0" />
        </Card>
      </div>
    )
  }

  if (!day.data) {
    return (
      <div className="grid gap-4">
        {header}
        <SkeletonGroup className="grid gap-4">
          {[0, 1].map((i) => (
            <Card key={i}>
              <div className="grid gap-3">
                <Skeleton className="w-1/3" />
                <Skeleton />
                <Skeleton className="w-2/3" />
              </div>
            </Card>
          ))}
        </SkeletonGroup>
      </div>
    )
  }

  if (active.length === 0) {
    return (
      <div className="grid gap-4">
        {header}
        <Card>
          <EmptyState
            title="Bugün randevunuz yok."
            description="Yeni randevu gelince burada sırayla görünür."
            action={{ label: 'Randevu oluştur', onClick: () => router.push(`${base}/takvim?yeni=1`) }}
            className="px-0"
          />
        </Card>
      </div>
    )
  }

  const done = active.filter((a) => a.status === 'completed').length
  const remaining = active.filter((a) => ['pending', 'confirmed', 'in_progress'].includes(a.status)).length

  return (
    <div className="grid gap-4">
      {header}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          {next ? (
            <section data-testid="gunum-siradaki" aria-labelledby="gunum-siradaki-baslik" className="grid gap-3 rounded-card border border-accent-mark bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 id="gunum-siradaki-baslik" className="text-base leading-6 font-semibold">
                  {next.status === 'in_progress' ? 'Şimdi' : 'Sıradaki'}
                </h2>
                <span className="text-sm font-medium text-accent-text">{timeLeftText(next, nowMin)}</span>
              </div>
              <div className="grid gap-0.5">
                <p className="text-2xl leading-8 font-semibold tabular-nums">
                  {clockLabel(next.start)} – {clockLabel(next.end)}
                </p>
                <p className="text-xl leading-7 font-medium">{next.customerName}</p>
                <p className="text-text-secondary">
                  {next.serviceName} · {minutesOf(next)} dk
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {next.status === 'confirmed' ? (
                  <Button className="flex-1" loading={startingId === next.id} loadingText="Başlatılıyor…" onClick={() => void start(next)}>
                    Başlat
                  </Button>
                ) : null}
                {next.customerPhone ? (
                  <a href={telHref(next.customerPhone)} aria-label={`${next.customerName}’yi ara`} className={cn(buttonClassName({ variant: 'secondary' }), next.status !== 'confirmed' && 'flex-1')}>
                    <Phone aria-hidden="true" className="size-4" />
                    Ara
                  </a>
                ) : null}
                <Button variant="secondary" onClick={() => openAppointment(next.id)}>
                  Ayrıntılar
                </Button>
              </div>
            </section>
          ) : null}

          <Card labelledBy="gunum-sira-baslik">
            <h2 id="gunum-sira-baslik" className="mb-3 text-base leading-6 font-semibold">
              Günün sırası
            </h2>
            <div className="grid gap-2">
              {sorted.map((a) => (
                <AppointmentCard key={a.id} appointment={a} tone={1} showStaff={false} onOpen={openAppointment} />
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card labelledBy="gunum-ozet-baslik">
            <h2 id="gunum-ozet-baslik" className="mb-3 text-base leading-6 font-semibold">
              Bugün
            </h2>
            <SummaryStrip
              className="lg:grid-cols-2"
              items={[
                { label: 'Tamamlanan', value: done },
                { label: 'Kalan', value: remaining },
              ]}
            />
          </Card>
          <Card labelledBy="gunum-izin-baslik">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="gunum-izin-baslik" className="text-base leading-6 font-semibold">
                İzinlerim
              </h2>
              <StatusBadge status="soon" />
            </div>
            <p className="text-sm text-text-secondary">İzinleriniz yakında burada görünecek. Değişiklik için salon sahibine yazın.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
