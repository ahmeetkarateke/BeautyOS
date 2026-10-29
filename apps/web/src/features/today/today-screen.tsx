'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { fetchDayAppointments, fetchPendingRequests, fetchServiceCount, fetchStaff, setAppointmentStatus } from '@/features/appointments/api'
import { AppointmentCard } from '@/features/appointments/appointment-card'
import {
  addDaysToDateStr,
  clockLabel,
  istanbulDateStr,
  istanbulMinutes,
  minutesLabel,
  occupancyPercent,
  pendingRequests,
  staffState,
  stripRange,
  upNext,
  type DayAppointment,
} from '@/features/appointments/day-logic'
import { OccupancyStrip } from '@/features/appointments/occupancy-strip'
import { attachStaff, type StaffMember } from '@/features/appointments/staff'
import { toneClasses } from '@/features/appointments/tones'
import { untilLabel } from '@/features/appointments/until-label'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useCan, useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button, buttonClassName } from '@/ui/button'
import { Card } from '@/ui/card'
import { Chip, ChipRow } from '@/ui/chip'
import { cn } from '@/ui/cn'
import { formatDate } from '@/ui/format'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState } from '@/ui/states'
import { StatusBadge } from '@/ui/status-badge'
import { useToast } from '@/ui/toast'
import { CompleteSheet } from '@/features/payment/complete-sheet'
import { QuickSaleSheet } from '@/features/payment/quick-sale-sheet'
import { ApprovalSheet } from './approval-sheet'
import { DaySummary } from './day-summary'
import { FirstSetup } from './first-setup'
import { buildSetupSteps, needsSetup } from './setup-steps'

// Bugün (tasarim.md §8.1 `bugun`): "Sırada kim var, kimde boş yer var?" Sahip ve müdür görür; uzman Günüm'e yönlenir.
// Randevu ayrıntısı (W14) ve randevu oluşturma (W13) hazır olana dek ilgili adrese gidilir; o ekranlar "hazırlanıyor" bilgisini gösterir.
const MINUTE = 60_000
const PENDING_DAYS = 14

function useClock(fixed?: Date): Date {
  const [now, setNow] = useState(() => fixed ?? new Date())
  useEffect(() => {
    if (fixed) return
    const id = setInterval(() => setNow(new Date()), MINUTE)
    return () => clearInterval(id)
  }, [fixed])
  return now
}

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

function freeSentence(staff: readonly StaffMember[], appointments: readonly DayAppointment[], nowMin: number, range: ReturnType<typeof stripRange>): string {
  const free = staff.flatMap((person) => {
    const state = staffState(appointments, person.id, nowMin, range)
    return state.kind === 'free' ? [`${person.short} (${untilLabel(state.until)})`] : []
  })
  return free.length ? free.join(', ') : 'kimse yok'
}

