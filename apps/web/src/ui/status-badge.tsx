import { cn } from './cn'

// Prototip karşılığı: .durum. Satır başına tek durum: açık zemin + koyu metin + nokta; renk tek başına anlam taşımaz.
export const STATUS_LABELS = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandı',
  in_progress: 'Devam ediyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal edildi',
  no_show: 'Gelmedi',
} as const

export type AppointmentStatus = keyof typeof STATUS_LABELS

const tones: Record<AppointmentStatus | 'soon', string> = {
  pending: 'bg-status-pending-bg text-status-pending-text',
  confirmed: 'bg-status-confirmed-bg text-status-confirmed-text',
  in_progress: 'bg-status-inprogress-bg text-status-inprogress-text',
  completed: 'bg-status-completed-bg text-status-completed-text',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled-text',
  no_show: 'bg-status-noshow-bg text-status-noshow-text',
  // "Yakında": gri, noktasız, metinle (olmayan özellik etiketi).
  soon: 'bg-surface-active text-text-secondary',
}

export function StatusBadge({ status, className }: { status: AppointmentStatus | 'soon'; className?: string }) {
  const isSoon = status === 'soon'
  return (
    <span
      data-dot={isSoon ? 'false' : 'true'}
      className={cn(
        'inline-flex h-6 flex-none items-center gap-1.5 rounded-tag px-2 text-xs font-medium whitespace-nowrap',
        tones[status],
        className,
      )}
    >
      {isSoon ? null : <span data-status-dot aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {isSoon ? 'Yakında' : STATUS_LABELS[status]}
    </span>
  )
}
