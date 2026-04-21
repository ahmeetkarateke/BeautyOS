'use client'

import { useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import trLocale from '@fullcalendar/core/locales/tr'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

interface Appointment {
  id: string
  customerName: string
  serviceName: string
  staffName: string
  startTime: string
  endTime: string
  status: string
  staffColorCode?: string
}

interface AppointmentCalendarProps {
  tenantId: string
  onSelectSlot?: (start: Date, end: Date) => void
  onSelectAppointment?: (appointmentId: string) => void
}

export function AppointmentCalendar({ tenantId, onSelectSlot, onSelectAppointment }: AppointmentCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null)

  const { data } = useQuery({
    queryKey: ['appointments-calendar', tenantId],
    queryFn: () =>
      apiFetch<{ data: Appointment[] }>(`/api/v1/tenants/${tenantId}/appointments`),
  })

  const events = (data?.data ?? []).map((apt) => ({
    id: apt.id,
    title: `${apt.customerName} – ${apt.serviceName}`,
    start: apt.startTime,
    end: apt.endTime,
    backgroundColor: apt.staffColorCode ?? '#6B48FF',
    borderColor: apt.staffColorCode ?? '#6B48FF',
    extendedProps: { staffName: apt.staffName, status: apt.status },
  }))

  return (
    <div className="beautyos-calendar">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={trLocale}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        slotMinTime="08:00:00"
        slotMaxTime="22:00:00"
        slotDuration="00:30:00"
        height="auto"
        editable={true}
        selectable={true}
        selectMirror={true}
        events={events}
        select={(info) => onSelectSlot?.(info.start, info.end)}
        eventClick={(info) => onSelectAppointment?.(info.event.id)}
        eventContent={(arg) => (
          <div className="p-1 overflow-hidden">
            <p className="text-xs font-semibold truncate text-white">{arg.event.title}</p>
            <p className="text-xs text-white/80 truncate">{arg.event.extendedProps.staffName}</p>
          </div>
        )}
      />
    </div>
  )
}
