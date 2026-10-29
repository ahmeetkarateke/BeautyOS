'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchRangeAppointments, fetchStaff } from '@/features/appointments/api'
import { addDaysToDateStr, istanbulDateStr, istanbulMinutes, stripRange, type DayAppointment } from '@/features/appointments/day-logic'
import { attachStaff, type StaffMember } from '@/features/appointments/staff'
import { toneForIndex } from '@/features/appointments/tones'
import { ApprovalSheet } from '@/features/today/approval-sheet'
import { useCan, useMe } from '@/lib/v2/session'
import { useMediaQuery } from '@/lib/v2/use-media-query'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { getInitials } from '@/ui/avatar'
import { buttonClassName, Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Chip, ChipRow } from '@/ui/chip'
import { cn } from '@/ui/cn'
import { SelectField } from '@/ui/field'
import { SegmentedControl } from '@/ui/segmented-control'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState } from '@/ui/states'
import { STATUS_LABELS } from '@/ui/status-badge'
import { AppointmentDetailSheet } from '@/features/appointment-detail/detail-sheet'
import { CreateAppointmentSheet } from '@/features/appointment-create/create-sheet'
import { monthGrid, parseDateParam, parseView, rangeFor, weekDays, type CalendarView } from './calendar-logic'
import { DayGrid } from './day-grid'
import { DayTimeline } from './day-timeline'
import { MonthView, WeekSummary } from './period-views'

// Takvim (tasarim.md §4, §8.1 `takvim`): telefonda saat çizelgesi, masaüstünde personel sütunlu gün ızgarası, hafta özeti, ay.
// Durum adresten okunur (?gorunum=gun|hafta|ay&tarih=YYYY-MM-DD): bağlantı paylaşılabilir, geri düğmesi çalışır.
// Hafta ve ay yalnız masaüstündedir (telefonda gün görünümü). Randevu ayrıntısı/saat değiştirme W14, oluşturma W13.
const MINUTE = 60_000
const DESKTOP = '(min-width: 1024px)'

function firstWord(name: string): string {
  return name.trim().split(' ')[0] || name
}
const VIEW_OPTIONS = [
  { value: 'gun', label: 'Gün' },
  { value: 'hafta', label: 'Hafta' },
  { value: 'ay', label: 'Ay' },
] as const
const STATUS_OPTIONS = Object.entries(STATUS_LABELS)

const noon = (date: string) => new Date(`${date}T12:00:00+03:00`)
const longDay = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })
const monthTitle = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })
const weekdayShort = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'Europe/Istanbul' })
const dayNo = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', timeZone: 'Europe/Istanbul' })

function useClock(fixed?: Date): Date {
  const [now, setNow] = useState(() => fixed ?? new Date())
  useEffect(() => {
    if (fixed) return
    const id = setInterval(() => setNow(new Date()), MINUTE)
    return () => clearInterval(id)
  }, [fixed])
  return now
}

function stepDate(view: CalendarView, date: string, direction: 1 | -1): string {
  if (view === 'gun') return addDaysToDateStr(date, direction)
  if (view === 'hafta') return addDaysToDateStr(date, 7 * direction)
  const grid = monthGrid(date)
  return direction === 1 ? addDaysToDateStr(grid.last, 1) : addDaysToDateStr(grid.first, -1)
}

function headingFor(view: CalendarView, date: string): string {
  if (view === 'gun') return longDay.format(noon(date))
  if (view === 'hafta') {
    const days = weekDays(date)
    return `${dayNo.format(noon(days[0]))} – ${longDay.format(noon(days[6]))}`
  }
  return monthTitle.format(noon(date))
}

const UNIT: Record<CalendarView, string> = { gun: 'gün', hafta: 'hafta', ay: 'ay' }

