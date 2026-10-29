'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useRef } from 'react'
import { Button } from './button'

// Onay penceresi (tasarim.md §4, metin-rehberi §4.3): başlık eylemi sorar, gövde sonucu söyler,
// eylem düğmesi eylemin adını taşır; ikincil "Vazgeç". İlk odak güvenli eylemdedir.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  onConfirm,
  loading = false,
  loadingText,
  cancelLabel = 'Vazgeç',
  destructive = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Eylemin adı: "Müşteriyi sil". "Tamam" ya da "Evet" olmaz. */
  actionLabel: string
  onConfirm: () => void
  loading?: boolean
  loadingText?: string
  cancelLabel?: string
  /** Dolu kırmızı yalnız yıkıcı eylemde; aksi halde birincil düğme. */
  destructive?: boolean
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  // Silme gibi işlem giderken pencere kapanmaz: kullanıcı sonucu görmeden belirsizlikte kalmasın.
  const guardedOpenChange = (next: boolean) => {
    if (!loading) onOpenChange(next)
  }
  return (
    <Dialog.Root open={open} onOpenChange={guardedOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-text/40" />
        <Dialog.Content
          role="alertdialog"
          onOpenAutoFocus={(event) => {
            openerRef.current = document.activeElement as HTMLElement | null
            event.preventDefault()
            cancelRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            openerRef.current?.focus()
          }}
          className="fixed inset-x-4 top-1/2 z-(--z-overlay) mx-auto grid max-w-105 -translate-y-1/2 gap-4 rounded-sheet bg-surface p-6 shadow-floating outline-none"
        >
          <div className="grid gap-2">
            <Dialog.Title className="text-lg leading-7 font-semibold text-text">{title}</Dialog.Title>
            <Dialog.Description className="text-base leading-6 text-text-secondary">{description}</Dialog.Description>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button ref={cancelRef} variant="secondary" onClick={() => guardedOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'danger-solid' : 'primary'}
              loading={loading}
              loadingText={loadingText}
              onClick={onConfirm}
            >
              {actionLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
