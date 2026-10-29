import type { ReactNode } from 'react'
import { cn } from './cn'

// Prototip karşılığı: .cip / .cipler. Süzgeç ve kısa seçim; seçili çip koyu dolgu. Satır kendi içinde yatay kayar.
export function ChipRow({ children, className, 'aria-label': ariaLabel }: { children: ReactNode; className?: string; 'aria-label': string }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    >
      {children}
    </div>
  )
}

export function Chip({
  pressed,
  onToggle,
  count,
  children,
  className,
}: {
  pressed: boolean
  onToggle: () => void
  /** Sonuç sayısı; tabular rakam. */
  count?: number
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'inline-flex min-h-9 flex-none cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap',
        'transition-colors duration-(--duration-fast) ease-in-out',
        pressed
          ? 'border-text bg-text text-text-inverse'
          : 'border-border bg-surface text-text-secondary hover:border-text-muted',
        className,
      )}
    >
      {children}
      {count === undefined ? null : <span className="tabular-nums opacity-75">{count}</span>}
    </button>
  )
}