export function CalendarScreen({ now: fixedNow }: { now?: Date }) {
  const me = useMe()
  const slug = me.tenant.slug
  const router = useRouter()
  const params = useSearchParams()
  const desktop = useMediaQuery(DESKTOP)
  const canApprove = useCan('appointment.approve')
  const isExpert = me.role === 'staff'
  const clock = useClock(fixedNow)
  const today = istanbulDateStr(clock)
  const nowMin = istanbulMinutes(clock)
  const base = `/panel/${encodeURIComponent(slug)}/takvim`

  const date = parseDateParam(params.get('tarih'), today)
  const view: CalendarView = desktop ? parseView(params.get('gorunum')) : 'gun'
  const range = rangeFor(view, date)
  const ownId = isExpert ? me.staffId : null

  const [staffFilter, setStaffFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewing, setReviewing] = useState<DayAppointment | null>(null)
  const [peeking, setPeeking] = useState<DayAppointment | null>(null)

  const list = useApiQuery(isExpert && !ownId ? null : `cal:${range.from}:${range.to}:${ownId ?? ''}`, (c, signal) => fetchRangeAppointments(c, slug, range.from, range.to, ownId ?? undefined, signal))
  const staffQuery = useApiQuery(isExpert ? null : 'staff', (c, signal) => fetchStaff(c, slug, signal))

  // Sütunlar: hizmet verenler + (hizmeti kaldırılmış olsa da) randevusu olanlar + listede hiç olmayanlar.
  // Böylece hiçbir randevu ızgarada sessizce kaybolmaz.
  const { staff, appointments } = useMemo(() => {
    if (isExpert) {
      const own: StaffMember[] = ownId ? [{ id: ownId, name: me.user.name, short: firstWord(me.user.name), title: '', initials: getInitials(me.user.name), tone: 1, givesService: true }] : []
      return { staff: own, appointments: list.data ? attachStaff(list.data, own) : [] }
    }
    const all = staffQuery.data ?? []
    const mapped = list.data ? attachStaff(list.data, all) : []
    const used = new Set(mapped.filter((a) => a.status !== 'cancelled').map((a) => a.staffKey))
    const columns = all.some((s) => s.givesService) ? all.filter((s) => s.givesService || used.has(s.id)) : [...all]
    const known = new Set(all.map((s) => s.id))
    const orphans = new Map<string, string>()
    for (const a of mapped) if (a.status !== 'cancelled' && !known.has(a.staffKey)) orphans.set(a.staffKey, a.staffName)
    for (const [key, name] of orphans) {
      columns.push({ id: key, name, short: firstWord(name), title: '', initials: getInitials(name), tone: toneForIndex(columns.length), givesService: false })
    }
    return { staff: columns, appointments: mapped }
  }, [isExpert, ownId, me.user.name, staffQuery.data, list.data])
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff])

  // `href` her zaman açık tarih taşır (paylaşılabilir bağlantı); `null` tarih = bugün (adreste parametre yok).
  const href = (v: CalendarView, d: string | null, extra?: Record<string, string>) => {
    const q = new URLSearchParams(extra)
    if (v !== 'gun') q.set('gorunum', v)
    if (d) q.set('tarih', d)
    const text = q.toString()
    return text ? `${base}?${text}` : base
  }
  const go = (v: CalendarView, d: string | null) => router.replace(href(v, d))
  const dayHref = (d: string) => href('gun', d)

  const create = (personel?: string, time?: string) => {
    const q = new URLSearchParams({ yeni: '1' })
    if (personel) q.set('personel', personel)
    if (time) q.set('saat', time)
    q.set('tarih', date)
    return `${base}?${q.toString()}`
  }

  const openAppointment = (id: string) => {
    const found = appointments.find((a) => a.id === id)
    if (!found) return
    if (found.status === 'pending' && canApprove) setReviewing(found)
    else setPeeking(found)
  }

  const dayAppointments = appointments.filter((a) => a.status !== 'cancelled')
  const stripDays = weekDays(date)
  const filtered = appointments.filter((a) => (!staffFilter || a.staffKey === staffFilter) && (!statusFilter || a.status === statusFilter))

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="grid gap-0.5">
        <h1 className="text-xl leading-7 font-semibold">{isExpert ? 'Takvimim' : 'Takvim'}</h1>
        <p className="text-sm text-text-muted">{headingFor(view, date)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {desktop ? <SegmentedControl aria-label="Görünüm" options={VIEW_OPTIONS} value={view} onValueChange={(v) => go(v as CalendarView, date === today ? null : date)} /> : null}
        <Link href={create()} className={cn(buttonClassName(), 'max-lg:hidden')}>
          Randevu oluştur
        </Link>
      </div>
    </div>
  )

  const navigation = (
    <div className="flex items-center gap-2">
      <Button variant="icon" aria-label={`Önceki ${UNIT[view]}`} icon={<ChevronLeft aria-hidden="true" className="size-5" />} onClick={() => go(view, stepDate(view, date, -1))} />
      {view === 'gun' ? (
        <div role="group" aria-label="Gün seçin" className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&_:focus-visible]:-outline-offset-2 [&::-webkit-scrollbar]:hidden">
          {stripDays.map((d) => (
            <button
              key={d}
              type="button"
              aria-current={d === date ? 'date' : undefined}
              aria-label={`${weekdayShort.format(noon(d))} ${dayNo.format(noon(d))}`}
              onClick={() => go('gun', d === today ? null : d)}
              className={cn(
                'grid min-h-12 min-w-11 flex-1 cursor-pointer place-items-center rounded-control border px-1 text-sm',
                d === date ? 'border-text bg-text text-text-inverse' : 'border-border bg-surface text-text-secondary hover:border-text-muted',
              )}
            >
              <span className="text-xs opacity-75">{weekdayShort.format(noon(d))}</span>
              <span className="font-semibold tabular-nums">{dayNo.format(noon(d))}</span>
            </button>
          ))}
        </div>
      ) : (
        <span className="flex-1" />
      )}
      <Button variant="icon" aria-label={`Sonraki ${UNIT[view]}`} icon={<ChevronRight aria-hidden="true" className="size-5" />} onClick={() => go(view, stepDate(view, date, 1))} />
      {date !== today || view !== 'gun' ? (
        <Button variant="secondary" size="sm" onClick={() => go(view, null)}>
          Bugün
        </Button>
      ) : null}
    </div>
  )

  let body
  if (list.error && !list.data) {
    body = (
      <Card>
        <ErrorState subject="Takvim" onRetry={list.refetch} retrying={list.loading} lastLoadedAt={list.loadedAt} className="px-0" />
      </Card>
    )
  } else if (isExpert && !ownId) {
    body = (
      <Card>
        <EmptyState title="Uzman profiliniz bağlı değil." description="Hesabınıza bir uzman profili bağlanınca takviminiz burada görünür. Salon yöneticinizle görüşün." centered />
      </Card>
    )
  } else if (staffQuery.error && !staffQuery.data) {
    body = (
      <Card>
        <ErrorState subject="Personel listesi" onRetry={staffQuery.refetch} retrying={staffQuery.loading} lastLoadedAt={staffQuery.loadedAt} className="px-0" />
      </Card>
    )
  } else if (!list.data || (!isExpert && !staffQuery.data)) {
    body = (
      <SkeletonGroup className="grid gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="grid gap-3">
              <Skeleton className="w-1/4" />
              <Skeleton className="w-2/3" />
            </div>
          </Card>
        ))}
      </SkeletonGroup>
    )
  } else if (view === 'hafta') {
    body = <WeekSummary staff={staff} appointments={appointments} date={date} today={today} dayHref={dayHref} />
  } else if (view === 'ay') {
    body = <MonthView appointments={appointments} date={date} today={today} dayHref={dayHref} />
  } else if (dayAppointments.length === 0) {
    body = (
      <Card>
        <EmptyState title="Bu gün için randevu yok." action={{ label: 'Randevu oluştur', onClick: () => router.push(create()) }} centered />
      </Card>
    )
  } else if (desktop) {
    body = (
      <>
        <DayGrid
          staff={staff}
          appointments={appointments}
          range={stripRange(dayAppointments)}
          nowMin={nowMin}
          showNow={date === today}
          onOpen={openAppointment}
          onPickFree={(personel, time) => router.push(create(personel, time))}
        />
        <p className="text-xs text-text-muted">Boş bir saate tıklayınca randevu oluşturulur. Klavye için “Randevu oluştur” bağlantısını kullanın.</p>
      </>
    )
  } else {
    body = (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {!isExpert && staff.length > 0 ? (
          <ChipRow aria-label="Personel">
            <Chip pressed={staffFilter === ''} onToggle={() => setStaffFilter('')}>
              Tümü
            </Chip>
            {staff.map((s) => (
              <Chip key={s.id} pressed={staffFilter === s.id} onToggle={() => setStaffFilter(staffFilter === s.id ? '' : s.id)}>
                {s.short}
              </Chip>
            ))}
          </ChipRow>
        ) : null}
        <SelectField label="Durum" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Tümü</option>
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <DayTimeline
          appointments={filtered}
          range={stripRange(dayAppointments)}
          staffById={staffById}
          showStaff={!isExpert}
          onOpen={openAppointment}
          onPickFree={(time) => router.push(create(staffFilter || undefined, time))}
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {header}
      {navigation}
      {body}
      <ApprovalSheet request={reviewing} onClose={() => setReviewing(null)} onChanged={list.refetch} />
      <CreateAppointmentSheet
        open={params.get('yeni') === '1'}
        onOpenChange={(open) => {
          if (!open) go(view, date === today ? null : date)
        }}
        today={today}
        onCreated={list.refetch}
        initial={{ staffId: params.get('personel') ?? undefined, time: params.get('saat') ?? undefined, date: params.get('tarih') ? date : undefined }}
      />
      <AppointmentDetailSheet appointment={peeking} today={today} onClose={() => setPeeking(null)} onChanged={list.refetch} />
    </div>
  )
}
