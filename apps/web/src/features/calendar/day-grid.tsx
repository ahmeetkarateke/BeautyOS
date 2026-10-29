'use client'

import { DndContext, MouseSensor, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent, type Modifier } from '@dnd-kit/core'
import { useState } from 'react'
import { istanbulDateStr, istanbulMinutes, minutesLabel, percentOf, type DayAppointment, type StripRange } from '@/features/appointments/day-logic'
import type { StaffMember } from '@/features/appointments/staff'
import { toneClasses } from '@/features/appointments/tones'
import { cn } from '@/ui/cn'
import { layoutColumn } from './calendar-logic'
import { dropTarget, type DropTarget } from './drag-logic'
import { GridEvent, type GridEventData } from './grid-event'

// Masaüstü günlük takvim: personel sütunları, 72 px/saat, 15 dk boş dilim, şimdi çizgisi (tasarim.md §4 Takvim).
// Boş dilimler fare içindir (tabindex=-1, aria-hidden); klavye karşılığı sayfadaki "Randevu oluştur" bağlantısıdır.
// Sürükle-bırak (W15): yalnız fare, yalnız dikey ve aynı personelin sütununda; 15 dk dilime oturur, karar sunucuda.
export const HOUR_PX = 72
const SLOT_MIN = 15
const MIN_EVENT_PX = 18
const DRAG_START_PX = 6

type Drag = { id: string; staffKey: string; deltaY: number }

// Sürüklenen kutu yalnız dikey gider ve ızgaranın dışına çıkmaz (sınırlar GridEvent'in `data`sında).
const verticalClamp: Modifier = ({ transform, active }) => {
  const bounds = active?.data.current as GridEventData | undefined
  const y = bounds ? Math.min(Math.max(transform.y, bounds.minY), bounds.maxY) : transform.y
  return { ...transform, x: 0, y }
}

