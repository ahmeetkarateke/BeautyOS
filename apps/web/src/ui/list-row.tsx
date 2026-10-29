import type { ReactNode } from 'react'
import { cn } from './cn'

// Prototip karşılığı: .satir. Kimlik + 2. satır gri + sağda tek sayı ya da durum. Satır 56 px (iki satırlı daha yüksek).
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  className,
}: {
  title: string
  subtitle?: string
  leading?: ReactNode
  /** Sağda tek değer: tutar, saat ya da StatusBadge. */
  trailing?: ReactNode
  onPress?: () => void
  className?: string
}) {
  const content = (
    <>
      {leading}
      <span className="grid min-w-0 flex-1 gap-0.5 text-left">
        <span className="truncate text-base leading-6 font-medium text-text">{title}</span>
        {subtitle ? <span className="truncate text-sm leading-5 text-text-muted">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="flex-none text-base text-text tabular-nums">{trailing}</span> : null}
    </>
  )
  const base = 'flex min-h-(--size-row) w-full items-center gap-3 py-2'
  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className={cn(base, 'cursor-pointer rounded-control px-1 transition-colors duration-(--duration-fast) hover:bg-surface-subtle', className)}
      >
        {content}
      </button>
    )
  }
  return <div className={cn(base, className)}>{content}</div>
}
