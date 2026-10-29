'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from './button'
import { cn } from './cn'

// Prototip karşılığı: .katman. Telefonda alt sayfa (tutamaç, üstte 16 köşe, en çok 92dvh); 768 px üstünde ortalanmış diyalog
// (560 / geniş 720). Odak tuzağı, Esc ve arka plana dokunarak kapanma, odak açan düğmeye dönüş Radix'ten gelir.
// Eylemler sabit altta (footer). Yalnız gerçekten kesinti gereken işlerde kullanılır.
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = 'md',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  footer?: ReactNode
  size?: 'md' | 'lg'
  children: ReactNode
}) {
  // Katman dışarıdan denetlenen açılıştır (Dialog.Trigger yok): odağı açan öğeye kendimiz iade ederiz.
  const openerRef = useRef<HTMLElement | null>(null)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-sheet-overlay className="fixed inset-0 z-(--z-overlay) bg-text/40" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            openerRef.current = document.activeElement as HTMLElement | null
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            openerRef.current?.focus()
          }}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed inset-x-0 bottom-0 z-(--z-overlay) flex max-h-[92dvh] flex-col rounded-t-sheet bg-surface shadow-floating outline-none',
            'md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[85dvh] md:w-full md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-sheet',
            size === 'lg' ? 'md:max-w-180' : 'md:max-w-140',
          )}
        >
          <span data-sheet-handle aria-hidden="true" className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-border md:hidden" />
          <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2 md:px-6 md:pt-5">
            <div className="grid gap-1">
              <Dialog.Title className="text-lg leading-7 font-semibold text-text">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm leading-5 text-text-muted">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <Button variant="icon" aria-label="Kapat" icon={<X aria-hidden="true" className="size-5" />} />
            </Dialog.Close>
          </div>
          <div data-sheet-body className="min-h-0 flex-1 overflow-y-auto clip-safe overscroll-contain px-4 py-2 md:px-6">
            {children}
          </div>
          {footer ? (
            <div className="flex flex-none flex-wrap justify-end gap-2 border-t border-border px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-6">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
