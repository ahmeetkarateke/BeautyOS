import type { ReactNode } from 'react'
import { cn } from './cn'

// Prototip karşılığı: .ozet. KPI'lar tek kutuda ayraçlarla; ikon yok, mini grafik yok.
// Değer 20/600; alt satır karşılaştırmayı adıyla söyler ("geçen çarşamba 15"). Telefonda 2 sütun.
export type SummaryItem = { label: string; value: ReactNode; comparison?: string }

export function SummaryStrip({ items, className }: { items: readonly SummaryItem[]; className?: string }) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border lg:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="grid content-start gap-0.5 bg-surface p-4">
          <dt className="text-sm leading-5 text-text-muted">{item.label}</dt>
          <dd className="m-0 text-lg leading-7 font-semibold text-text tabular-nums">{item.value}</dd>
          {item.comparison ? <dd className="m-0 text-xs leading-4 text-text-muted">{item.comparison}</dd> : null}
        </div>
      ))}
    </dl>
  )
}
