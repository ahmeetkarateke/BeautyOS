'use client'

import { clockLabel, type DayAppointment } from '@/features/appointments/day-logic'
import { formatDate } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { StatusBadge } from '@/ui/status-badge'

// Salt okunur randevu özeti. Durum eylemleri ve saati değiştirme W14'te (randevu ayrıntısı) gelir; o zamana dek bilgi görünür.
export function AppointmentPeek({ appointment, onClose }: { appointment: DayAppointment | null; onClose: () => void }) {
  return (
    <Sheet
      open={appointment !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Randevu ayrıntısı"
    >
      {appointment ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 pb-2 text-base">
          <dt className="text-text-muted">Müşteri</dt>
          <dd className="m-0 font-medium">{appointment.customerName}</dd>
          {appointment.customerPhone ? (
            <>
              <dt className="text-text-muted">Telefon</dt>
              <dd className="m-0 tabular-nums">{appointment.customerPhone}</dd>
            </>
          ) : null}
          <dt className="text-text-muted">Hizmet</dt>
          <dd className="m-0">{appointment.serviceName}</dd>
          <dt className="text-text-muted">Uzman</dt>
          <dd className="m-0">{appointment.staffName}</dd>
          <dt className="text-text-muted">Zaman</dt>
          <dd className="m-0 tabular-nums">
            {formatDate(appointment.start, 'long')} · {clockLabel(appointment.start)} – {clockLabel(appointment.end)}
          </dd>
          <dt className="text-text-muted">Durum</dt>
          <dd className="m-0">
            <StatusBadge status={appointment.status} />
          </dd>
          {appointment.notes ? (
            <>
              <dt className="text-text-muted">Not</dt>
              <dd className="m-0">{appointment.notes}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </Sheet>
  )
}
