import { StatusBadge } from '@/ui/status-badge'
import { cn } from '@/ui/cn'
import { clockLabel, type DayAppointment } from './day-logic'
import { toneClasses, type Tone } from './tones'

// Prototip karşılığı: .randevu-kart. Solda kişi tonu şeridi, saat aralığı, müşteri, hizmet · kişi, sağda durum.
// Tamamlanan randevu opaklıkla değil geçmiş tonuyla (past) çizilir; iptal edilen çizgili ad taşır.
export function AppointmentCard({
  appointment,
  tone,
  staffShort,
  showStaff = true,
  onOpen,
}: {
  appointment: DayAppointment
  tone: Tone
  staffShort?: string
  showStaff?: boolean
  onOpen: (id: string) => void
}) {
  const a = appointment
  const range = `${clockLabel(a.start)} – ${clockLabel(a.end)}`
  const sub = [a.serviceName, showStaff ? staffShort : null, a.unverified ? 'Online' : null].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      data-testid={`randevu-${a.id}`}
      onClick={() => onOpen(a.id)}
      className={cn(
        'grid w-full cursor-pointer grid-cols-[4px_1fr_auto] items-stretch gap-2.5 rounded-card border bg-surface py-2.5 pr-3 pl-0 text-left text-text',
        'hover:border-text-muted',
        a.status === 'in_progress' ? 'border-accent-mark' : 'border-border',
        a.status === 'cancelled' && 'bg-surface-subtle',
        a.status === 'completed' && 'bg-past-bg',
      )}
    >
      <span aria-hidden="true" className={cn('rounded-r-[3px]', toneClasses[tone].bar)} />
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate font-semibold tabular-nums">{range}</span>
        <span className={cn('truncate font-medium', a.status === 'cancelled' && 'text-text-muted line-through')}>{a.customerName}</span>
        <span className="truncate text-sm text-text-muted">{sub}</span>
      </span>
      <span className="grid content-start justify-items-end">
        <StatusBadge status={a.status} />
      </span>
    </button>
  )
}
