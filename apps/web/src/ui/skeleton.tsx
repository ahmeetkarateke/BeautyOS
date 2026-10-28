import type { ReactNode } from 'react'
import { cn } from './cn'

// Prototip karşılığı: .iskelet. Düz gri çubuk, parıltı yok; başlıklar hemen görünür, ekran okuyucuya "Yükleniyor…".
const shapes = {
  text: 'h-3.5',
  value: 'h-6 w-18',
  circle: 'rounded-full',
} as const

export function Skeleton({ variant = 'text', className }: { variant?: keyof typeof shapes; className?: string }) {
  return (
    <span
      data-skeleton
      aria-hidden="true"
      className={cn('block rounded-tag bg-surface-active', shapes[variant], className)}
    />
  )
}

/** Birden çok çubuğu tek bir "Yükleniyor…" duyurusunda toplar. */
export function SkeletonGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">Yükleniyor…</span>
      {children}
    </div>
  )
}
