'use client'

import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { cn } from './cn'

// Prototip karşılığı: .parcali. 2-5 seçenek (dönem, ödeme yöntemi); tek seçim olduğu için radiogroup,
// roving tabindex ve ok tuşlarıyla gezinme. Telefonda tam genişlik yalnız 480 px altında.
export type SegmentedOption = { value: string; label: string }

const MIN_OPTIONS = 2
const MAX_OPTIONS = 5

export function SegmentedControl({
  options,
  value,
  onValueChange,
  fullWidth = false,
  className,
  'aria-label': ariaLabel,
}: {
  options: readonly SegmentedOption[]
  value: string
  onValueChange: (value: string) => void
  /** true ise 480 px altında tam genişlik olur. */
  fullWidth?: boolean
  className?: string
  'aria-label': string
}) {
  // Yalnız geliştirmede fırlatır: canlıda sayfayı hata sınırına düşürmek yerine olduğu gibi çizer.
  if (process.env.NODE_ENV !== 'production' && (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS)) {
    throw new Error(`SegmentedControl ${MIN_OPTIONS}-${MAX_OPTIONS} seçenek alır (verilen: ${options.length}).`)
  }
  // Eşleşen seçenek yoksa ilk seçenek sekme sırasına girer; yoksa grup klavyeyle erişilemez olurdu.
  const tabStop = options.some((option) => option.value === value) ? value : options[0]?.value
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onValueChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[9px] bg-surface-active p-[3px]',
        fullWidth && 'flex w-full min-[480px]:inline-flex min-[480px]:w-auto',
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={option.value === tabStop ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'min-h-[38px] cursor-pointer rounded-control border-0 px-3.5 text-sm font-medium whitespace-nowrap',
              fullWidth && 'max-[479px]:flex-1',
              selected
                ? 'bg-surface text-text shadow-[0_1px_2px_rgba(17,36,42,0.12)]'
                : 'bg-transparent text-text-secondary hover:text-text',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
