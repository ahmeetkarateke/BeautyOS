import type { ReactNode } from 'react'
import { CircleAlert, Inbox, ShieldOff } from 'lucide-react'
import { Button } from './button'
import { cn } from './cn'

// Prototip karşılıkları: .bos (EmptyState, Forbidden) ve .hata-blok (ErrorState). Metinler metin-rehberi.md §4.2, §4.7.

const timeFormat = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

function Shell({ icon, title, children, centered, className }: { icon: ReactNode; title: string; children?: ReactNode; centered?: boolean; className?: string }) {
  return (
    <div className={cn('grid gap-2 px-4 py-6', centered ? 'justify-items-center px-6 py-12 text-center' : 'justify-items-start', className)}>
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-surface-active text-text-secondary">
        {icon}
      </span>
      <p className="text-base font-semibold text-text">{title}</p>
      {children}
    </div>
  )
}

/** Boş durum: ne olduğu, neden işe yarayacağı (isteğe bağlı) ve en çok bir birincil eylem. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  centered = false,
  className,
}: {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  icon?: ReactNode
  centered?: boolean
  className?: string
}) {
  return (
    <Shell icon={icon ?? <Inbox className="size-5" />} title={title} centered={centered} className={className}>
      {description ? <p className="max-w-[40ch] text-base text-text-secondary">{description}</p> : null}
      {action ? (
        <Button className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </Shell>
  )
}

/** Yükleme hatası: bloğun içinde, "X yüklenemedi." + Yeniden dene; son başarılı yükleme saati varsa yazılır. */
export function ErrorState({
  subject,
  onRetry,
  retrying = false,
  lastLoadedAt,
  className,
}: {
  /** Başı büyük, nesne adı: "Müşteri listesi". */
  subject: string
  onRetry: () => void
  retrying?: boolean
  lastLoadedAt?: Date
  className?: string
}) {
  return (
    <div role="alert" className={cn('flex items-start gap-2.5 px-4 py-3.5', className)}>
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 flex-none text-danger" />
      <div className="grid min-w-0 flex-1 justify-items-start gap-1">
        <p className="text-base font-semibold text-text">{subject} yüklenemedi.</p>
        <p className="text-base text-text-secondary">Bağlantınızı kontrol edip tekrar deneyin.</p>
        {lastLoadedAt ? (
          <p className="text-sm text-text-muted">Son başarılı yükleme: {timeFormat.format(lastLoadedAt)}</p>
        ) : null}
        <Button variant="secondary" size="sm" className="mt-1" loading={retrying} loadingText="Deneniyor…" onClick={onRetry}>
          Yeniden dene
        </Button>
      </div>
    </div>
  )
}

/** Yetkisiz: suçlamaz, çıkış yolu verir. `action` bir bağlantı ya da düğmedir (ör. "Bugün’e dön"). */
export function Forbidden({ action, className }: { action?: ReactNode; className?: string }) {
  return (
    <Shell icon={<ShieldOff className="size-5" />} title="Bu sayfayı görme yetkiniz yok." centered className={className}>
      <p className="max-w-[40ch] text-base text-text-secondary">Gerekiyorsa salon sahibinden yetki isteyin.</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </Shell>
  )
}
