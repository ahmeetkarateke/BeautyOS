'use client'

import { useDraggable } from '@dnd-kit/core'
import { clockLabel, type DayAppointment } from '@/features/appointments/day-logic'
import { eventClasses } from '@/features/appointments/tones'
import type { Tone } from '@/features/appointments/tones'
import { cn } from '@/ui/cn'
import { STATUS_LABELS } from '@/ui/status-badge'

// Günlük ızgaradaki tek randevu düğmesi (W15: taşınabiliyorsa fareyle sürüklenir).
// Bilerek `attributes` yayılmaz: dnd-kit'in role/aria-describedby'ı yalnız klavye algılayıcısı olsaydı doğruydu; burada tek algılayıcı fare,
// klavye karşılığı Enter ile açılan ayrıntıdaki "Saati değiştir"dir. Düğme olarak kalır, Enter/Boşluk ayrıntıyı açar.
export type GridEventData = { minY: number; maxY: number }

export function GridEvent({
  appointment: a,
  tone,
  top,
  height,
  left,
  width,
  short,
  durationMin,
  draggable,
  dragging,
  onOpen,
  data,
}: {
  appointment: DayAppointment
  tone: Tone
  top: number
  height: number
  left: string
  width: string
  short: boolean
  durationMin: number
  draggable: boolean
  dragging: boolean
  onOpen: (id: string) => void
  data: GridEventData
}) {
  const { setNodeRef, listeners, transform } = useDraggable({
    id: a.id,
    disabled: !draggable,
    data,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-event-id={a.id}
      data-movable={draggable ? 'true' : undefined}
      {...(draggable ? listeners : {})}
      onClick={() => onOpen(a.id)}
      aria-label={`${clockLabel(a.start)} – ${clockLabel(a.end)}, ${a.customerName}, ${a.serviceName}, ${STATUS_LABELS[a.status]}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left,
        width,
        ...(transform ? { transform: `translate3d(0, ${Math.round(transform.y)}px, 0)` } : {}),
      }}
      className={cn(
        'absolute z-[1] grid content-start gap-0 overflow-hidden clip-safe focus-visible:-outline-offset-2 rounded-tag border px-1.5 py-0.5 text-left text-xs leading-4',
        draggable ? 'cursor-grab' : 'cursor-pointer',
        dragging && 'z-20 cursor-grabbing opacity-80 shadow-lg',
        eventClasses(a.status, tone),
      )}
    >
      {short ? (
        <strong className="truncate font-semibold">
          {clockLabel(a.start)} {a.customerName}
        </strong>
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
          ) : null}
        </>
      )}
    </button>
  )
}
