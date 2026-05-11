'use client'

import { useRef, useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import trLocale from '@fullcalendar/core/locales/tr'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { useAuthStore } from '@/store/auth'

interface Appointment {
  id: string
  referenceCode: string
  customerName: string
  customerPhone: string
  serviceName: string
  serviceCategory: string
  staffName: string
  startTime: string
  endTime: string
  status: string
  priceCharged: number
  notes: string
  staffColorCode?: string
}

export interface AppointmentEventProps {
  appointmentId: string
  title: string
  status: string
  priceCharged: number
  customerName: string
  customerPhone: string
  serviceName: string
  serviceCategory: string
  staffName: string
  startTime: string
  endTime: string
  notes: string
  referenceCode: string
}

interface AppointmentCalendarProps {
  tenantId: string
  onSelectSlot?: (start: Date, end: Date) => void
  onSelectAppointment?: (props: AppointmentEventProps) => void
  filterStaffId?: string
  filterStatus?: string
  filterSearch?: string
}

const STATUS_STYLES: Record<string, { bg: string; border: string; opacity: number; strikethrough: boolean }> = {
  pending:     { bg: '#FEF3C7', border: '#F59E0B', opacity: 1,    strikethrough: false },
  confirmed:   { bg: '#DBEAFE', border: '#3B82F6', opacity: 1,    strikethrough: false },
  in_progress: { bg: '#EDE9FE', border: '#7C3AED', opacity: 1,    strikethrough: false },
  completed:   { bg: '#D1FAE5', border: '#10B981', opacity: 0.75, strikethrough: false },
  cancelled:   { bg: '#FEE2E2', border: '#EF4444', opacity: 0.6,  strikethrough: true  },
  no_show:     { bg: '#F3F4F6', border: '#9CA3AF', opacity: 0.6,  strikethrough: true  },
}

const LEGEND = [
  { label: 'Bekliyor',        color: '#F59E0B' },
  { label: 'Onaylı',          color: '#3B82F6' },
  { label: 'Devam Ediyor',    color: '#7C3AED' },
  { label: 'Tamamlandı',      color: '#10B981' },
  { label: 'İptal / Gelmedi', color: '#9CA3AF' },
]

export function AppointmentCalendar({
  tenantId,
  onSelectSlot,
  onSelectAppointment,
  filterStaffId,
  filterStatus,
  filterSearch,
}: AppointmentCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isEditable = user?.role === 'owner' || user?.role === 'manager'

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Title element bounding rect — React state ile takip
  const [pickerStyle, setPickerStyle] = useState<React.CSSProperties | null>(null)

  function updateOverlayPosition() {
    setTimeout(() => {
      const wrapper = document.querySelector('.beautyos-calendar') as HTMLElement | null
      const titleEl = wrapper?.querySelector('.fc-toolbar-title') as HTMLElement | null
      if (!wrapper || !titleEl) return
      const wr = wrapper.getBoundingClientRect()
      const tr = titleEl.getBoundingClientRect()
      setPickerStyle({
        position: 'absolute',
        top: tr.top - wr.top,
        left: tr.left - wr.left,
        width: tr.width,
        height: tr.height,
        opacity: 0,
        cursor: 'pointer',
        border: 0,
        padding: 0,
        margin: 0,
        background: 'transparent',
        zIndex: 5,
        // iOS Safari için
        WebkitAppearance: 'none',
        appearance: 'none',
      })
      titleEl.style.cursor = 'pointer'
      titleEl.setAttribute('title', 'Tarihe git')
    }, 50)
  }

  useEffect(() => {
    const reposition = () => updateOverlayPosition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, { passive: true })
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition)
    }
  }, [])

  const { data } = useQuery({
    queryKey: ['appointments-calendar', tenantId, filterStaffId, filterStatus, filterSearch],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (filterStaffId) qs.set('staffId', filterStaffId)
      if (filterStatus) qs.set('status', filterStatus)
      if (filterSearch) qs.set('search', filterSearch)
      const query = qs.toString() ? `?${qs.toString()}` : ''
      return apiFetch<{ data: Appointment[] }>(`/api/v1/tenants/${tenantId}/appointments${query}`)
    },
  })

  const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'no_show'])

  const events = (data?.data ?? []).map((apt) => {
    const style = STATUS_STYLES[apt.status] ?? STATUS_STYLES.pending
    const isPast = new Date(apt.endTime) < new Date()
    return {
      id: apt.id,
      title: `${apt.customerName} – ${apt.serviceName}`,
      start: apt.startTime,
      end: apt.endTime,
      backgroundColor: style.bg,
      borderColor: style.border,
      editable: isEditable && !TERMINAL_STATUSES.has(apt.status) && !isPast,
      extendedProps: {
        staffName: apt.staffName,
        staffColor: apt.staffColorCode ?? '#6B48FF',
        status: apt.status,
        priceCharged: apt.priceCharged,
        opacity: style.opacity,
        strikethrough: style.strikethrough,
        customerName: apt.customerName,
        customerPhone: apt.customerPhone,
        serviceName: apt.serviceName,
        serviceCategory: apt.serviceCategory,
        startTime: apt.startTime,
        endTime: apt.endTime,
        notes: apt.notes,
        referenceCode: apt.referenceCode,
      },
    }
  })

  return (
    <div className="beautyos-calendar" style={{ position: 'relative' }}>
      {pickerStyle && (
        <input
          ref={dateInputRef}
          type="date"
          style={pickerStyle}
          onFocus={(e) => {
            // Picker açılırken aktif tarihi yükle
            const current = calendarRef.current?.getApi().getDate()
            if (current) {
              const pad = (n: number) => String(n).padStart(2, '0')
              e.target.value = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`
            }
          }}
          onChange={(e) => {
            const v = e.target.value
            if (v) calendarRef.current?.getApi().gotoDate(v)
          }}
        />
      )}

      <div className="flex flex-wrap gap-3 mb-3 px-1">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-salon-muted">{item.label}</span>
          </div>
        ))}
      </div>

      <FullCalendar
        key={isMobile ? 'mobile' : 'desktop'}
        ref={calendarRef}
        viewDidMount={updateOverlayPosition}
        datesSet={updateOverlayPosition}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
        locale={trLocale}
        headerToolbar={
          isMobile
            ? { left: 'prev,next', center: 'title', right: 'timeGridDay,timeGridWeek' }
            : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }
        }
        slotMinTime="08:00:00"
        slotMaxTime="22:00:00"
        slotDuration="00:30:00"
        height="auto"
        editable={isEditable}
        selectable={true}
        selectMirror={true}
        longPressDelay={150}
        eventLongPressDelay={150}
        selectLongPressDelay={150}
        events={events}
        eventDrop={async ({ event, revert }) => {
          if (!event.start) return
          try {
            await apiFetch(`/api/v1/tenants/${tenantId}/appointments/${event.id}/reschedule`, {
              method: 'PATCH',
              body: JSON.stringify({ startAt: event.start.toISOString() }),
            })
            qc.invalidateQueries({ queryKey: ['appointments-calendar', tenantId] })
            qc.invalidateQueries({ queryKey: ['appointments', tenantId] })
            toast('Randevu yeniden zamanlandı')
          } catch (err) {
            revert()
            toast(err instanceof Error ? err.message : 'Randevu taşınamadı', 'error')
          }
        }}
        select={(info) => onSelectSlot?.(info.start, info.end)}
        eventClick={(info) => {
          const ep = info.event.extendedProps
          onSelectAppointment?.({
            appointmentId: info.event.id,
            title: info.event.title,
            status: ep.status as string,
            priceCharged: ep.priceCharged as number,
            customerName: ep.customerName as string,
            customerPhone: ep.customerPhone as string,
            serviceName: ep.serviceName as string,
            serviceCategory: ep.serviceCategory as string,
            staffName: ep.staffName as string,
            startTime: ep.startTime as string,
            endTime: ep.endTime as string,
            notes: ep.notes as string,
            referenceCode: ep.referenceCode as string,
          })
        }}
        eventContent={(arg) => {
          const { staffColor, staffName, opacity, strikethrough } = arg.event.extendedProps
          return (
            <div className="flex h-full overflow-hidden rounded-sm" style={{ opacity }}>
              <div className="w-1 flex-shrink-0 rounded-l-sm" style={{ backgroundColor: staffColor }} />
              <div className="flex-1 px-1.5 py-1 min-w-0">
                <p className={`text-xs font-semibold truncate text-gray-800 ${strikethrough ? 'line-through' : ''}`}>
                  {arg.event.title}
                </p>
                <p className="text-xs text-gray-500 truncate">{staffName}</p>
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}
