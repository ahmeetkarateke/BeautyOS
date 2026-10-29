import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from './cn'

// Prototip karşılığı: .serit. Ekranın bulgusu: içerikle aynı sütunda, tek cümle + varsa tek eylem. Ekran boyu afiş değildir.
// Renk tek başına anlam taşımaz: her tonun kendi ikonu vardır.
const tones = {
  info: { box: 'bg-info-bg text-info-text', Icon: Info },
  warning: { box: 'bg-warning-bg text-warning-text border border-warning-border', Icon: TriangleAlert },
  success: { box: 'bg-success-bg text-success-text', Icon: CircleCheck },
  error: { box: 'bg-danger-bg text-danger-text', Icon: CircleAlert },
} as const

export type BannerTone = keyof typeof tones

export function Banner({
  tone,
  action,
  children,
  className,
}: {
  tone: BannerTone
  action?: { label: string; onClick: () => void }
  children: ReactNode
  className?: string
}) {
  const { box, Icon } = tones[tone]
  return (
    <div
      // Hata hemen duyurulur; diğer tonlar nazikçe.
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-card px-3.5 py-3 text-sm leading-5', box, className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 flex-none" />
      <p className="min-w-0 flex-1">{children}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="flex-none cursor-pointer font-semibold text-inherit underline underline-offset-2"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