export function TodayScreen({ now: fixedNow }: { now?: Date }) {
  const me = useMe()
  const slug = me.tenant.slug
  const router = useRouter()
  const client = useApiClient()
  const toast = useToast()
  const canApprove = useCan('appointment.approve')
  const canRevenue = useCan('dashboard.revenue')
  const isExpert = me.role === 'staff'
  const clock = useClock(fixedNow)
  const today = istanbulDateStr(clock)
  const nowMin = istanbulMinutes(clock)
  const base = `/panel/${encodeURIComponent(slug)}`

  const [filter, setFilter] = useState('')
  const [reviewing, setReviewing] = useState<DayAppointment | null>(null)
  const [completing, setCompleting] = useState<DayAppointment | null>(null)
  const [quickSale, setQuickSale] = useState(false)
  const canQuickSale = useCan('finance.revenue.create')
  const [startingId, setStartingId] = useState<string | null>(null)

  const dayQuery = useApiQuery(isExpert ? null : `day:${today}`, (c, signal) => fetchDayAppointments(c, slug, today, signal))
  const pendingQuery = useApiQuery(isExpert || !canApprove ? null : `pending:${today}`, (c, signal) => fetchPendingRequests(c, slug, today, addDaysToDateStr(today, PENDING_DAYS), signal))
  const staffQuery = useApiQuery(isExpert ? null : 'staff', (c, signal) => fetchStaff(c, slug, signal))
  const dayLoaded = dayQuery.data !== undefined
  const dayEmpty = dayQuery.data !== undefined && dayQuery.data.length === 0
  // Hizmet sayısı yalnız kurulum listesi gerekebilecek (boş gün) durumda istenir.
  const servicesQuery = useApiQuery(dayEmpty ? 'services' : null, (c, signal) => fetchServiceCount(c, slug, signal))

  useEffect(() => {
    if (isExpert) router.replace(`${base}/gunum`)
  }, [isExpert, router, base])

  const staff = useMemo(() => staffQuery.data ?? [], [staffQuery.data])
  const appointments = useMemo(() => (dayQuery.data ? attachStaff(dayQuery.data, staff) : []), [dayQuery.data, staff])
  const stripStaff = useMemo(() => {
    const serving = staff.filter((s) => s.givesService)
    return serving.length > 0 ? serving : staff
  }, [staff])
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff])

  if (isExpert) return null

  const range = stripRange(appointments)
  const pending = pendingRequests(pendingQuery.data ?? [])
  const requestLabel = (r: DayAppointment) => (istanbulDateStr(r.start) === today ? clockLabel(r.start) : `${formatDate(r.start, 'short')} ${clockLabel(r.start)}`)
  const occupancy = occupancyPercent(appointments, stripStaff.length, range)

  async function start(appointment: DayAppointment) {
    setStartingId(appointment.id)
    try {
      await setAppointmentStatus(client, slug, appointment.id, 'in_progress')
      toast.show({ message: 'Randevu başladı.' })
      dayQuery.refetch()
    } catch (err) {
      toast.show({ message: (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text(), tone: 'error' })
    } finally {
      setStartingId(null)
    }
  }

  const openAppointment = (id: string) => {
    const found = appointments.find((a) => a.id === id)
    if (found?.status === 'pending' && canApprove) setReviewing(found)
    else router.push(`${base}/takvim?randevu=${encodeURIComponent(id)}`)
  }
  const createAppointment = () => router.push(`${base}/takvim?yeni=1`)
  const pickFree = (staffId: string, time: string) =>
    router.push(`${base}/takvim?yeni=1&personel=${encodeURIComponent(staffId)}&saat=${encodeURIComponent(time)}`)

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-0.5">
        <h1 className="text-xl leading-7 font-semibold">Bugün</h1>
        <p className="text-sm text-text-muted">
          {formatDate(clock, 'weekday')}, {formatDate(clock, 'long')} · Saat {minutesLabel(nowMin)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canQuickSale ? (
          <Button variant="secondary" onClick={() => setQuickSale(true)}>
            Randevusuz işlem
          </Button>
        ) : null}
        <Link href={`${base}/takvim?yeni=1`} className={cn(buttonClassName(), 'max-lg:hidden')}>
          Randevu oluştur
        </Link>
      </div>
    </div>
  )

  // Bekleyen online talepler gün boş olsa da görünür: ileri tarihli talepler süresi dolunca sessizce düşmesin.
  const pendingBanners = (
    <>
      {canApprove && pendingQuery.error && !pendingQuery.data ? (
        <div data-testid="bugun-bulgu">
          <Banner tone="error" action={{ label: 'Yeniden dene', onClick: pendingQuery.refetch }}>
            Bekleyen online talepler yüklenemedi.
          </Banner>
        </div>
      ) : null}

      {canApprove && pending.length > 0 ? (
        <div data-testid="bugun-bulgu">
          <Banner tone="warning" action={{ label: 'Gözden geçir', onClick: () => setReviewing(pending[0]) }}>
            <strong>{pending.length} online randevu onay bekliyor.</strong> {pending.map((r) => `${r.customerName} ${requestLabel(r)}`).join(', ')}.
          </Banner>
        </div>
      ) : null}
    </>
  )
  const approvalSheet = (
    <>
      <ApprovalSheet request={reviewing} onClose={() => setReviewing(null)} onChanged={() => {
          dayQuery.refetch()
          pendingQuery.refetch()
        }} />
      {quickSale ? (
        <QuickSaleSheet
          onClose={() => setQuickSale(false)}
          onDone={() => {
            setQuickSale(false)
            dayQuery.refetch()
          }}
        />
      ) : null}
      {completing ? (
        <CompleteSheet
          appointment={completing}
          onClose={() => setCompleting(null)}
          onStale={dayQuery.refetch}
          onDone={() => {
            setCompleting(null)
            dayQuery.refetch()
          }}
        />
      ) : null}
    </>
  )

  if (dayQuery.error && !dayLoaded) {
    return (
      <div className="grid gap-4">
        {header}
        <Card>
          <ErrorState subject="Bugünün randevuları" onRetry={dayQuery.refetch} retrying={dayQuery.loading} lastLoadedAt={dayQuery.loadedAt} className="px-0" />
        </Card>
        {pendingBanners}
        {approvalSheet}
        {canRevenue ? (
          <Card>
            <h2 className="mb-1 text-base leading-6 font-semibold">Kasa özeti</h2>
            <p className="text-sm text-text-secondary">Randevular yüklenmeden kasa özeti gösterilmez. Sıfır gibi görünen tutarlar yanıltıcı olur.</p>
          </Card>
        ) : null}
      </div>
    )
  }

  if (staffQuery.error && !staffQuery.data) {
    return (
      <div className="grid gap-4">
        {header}
        <Card>
          <ErrorState subject="Personel listesi" onRetry={staffQuery.refetch} retrying={staffQuery.loading} lastLoadedAt={staffQuery.loadedAt} className="px-0" />
        </Card>
        {pendingBanners}
        {approvalSheet}
      </div>
    )
  }

  if (!dayLoaded || !staffQuery.data) {
    return (
      <div className="grid gap-4">
        {header}
        <SkeletonGroup className="grid gap-4">
          {[0, 1, 2].map((i) => (
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

  if (dayEmpty) {
    const steps = buildSetupSteps({ slug, serviceCount: servicesQuery.data ?? 1, staffCount: staff.length, todayAppointmentCount: 0 })
    const showSetup = servicesQuery.data !== undefined && needsSetup(steps)
    return (
      <div className="grid gap-4">
        {header}
        {pendingBanners}
        {showSetup ? <FirstSetup steps={steps} onCreateAppointment={createAppointment} /> : null}
        <Card labelledBy="bugun-liste-baslik">
          <h2 id="bugun-liste-baslik" className="text-base leading-6 font-semibold">
            Günün randevuları
          </h2>
          <EmptyState
            icon={undefined}
            title="Bugün randevu yok."
            description="Telefonla gelen ilk randevuyu buradan girin; takvimde hemen görünür."
            action={{ label: 'Randevu oluştur', onClick: createAppointment }}
            className="px-0"
          />
        </Card>
        {approvalSheet}
      </div>
    )
  }

  const queue = upNext(appointments, nowMin)
  const visible = [...appointments].sort((a, b) => a.start.getTime() - b.start.getTime()).filter((a) => filter === '' || a.staffKey === filter)
  const staffShort = (a: DayAppointment) => staffById.get(a.staffKey)?.short ?? firstWord(a.staffName)
  const toneOf = (a: DayAppointment) => staffById.get(a.staffKey)?.tone ?? 1
  const liveCount = (id: string) => appointments.filter((a) => a.staffKey === id && a.status !== 'cancelled').length

  return (
    <div className="grid gap-4">
      {header}

      {pendingBanners}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <Card labelledBy="bugun-sirada-baslik">
            <h2 id="bugun-sirada-baslik" className="mb-2 text-base leading-6 font-semibold">
              Şimdi ve sırada
            </h2>
            {queue.length === 0 ? (
              <p className="text-base text-text-secondary">Bugün için bekleyen randevu kalmadı.</p>
            ) : (
              <ul className="m-0 grid list-none divide-y divide-border-subtle p-0">
                {queue.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2">
                    <span aria-hidden="true" className={cn('inline-grid size-9 flex-none place-items-center rounded-full text-xs font-semibold', toneClasses[toneOf(a)].avatar)}>
                      {staffById.get(a.staffKey)?.initials ?? '?'}
                    </span>
                    <button type="button" onClick={() => openAppointment(a.id)} className="grid min-w-0 flex-1 cursor-pointer gap-0.5 bg-transparent p-0 text-left text-text">
                      <span className="truncate font-medium">
                        <span className="tabular-nums">{clockLabel(a.start)}</span> · {a.customerName}
                      </span>
                      <span className="truncate text-sm text-text-muted">
                        {a.serviceName} · {staffShort(a)}
                        {a.status === 'in_progress' ? ` · ${untilLabel(clockLabel(a.end))}` : ''}
                      </span>
                    </button>
                    <div className="grid flex-none justify-items-end gap-1.5">
                      <StatusBadge status={a.status} />
                      {a.status === 'confirmed' ? (
                        <Button size="sm" variant="secondary" loading={startingId === a.id} loadingText="Başlatılıyor…" onClick={() => void start(a)}>
                          Başlat
                        </Button>
                      ) : a.status === 'in_progress' ? (
                        <Button size="sm" variant="secondary" onClick={() => setCompleting(a)}>
                          Tamamla
                        </Button>
                      ) : a.status === 'pending' && canApprove ? (
                        <Button size="sm" variant="secondary" onClick={() => setReviewing(a)}>
                          Gözden geçir
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card labelledBy="bugun-serit-baslik">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="bugun-serit-baslik" className="text-base leading-6 font-semibold">
                Personelin günü
              </h2>
              <span className="text-xs text-text-muted">Boş saate dokunun.</span>
            </div>
            <div className="grid gap-3">
              <p data-testid="simdi-bos" className="text-sm">
                <strong>Şu an boş:</strong> {freeSentence(stripStaff, appointments, nowMin, range)}.
              </p>
              <OccupancyStrip staff={stripStaff} appointments={appointments} range={range} nowMin={nowMin} onOpenAppointment={openAppointment} onPickFree={pickFree} />
            </div>
          </Card>

          <Card labelledBy="bugun-liste-baslik">
            <h2 id="bugun-liste-baslik" className="mb-3 text-base leading-6 font-semibold">
              Günün randevuları <span className="font-normal text-text-muted tabular-nums">{appointments.length}</span>
            </h2>
            <ChipRow aria-label="Personele göre süz" className="mb-3">
              <Chip pressed={filter === ''} onToggle={() => setFilter('')} count={appointments.length}>
                Tümü
              </Chip>
              {stripStaff.map((p) => (
                <Chip key={p.id} pressed={filter === p.id} onToggle={() => setFilter(filter === p.id ? '' : p.id)} count={liveCount(p.id)}>
                  {p.short}
                </Chip>
              ))}
            </ChipRow>
            <div className="grid gap-2">
              {visible.map((a) => (
                <AppointmentCard key={a.id} appointment={a} tone={toneOf(a)} staffShort={staffShort(a)} onOpen={openAppointment} />
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-4">{canRevenue ? <DaySummary appointments={appointments} occupancy={occupancy} /> : null}</div>
      </div>

      {approvalSheet}
    </div>
  )
}
