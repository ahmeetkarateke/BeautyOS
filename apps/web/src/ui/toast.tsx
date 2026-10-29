'use client'

import { createContext, use, useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as RadixToast from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { cn } from './cn'

// Bildirim (tasarim.md §4): tek cümle, geçmiş zaman, 4 sn (geri al varsa 8 sn), kapatılabilir, role=status.
// Telefonda alt menünün üstünde, masaüstünde sağ altta. Hata bildirimi koyu kırmızı.
export type ToastOptions = {
  message: string
  tone?: 'default' | 'error'
  /** Verilirse "Geri al" düğmesi çıkar ve süre 8 sn olur. */
  undo?: () => void
}

type ToastItem = ToastOptions & { id: number }

const DEFAULT_MS = 4000
const UNDO_MS = 8000

export function toastDuration(options: Pick<ToastOptions, 'undo'> & Partial<ToastOptions>): number {
  return options.undo ? UNDO_MS : DEFAULT_MS
}

type ToastApi = { show: (options: ToastOptions) => void }
const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = use(ToastContext)
  if (!api) throw new Error('useToast, ToastProvider içinde kullanılmalıdır.')
  return api
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++
    setItems((current) => [...current, { ...options, id }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const api = useMemo<ToastApi>(() => ({ show }), [show])

  return (
    <ToastContext value={api}>
      <RadixToast.Provider label="Bildirim" swipeDirection="down">
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            duration={toastDuration(item)}
            data-tone={item.tone ?? 'default'}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id)
            }}
            className={cn(
              'pointer-events-auto flex max-w-105 items-center gap-2.5 rounded-card py-3 pr-2 pl-3.5 text-sm leading-5 shadow-menu',
              item.tone === 'error' ? 'bg-danger-text text-text-inverse' : 'bg-text text-text-inverse',
            )}
          >
            <RadixToast.Description className="flex-1">{item.message}</RadixToast.Description>
            {item.undo ? (
              <RadixToast.Action
                altText="Geri al"
                onClick={item.undo}
                className="min-h-8 cursor-pointer rounded-control px-2 font-medium text-accent hover:bg-surface/10"
              >
                Geri al
              </RadixToast.Action>
            ) : null}
            <RadixToast.Close
              aria-label="Bildirimi kapat"
              className="grid size-8 cursor-pointer place-items-center rounded-control hover:bg-surface/10"
            >
              <X aria-hidden="true" className="size-4" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport
          label="Bildirimler ({hotkey})"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--size-bottombar)+12px+env(safe-area-inset-bottom))] z-(--z-toast) m-0 flex list-none flex-col items-center gap-2 px-3 outline-none lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end lg:px-0"
        />
      </RadixToast.Provider>
    </ToastContext>
  )
}
