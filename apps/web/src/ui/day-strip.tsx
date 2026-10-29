import { cn } from './cn'

// Gün şeridi (tasarim.md §4): 14 günlük yatay şerit; kapalı gün kesikli ve devre dışı. Tarihler "YYYY-MM-DD" (salon günü);
// saat dilimi kayması olmaması için gün aritmetiği UTC'de, biçim İstanbul'dan bağımsız sabit bir öğle anıyla yapılır.
export type DayItem = { date: string; closed?: boolean }

export function buildDayRange(startIso: string, count: number): string[] {
  const [y, m, d] = startIso.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, d + i, 12)).toISOString().slice(0, 10))
}

const weekdayShort = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'UTC' })
const fullLabel = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' })
const noon = (iso: string) => new Date(`${iso}T12:00:00Z`)

export function DayStrip({
  days,
  selected,
  onSelect,
  className,
}: {
  days: readonly DayItem[]
  selected: string | null
  onSelect: (date: string) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Tarih seçin"
      className={cn('flex gap-2 overflow-x-auto [&_:focus-visible]:-outline-offset-2 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    >
      {days.map(({ date, closed }) => {
        const isSelected = date === selected
        const at = noon(date)
        return (
          <button
            key={date}
            type="button"
            disabled={closed}
            aria-pressed={isSelected}
            aria-label={`${fullLabel.format(at)}${closed ? ' (kapalı)' : ''}`}
            onClick={() => onSelect(date)}
            className={cn(
              'grid min-h-16 w-14 flex-none cursor-pointer content-center justify-items-center gap-0.5 rounded-card border text-sm',
              isSelected ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface text-text hover:border-text-muted',
              closed && 'cursor-not-allowed border-dashed bg-transparent text-text-muted hover:border-border',
            )}
          >
            <span className="text-xs">{weekdayShort.format(at)}</span>
            <span className="text-base font-semibold tabular-nums">{Number(date.slice(8, 10))}</span>
          </button>
        )
      })}
    </div>
  )
}
