import { cn } from './cn'

// Saat ızgarası (tasarim.md §4): 76 px'lik düğmeler, yalnız boş saatler.
export function TimeSlots({
  slots,
  selected,
  onSelect,
  loading = false,
  className,
}: {
  slots: readonly string[]
  selected: string | null
  onSelect: (slot: string) => void
  loading?: boolean
  className?: string
}) {
  if (loading) {
    return (
      <p role="status" className="text-sm text-text-muted">
        Boş saatler getiriliyor…
      </p>
    )
  }
  if (slots.length === 0) {
    return <p className="text-base text-text-secondary">Bu gün boş saat yok. Başka bir gün seçin.</p>
  }
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {slots.map((slot) => (
        <button
          key={slot}
          type="button"
          aria-pressed={slot === selected}
          onClick={() => onSelect(slot)}
          className={cn(
            'min-h-(--size-control) w-19 cursor-pointer rounded-control border text-base font-medium tabular-nums',
            'transition-colors duration-(--duration-fast)',
            slot === selected ? 'border-primary bg-primary text-on-primary' : 'border-border-control bg-surface text-text hover:border-text-muted',
          )}
        >
          {slot}
        </button>
      ))}
    </div>
  )
}
