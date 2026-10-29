import Link from 'next/link'
import { CircleCheck, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/ui/cn'
import { Card } from '@/ui/card'
import { setupProgress, type SetupStep } from './setup-steps'

// İlk kurulum listesi (tasarim.md §8.1 `bugun`, B durumu): gerçek yüzde, her adım ilgili ekrana götürür.
const rowClass = 'flex min-h-(--size-row) w-full items-center gap-3 py-2 text-left text-base text-text no-underline'

export function FirstSetup({ steps, onCreateAppointment }: { steps: readonly SetupStep[]; onCreateAppointment: () => void }) {
  const progress = setupProgress(steps)
  return (
    <div data-testid="ilk-kurulum">
      <Card labelledBy="kurulum-baslik">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="kurulum-baslik" className="text-base leading-6 font-semibold">
            Kurulumu tamamlayın
          </h2>
          <span className="text-sm text-text-muted tabular-nums">
            {progress.done}/{progress.total}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Kurulum ilerlemesi"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          className="mb-2 h-1.5 overflow-hidden clip-safe rounded-full bg-surface-active"
        >
          <span className="block h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
        </div>
        <ol className="m-0 list-none divide-y divide-border-subtle p-0">
          {steps.map((step) => {
            const icon = step.done ? <CircleCheck aria-hidden="true" className="size-5 flex-none text-success" /> : <Clock aria-hidden="true" className="size-5 flex-none text-text-muted" />
            const label = <span className={cn('flex-1', step.done && 'text-text-muted line-through')}>{step.label}</span>
            const tail = step.done ? <span className="text-xs text-text-muted">Tamamlandı</span> : <ChevronRight aria-hidden="true" className="size-4 text-text-muted" />
            return (
              <li key={step.id}>
                {step.done ? (
                  <div className={rowClass}>
                    {icon}
                    {label}
                    {tail}
                  </div>
                ) : step.href ? (
                  <Link href={step.href} className={rowClass}>
                    {icon}
                    {label}
                    {tail}
                  </Link>
                ) : (
                  <button type="button" onClick={onCreateAppointment} className={cn(rowClass, 'cursor-pointer bg-transparent')}>
                    {icon}
                    {label}
                    {tail}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}