export function DayGrid({
  staff,
  appointments,
  range,
  nowMin,
  showNow,
  nowMs,
  busy,
  canMove,
  onOpen,
  onPickFree,
  onMove,
}: {
  staff: readonly StaffMember[]
  appointments: readonly DayAppointment[]
  range: StripRange
  nowMin: number
  showNow: boolean
  nowMs: number
  /** Bir taşıma sürerken yenisi başlatılamaz. */
  busy: boolean
  canMove: (a: DayAppointment) => boolean
  onOpen: (id: string) => void
  onPickFree: (staffId: string, time: string) => void
  onMove: (a: DayAppointment, target: DropTarget) => void
}) {
  const hours = Array.from({ length: Math.ceil((range.endMin - range.startMin) / 60) }, (_, i) => range.startMin + i * 60)
  const height = ((range.endMin - range.startMin) / 60) * HOUR_PX
  const slots = Array.from({ length: Math.floor((range.endMin - range.startMin) / SLOT_MIN) }, (_, i) => range.startMin + i * SLOT_MIN)
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: DRAG_START_PX },
    }),
  )
  const [drag, setDrag] = useState<Drag | null>(null)

  const dragged = drag ? appointments.find((a) => a.id === drag.id) : undefined
  const targetFor = (a: DayAppointment, deltaY: number) =>
    dropTarget({
      startMin: istanbulMinutes(a.start),
      durationMin: Math.round((a.end.getTime() - a.start.getTime()) / 60_000),
      deltaPx: deltaY,
      hourPx: HOUR_PX,
      range,
      date: istanbulDateStr(a.start),
      nowMs,
    })
  const ghost = dragged && drag ? { ...targetFor(dragged, drag.deltaY), staffKey: drag.staffKey } : null

  const onDragStart = (event: DragStartEvent) => {
    const a = appointments.find((x) => x.id === String(event.active.id))
    if (a) setDrag({ id: a.id, staffKey: a.staffKey, deltaY: 0 })
  }
  const onDragMove = (event: DragMoveEvent) => setDrag((current) => (current ? { ...current, deltaY: event.delta.y } : current))
  const onDragEnd = (event: DragEndEvent) => {
    setDrag(null)
    const a = appointments.find((x) => x.id === String(event.active.id))
    if (!a) return
    const target = targetFor(a, event.delta.y)
    if (target.changed) onMove(a, target)
  }

  return (
    <DndContext
      sensors={sensors}
      modifiers={[verticalClamp]}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDrag(null)}
    >
      <div
        role="group"
        aria-label="Günlük takvim"
        style={{
          gridTemplateColumns: `56px repeat(${Math.max(staff.length, 1)}, minmax(150px, 1fr))`,
        }}
        className="grid overflow-x-auto clip-safe rounded-card border border-border bg-surface [&_:focus-visible]:-outline-offset-2"
      >
        <div className="sticky top-0 z-10 border-b border-border bg-surface" />
        {staff.map((person) => {
          const count = appointments.filter((a) => a.staffKey === person.id && a.status !== 'cancelled').length
          return (
            <h3
              key={person.id}
              className="sticky top-0 z-10 m-0 flex items-center gap-2 border-b border-l border-border bg-surface px-3 py-2 text-sm font-medium"
            >
              <span
                aria-hidden="true"
                className={cn('inline-grid size-7 flex-none place-items-center rounded-full text-xs font-semibold', toneClasses[person.tone].avatar)}
              >
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
            <span
              key={m}
              style={{ top: ((m - range.startMin) / 60) * HOUR_PX }}
              className="absolute right-2 -translate-y-1/2 bg-surface px-0.5 first:translate-y-0"
            >
              {minutesLabel(m)}
            </span>
          ))}
        </div>

        {staff.map((person) => {
          const laid = layoutColumn(appointments.filter((a) => a.staffKey === person.id))
          return (
            <div
              key={person.id}
              style={{ height }}
              className="relative border-l border-border bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(72px-1px),var(--color-border-subtle)_calc(72px-1px),var(--color-border-subtle)_72px)]"
            >
              {slots.map((m) => (
                <button
                  key={m}
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  data-slot={`${person.id}-${minutesLabel(m)}`}
                  onClick={() => onPickFree(person.id, minutesLabel(m))}
                  style={{
                    top: ((m - range.startMin) / 60) * HOUR_PX,
                    height: (SLOT_MIN / 60) * HOUR_PX,
                  }}
                  className="absolute inset-x-0 cursor-pointer bg-transparent hover:bg-primary-soft"
                />
              ))}
              {laid.map(({ appointment: a, startMin, endMin, lane, lanes }) => {
                const durationMin = endMin - startMin
                const top = ((startMin - range.startMin) / 60) * HOUR_PX + 1
                const eventHeight = Math.max((durationMin / 60) * HOUR_PX - 3, MIN_EVENT_PX)
                return (
                  <GridEvent
                    key={a.id}
                    appointment={a}
                    tone={person.tone}
                    top={top}
                    height={eventHeight}
                    left={`${(lane / lanes) * 100}%`}
                    width={`calc(${100 / lanes}% - 2px)`}
                    short={durationMin <= 30}
                    durationMin={durationMin}
                    draggable={!busy && canMove(a)}
                    dragging={drag?.id === a.id}
                    onOpen={onOpen}
                    data={{ minY: -top, maxY: height - top - eventHeight }}
                  />
                )
              })}
              {ghost && ghost.staffKey === person.id ? (
                <div
                  aria-hidden="true"
                  data-testid="tasima-hedef"
                  data-valid={ghost.valid ? 'true' : 'false'}
                  style={{
                    top: ((ghost.startMin - range.startMin) / 60) * HOUR_PX,
                    height: ((ghost.endMin - ghost.startMin) / 60) * HOUR_PX,
                  }}
                  className={cn(
                    'pointer-events-none absolute inset-x-0 z-10 rounded-tag border-2 px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                    ghost.valid ? 'border-primary bg-primary-soft text-primary' : 'border-dashed border-danger-text bg-danger-bg text-danger-text',
                  )}
                >
                  {ghost.valid ? `${minutesLabel(ghost.startMin)} – ${minutesLabel(ghost.endMin)}` : 'Geçmişe taşınamaz'}
                </div>
              ) : null}
              {showNow && nowMin >= range.startMin && nowMin <= range.endMin ? (
                <span
                  aria-hidden="true"
                  style={{
                    top: `${percentOf(nowMin, range) * (height / 100)}px`,
                  }}
                  className="pointer-events-none absolute inset-x-0 z-[2] h-0.5 bg-accent-mark"
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </DndContext>
  )
}
