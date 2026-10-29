import type { ReactNode } from 'react'
import { cn } from './cn'

// Prototip karşılığı: .secim-kart. Hizmet, personel, kanal, paket seçimi; seçilince petrol kenar + açık zemin.
// Fiyat sağda ve tabular. Seçim durumu yalnız renkle verilmez: aria-pressed + kalın kenar halkası.
export function SelectionCard({
  title,
  description,
  price,
  leading,
  selected,
  onSelect,
  disabled,
  className,
}: {
  title: string
  description?: string
  price?: string
  /** Solda küçük görsel (ör. Avatar). */
  leading?: ReactNode
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-3 text-left',
        'transition-colors duration-(--duration-fast) ease-in-out hover:border-text-muted',
        'disabled:cursor-not-allowed disabled:bg-surface-active disabled:text-text-muted',
        selected && 'border-primary bg-primary-soft shadow-[inset_0_0_0_1px_var(--color-primary)] hover:border-primary',
        className,
      )}
    >
      {leading}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-base leading-6 font-medium text-text">{title}</span>
        {description ? <span className="text-sm leading-5 text-text-muted">{description}</span> : null}
      </span>
      {price ? <span className="text-base font-medium whitespace-nowrap text-text tabular-nums">{price}</span> : null}
    </button>
  )
}
