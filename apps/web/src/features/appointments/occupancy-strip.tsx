'use client'

import type { MouseEvent } from 'react'
import { cn } from '@/ui/cn'
import { clockLabel, istanbulMinutes, minutesLabel, percentOf, staffState, type DayAppointment, type StripRange } from './day-logic'
import type { StaffMember } from './staff'
import { toneClasses } from './tones'

// İmza öğe (tasarim.md §2.1): "Personelin günü" doluluk şeridi. Her kişi için yatay şerit; dolu dilimler kişinin tonunda,
// onay bekleyen kesikli, devam eden dolu işaret rengi, tamamlanan geçmiş tonu; pudra "şimdi" çizgisi.
// Boşluğa dokunmak o kişi ve o saatle randevu açar (15 dk'ya yaslanır). Dilimler tabindex=-1: klavye kullanıcı aynı bilgiyi
// "Şu an boş" cümlesinden ve liste satırlarından alır.
const SNAP = 15

function axisMinutes(range: StripRange): number[] {
  const marks = [range.startMin]
  for (let m = Math.ceil((range.startMin + 1) / 180) * 180; m < range.endMin; m += 180) marks.push(m)
  marks.push(range.endMin)
  return marks
}

function stateSentence(name: string, state: ReturnType<typeof staffState>): string {
  if (state.kind === 'busy') return `${name}: şu an meşgul, ${state.until}’e kadar`
  if (state.kind === 'free') return `${name}: şu an boş, ${state.until}’e kadar`
  return `${name}: çalışma saati dışında`
}

export function OccupancyStrip({
  staff,
  appointments,
  range,
  nowMin,
  onOpenAppointment,
  onPickFree,
}: {
  staff: readonly StaffMember[]
  appointments: readonly DayAppointment[]
  range: StripRange
  nowMin: number
  onOpenAppointment: (id: string) => void
  /** Boşluğa dokunuldu: kişi ve yaslanmış saat ("14:45"). */
  onPickFree: (staffId: string, time: string) => void
}) {
  const nowPercent = percentOf(nowMin, range)
  const nowVisible = nowMin >= range.startMin && nowMin <= range.endMin

  function handleTrackClick(event: MouseEvent<HTMLDivElement>, staffId: string) {
    if (event.target !== event.currentTarget) return
    const box = event.currentTarget.getBoundingClientRect()
    const raw = range.startMin + ((event.clientX - box.left) / box.width) * (range.endMin - range.startMin)
    const snapped = Math.min(range.endMin - SNAP, Math.max(range.startMin, Math.floor(raw / SNAP) * SNAP))
    onPickFree(staffId, minutesLabel(snapped))
  }

  return (
    <div data-testid="doluluk-seridi" className="grid gap-2.5">
      {staff.map((person) => {
        const mine = appointments.filter((a) => a.staffKey === person.id && a.status !== 'cancelled')
        const tone = toneClasses[person.tone]
        return (
          <div key={person.id} className="grid grid-cols-[92px_1fr] items-center gap-2.5 lg:grid-cols-[92px_1fr]">
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
              <span aria-hidden="true" className={cn('inline-grid size-7 flex-none place-items-center rounded-full text-xs font-semibold', tone.avatar)}>
                {person.initials}
              </span>
              <span className="truncate">{person.short}</span>
            </span>
            <div
              role="group"
              aria-label={stateSentence(person.name, staffState(appointments, person.id, nowMin, range))}
              onClick={(event) => handleTrackClick(event, person.id)}
              style={{
                backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 calc(100% / 11 - 1px), var(--color-border-subtle) calc(100% / 11 - 1px) calc(100% / 11))',
              }}
              className="relative h-7 cursor-pointer overflow-hidden clip-safe rounded-tag border border-border bg-surface"
            >
              {mine.map((a) => {
                const left = percentOf(istanbulMinutes(a.start), range)
                const width = Math.max(1.5, percentOf(istanbulMinutes(a.end), range) - left)
                return (
                  <button
                    key={a.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => onOpenAppointment(a.id)}
                    aria-label={`${clockLabel(a.start)} – ${clockLabel(a.end)}, ${a.customerName}, ${a.serviceName}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    className={cn(
                      'absolute top-[3px] bottom-[3px] cursor-pointer rounded-[3px] border p-0',
                      a.status === 'in_progress' && tone.solid,
                      a.status === 'pending' && cn('border-dashed bg-transparent', tone.dashed),
                      a.status === 'confirmed' && tone.soft,
                      (a.status === 'completed' || a.status === 'no_show') && 'border-border bg-past-bg',
                    )}
                  />
                )
              })}
              {nowVisible ? (
                <span aria-hidden="true" style={{ left: `${nowPercent}%` }} className="pointer-events-none absolute -top-1 -bottom-1 -ml-px w-0.5 rounded-[1px] bg-accent-mark" />
              ) : null}
            </div>
          </div>
        )
      })}
      <div aria-hidden="true" className="grid grid-cols-[92px_1fr] gap-2.5">
        <span />
        <div className="flex justify-between text-xs text-text-muted tabular-nums">
          {axisMinutes(range).map((m) => (
            <span key={m}>{String(Math.floor(m / 60)).padStart(2, '0')}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
