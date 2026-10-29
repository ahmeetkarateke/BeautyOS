import Link from 'next/link'
import type { DayAppointment } from '@/features/appointments/day-logic'
import type { StaffMember } from '@/features/appointments/staff'
import { toneClasses } from '@/features/appointments/tones'
import { cn } from '@/ui/cn'
import { monthGrid, weekDays, countByDay, countByStaffDay } from './calendar-logic'

// Haftalık özet (personel x gün sayısı) ve ay görünümü (gün başına sayı). Hücre bağlantısı o günün gün görünümünü açar.
const noon = (date: string) => new Date(`${date}T12:00:00+03:00`)
const weekdayShort = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'Europe/Istanbul' })
const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' })
const dayNo = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', timeZone: 'Europe/Istanbul' })
const WEEKDAY_HEADS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

export function WeekSummary({
  staff,
  appointments,
  date,
  today,
  dayHref,
}: {
  staff: readonly StaffMember[]
  appointments: readonly DayAppointment[]
  date: string
  today: string
  dayHref: (day: string) => string
}) {
  const days = weekDays(date)
  const counts = countByStaffDay(appointments)
  return (
    <div className="overflow-x-auto clip-safe rounded-card border border-border bg-surface [&_:focus-visible]:-outline-offset-2">
      <table className="w-full border-collapse text-base">
        <caption className="sr-only">Haftalık özet: personel ve gün başına randevu sayısı</caption>
        <thead>
          <tr className="border-b border-border text-sm text-text-muted">
            <th scope="col" className="px-4 py-2 text-left font-medium">
              Personel
            </th>
            {days.map((day) => (
              <th key={day} scope="col" className={cn('px-3 py-2 text-right font-medium tabular-nums', day === today && 'text-text')}>
                <Link href={dayHref(day)} className="text-inherit no-underline hover:underline">
                  {weekdayShort.format(noon(day))} {dayNo.format(noon(day))}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staff.map((person) => (
            <tr key={person.id} className="border-b border-border-subtle last:border-b-0">
              <th scope="row" className="px-4 py-2 text-left text-sm font-medium">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className={cn('inline-grid size-6 place-items-center rounded-full text-xs font-semibold', toneClasses[person.tone].avatar)}>
                    {person.initials}
                  </span>
                  {person.short}
                </span>
              </th>
              {days.map((day) => (
                <td key={day} className="px-3 py-2 text-right tabular-nums">
                  {counts[person.id]?.[day] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function MonthView({ appointments, date, today, dayHref }: { appointments: readonly DayAppointment[]; date: string; today: string; dayHref: (day: string) => string }) {
  const grid = monthGrid(date)
  const counts = countByDay(appointments)
  return (
    <div role="group" aria-label="Ay görünümü" className="grid grid-cols-7 overflow-hidden clip-safe rounded-card border border-border bg-surface [&_:focus-visible]:-outline-offset-2">
      {WEEKDAY_HEADS.map((name) => (
        <div key={name} aria-hidden="true" className="px-2 py-2 text-sm text-text-muted">
          {name}
        </div>
      ))}
      {Array.from({ length: grid.leading }, (_, i) => (
        <div key={`blank-${i}`} aria-hidden="true" className="min-h-19 border-t border-l border-border-subtle" />
      ))}
      {grid.days.map((day) => {
        const count = counts[day] ?? 0
        return (
          <Link
            key={day}
            href={dayHref(day)}
            className={cn('grid min-h-19 content-between border-t border-l border-border-subtle p-2 text-text no-underline hover:bg-surface-subtle', day === today && 'bg-primary-soft')}
          >
            {/* aria-label yok: görünür metin adın parçası olsun (axe label-content-name-mismatch). Ay adı ve boş gün gizli metindir. */}
            <span className={cn('tabular-nums', day === today && 'font-semibold')}>
              <span aria-hidden="true">{dayNo.format(noon(day))}</span>
              <span className="sr-only">{dayMonth.format(noon(day))}</span>
            </span>
            <span className="text-xs text-text-muted tabular-nums">{count === 0 ? <span className="sr-only">randevu yok</span> : `${count} randevu`}</span>
          </Link>
        )
      })}
    </div>
  )
}
