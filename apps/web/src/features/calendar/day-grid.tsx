'use client'

import { clockLabel, minutesLabel, percentOf, type DayAppointment, type StripRange } from '@/features/appointments/day-logic'
import type { StaffMember } from '@/features/appointments/staff'
import { eventClasses, toneClasses } from '@/features/appointments/tones'
import { cn } from '@/ui/cn'
import { STATUS_LABELS } from '@/ui/status-badge'
import { layoutColumn } from './calendar-logic'

// Masaüstü günlük takvim: personel sütunları, 72 px/saat, 15 dk boş dilim, şimdi çizgisi (tasarim.md §4 Takvim).
// Boş dilimler fare içindir (tabindex=-1, aria-hidden); klavye karşılığı sayfadaki "Randevu oluştur" bağlantısıdır.
export const HOUR_PX = 72
const SLOT_MIN = 15
const MIN_EVENT_PX = 18

export function DayGrid({
  staff,
  appointments,
  range,
  nowMin,
  showNow,
  onOpen,
  onPickFree,
}: {
  staff: readonly StaffMember[]
  appointments: readonly DayAppointment[]
  range: StripRange
  nowMin: number
  showNow: boolean
  onOpen: (id: string) => void
  onPickFree: (staffId: string, time: string) => void
}) {
  const hours = Array.from({ length: Math.ceil((range.endMin - range.startMin) / 60) }, (_, i) => range.startMin + i * 60)
  const height = ((range.endMin - range.startMin) / 60) * HOUR_PX
  const slots = Array.from({ length: Math.floor((range.endMin - range.startMin) / SLOT_MIN) }, (_, i) => range.startMin + i * SLOT_MIN)

  return (
    <div
      role="group"
      aria-label="Günlük takvim"
      style={{ gridTemplateColumns: `56px repeat(${Math.max(staff.length, 1)}, minmax(150px, 1fr))` }}
      className="grid overflow-x-auto clip-safe rounded-card border border-border bg-surface [&_:focus-visible]:-outline-offset-2"
    >
      <div className="sticky top-0 z-10 border-b border-border bg-surface" />
      {staff.map((person) => {
        const count = appointments.filter((a) => a.staffKey === person.id && a.status !== 'cancelled').length
        return (
          <h3 key={person.id} className="sticky top-0 z-10 m-0 flex items-center gap-2 border-b border-l border-border bg-surface px-3 py-2 text-sm font-medium">
            <span aria-hidden="true" className={cn('inline-grid size-7 flex-none place-items-center rounded-full text-xs font-semibold', toneClasses[person.tone].avatar)}>
              {person.initials}
            </span>
            <span className="grid min-w-0">
              <span className="truncate">{person.short}</span>
              <small className="text-xs font-normal text-text-muted">{count} randevu</small>
            </span>
          </h3>
        )
      })}

      <div aria-hidden="true" style={{ height }} className="relative text-xs text-text-muted tabular-nums">
        {hours.map((m) => (
          <span key={m} style={{ top: ((m - range.startMin) / 60) * HOUR_PX }} className="absolute right-2 -translate-y-1/2 bg-surface px-0.5 first:translate-y-0">
            {minutesLabel(m)}
          </span>
        ))}
      </div>

      {staff.map((person) => {
        const laid = layoutColumn(appointments.filter((a) => a.staffKey === person.id))
        return (
          <div key={person.id} style={{ height }} className="relative border-l border-border bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(72px-1px),var(--color-border-subtle)_calc(72px-1px),var(--color-border-subtle)_72px)]">
            {slots.map((m) => (
              <button
                key={m}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                data-slot={`${person.id}-${minutesLabel(m)}`}
                onClick={() => onPickFree(person.id, minutesLabel(m))}
                style={{ top: ((m - range.startMin) / 60) * HOUR_PX, height: (SLOT_MIN / 60) * HOUR_PX }}
                className="absolute inset-x-0 cursor-pointer bg-transparent hover:bg-primary-soft"
              />
            ))}
            {laid.map(({ appointment: a, startMin, endMin, lane, lanes }) => {
              const durationMin = endMin - startMin
              const short = durationMin <= 30
              return (
                <button
                  key={a.id}
                  type="button"
                  data-event-id={a.id}
                  onClick={() => onOpen(a.id)}
                  style={{
                    top: `${((startMin - range.startMin) / 60) * HOUR_PX + 1}px`,
                    height: `${Math.max((durationMin / 60) * HOUR_PX - 3, MIN_EVENT_PX)}px`,
                    left: `${(lane / lanes) * 100}%`,
                    width: `calc(${100 / lanes}% - 2px)`,
                  }}
                  className={cn('absolute z-[1] grid cursor-pointer content-start gap-0 overflow-hidden clip-safe focus-visible:-outline-offset-2 rounded-tag border px-1.5 py-0.5 text-left text-xs leading-4', eventClasses(a.status, person.tone))}
                >
                  {/* Erişilebilir ad görünür metinle başlar (WCAG 2.5.3, axe label-content-name-mismatch): aria-label yok; görünmeyen bilgi gizli metinle sonuna eklenir. */}
                  {short ? (
                    <>
                      <strong className="truncate font-semibold">
                        {clockLabel(a.start)} {a.customerName}
                      </strong>
                      <span className="sr-only">
                        , {clockLabel(a.end)} bitiş, {a.serviceName}, {STATUS_LABELS[a.status]}
                        {a.unverified ? ', Online' : ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong className="truncate font-semibold">{a.customerName}</strong>
                      <span className="truncate">
                        {clockLabel(a.start)} – {clockLabel(a.end)} · {a.serviceName}
                      </span>
                      {durationMin >= 75 ? (
                        <span className="truncate">
                          {STATUS_LABELS[a.status]}
                          {a.unverified ? ' · Online' : ''}
                        </span>
                      ) : (
                        <span className="sr-only">
                          , {STATUS_LABELS[a.status]}
                          {a.unverified ? ', Online' : ''}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )
            })}
            {showNow && nowMin >= range.startMin && nowMin <= range.endMin ? (
              <span aria-hidden="true" style={{ top: `${percentOf(nowMin, range) * (height / 100)}px` }} className="pointer-events-none absolute inset-x-0 z-[2] h-0.5 bg-accent-mark" />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

