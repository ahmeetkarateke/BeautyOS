import type { ReactNode } from 'react'
import { Button } from './button'
import { cn } from './cn'

// Prototip karşılığı: .kart. 1 px kenar, 8 köşe, gölge yok; iç içe kart yok. Başlık 16/600 solda, ikincil eylem sağda metin düğme.
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-card border border-border bg-surface p-4', className)}>{children}</section>
}

export function CardHeader({
  title,
  action,
  headingLevel = 3,
  className,
}: {
  title: string
  action?: { label: string; onClick: () => void }
  headingLevel?: 2 | 3
  className?: string
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <Heading className="text-base leading-6 font-semibold text-text">{title}</Heading>
      {action ? (
        <Button variant="text" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
