'use client'

import { AppointmentCard } from '@/features/appointments/appointment-card'
import { istanbulMinutes, minutesLabel, type DayAppointment, type StripRange } from '@/features/appointments/day-logic'
import type { StaffMember } from '@/features/appointments/staff'

// Telefon: saat çizelgesi. Her saat satırı o saatte başlayan randevuları kart olarak gösterir; boş saat randevu açar.
export function DayTimeline({
  appointments,
  range,
  staffById,
  showStaff,
  onOpen,
  onPickFree,
}: {
  appointments: readonly DayAppointment[]
  range: StripRange
  staffById: ReadonlyMap<string, StaffMember>
  showStaff: boolean
  onOpen: (id: string) => void
  onPickFree: (time: string) => void
}) {
  const hours = Array.from({ length: Math.ceil((range.endMin - range.startMin) / 60) }, (_, i) => range.startMin + i * 60)
  return (
    <section aria-label="Saat çizelgesi" className="grid gap-0">
      {hours.map((hourStart) => {
        const inHour = appointments
          .filter((a) => a.status !== 'cancelled' && istanbulMinutes(a.start) >= hourStart && istanbulMinutes(a.start) < hourStart + 60)
          .sort((a, b) => a.start.getTime() - b.start.getTime())
        return (
          <div key={hourStart} className="grid grid-cols-[48px_1fr] gap-3 border-t border-border-subtle py-2">
            <span className="pt-2 text-sm text-text-muted tabular-nums">{minutesLabel(hourStart)}</span>
            <div className="grid content-start gap-2">
              {inHour.length === 0 ? (
                <button type="button" onClick={() => onPickFree(minutesLabel(hourStart))} className="min-h-11 cursor-pointer bg-transparent text-left text-sm text-text-muted">
                  Boş · randevu oluştur
                </button>
              ) : (
                inHour.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} tone={staffById.get(a.staffKey)?.tone ?? 1} staffShort={staffById.get(a.staffKey)?.short} showStaff={showStaff} onOpen={onOpen} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
