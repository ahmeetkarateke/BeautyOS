import type { ComponentProps, ReactNode } from 'react'
import { cn } from './cn'

// Prototip karşılığı: .dugme (bilesenler.css). Kural: ekran başına tek birincil; ad = fiil + nesne.
export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'danger-solid'

const base =
  'inline-flex min-h-(--size-control) items-center justify-center gap-2 rounded-control border border-transparent px-4 ' +
  'text-base font-medium leading-none whitespace-nowrap no-underline transition duration-(--duration-fast) ease-in-out ' +
  'cursor-pointer active:scale-[0.98] lg:pointer-fine:min-h-10 lg:pointer-fine:text-sm ' +
  'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-active disabled:text-text-muted disabled:active:scale-100 ' +
  'aria-busy:cursor-progress'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed',
  secondary: 'bg-surface text-text border-border-control hover:bg-surface-subtle hover:border-text-muted',
  text: 'bg-transparent px-2 text-primary hover:bg-primary-soft',
  danger: 'bg-surface border-danger text-danger hover:bg-danger-bg',
  // Dolu kırmızı yalnız onay penceresinin eylem düğmesidir (tasarim.md §4).
  'danger-solid': 'bg-danger text-text-inverse hover:bg-danger-text',
}

type CommonProps = Omit<ComponentProps<'button'>, 'children'> & {
  size?: 'md' | 'sm'
  /** İşlem sürerken true: aria-busy, dönen işaret ve tekrar basma engeli. */
  loading?: boolean
  /** İşlemde gösterilen metin, ör. "Kaydediliyor…". */
  loadingText?: string
  fullWidth?: boolean
}

export type ButtonProps =
  | (CommonProps & { variant?: ButtonVariant; children: ReactNode; icon?: ReactNode })
  // İkon düğmesinde görünür metin yoktur; erişilebilir ad zorunludur.
  | (CommonProps & { variant: 'icon'; 'aria-label': string; icon: ReactNode; children?: never })

export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    icon,
    children,
    size = 'md',
    loading = false,
    loadingText,
    fullWidth = false,
    className,
    onClick,
    type = 'button',
    ...buttonProps
  } = props as CommonProps & { variant?: ButtonVariant | 'icon'; icon?: ReactNode; children?: ReactNode }

  return (
    <button
      {...buttonProps}
      type={type}
      aria-busy={loading ? true : undefined}
      // aria-disabled yerine gerçek disabled yalnız devre dışıda; işlemde odak kaybolmasın diye disabled kullanılmaz.
      onClick={loading ? (event) => event.preventDefault() : onClick}
      className={cn(
        base,
        variant === 'icon'
          ? 'w-(--size-control) bg-transparent p-0 text-text-secondary hover:bg-surface-active hover:text-text'
          : variants[variant],
        size === 'sm' && variant !== 'icon' && 'min-h-(--size-control-sm) px-3 text-sm',
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : (
        icon
      )}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}
