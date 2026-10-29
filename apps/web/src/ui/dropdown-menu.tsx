'use client'

import * as RadixMenu from '@radix-ui/react-dropdown-menu'
import { EllipsisVertical } from 'lucide-react'
import { Button } from './button'
import { cn } from './cn'

// Açılır menü (tasarim.md §4): "Diğer işlemler" (⋮). En yıkıcı eylem en altta ve kırmızı; Esc kapatır, odak tetikleyiciye döner.
export type MenuItem = { label: string; onSelect: () => void; danger?: boolean }

export function DropdownMenu({
  items,
  label = 'Diğer işlemler',
  className,
}: {
  items: readonly MenuItem[]
  /** Tetikleyicinin erişilebilir adı. */
  label?: string
  className?: string
}) {
  // Sıra kararlı: yıkıcı olmayanlar verildiği sırada, yıkıcılar en sonda.
  const ordered = [...items.filter((item) => !item.danger), ...items.filter((item) => item.danger)]
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>
        <Button variant="icon" aria-label={label} icon={<EllipsisVertical aria-hidden="true" className="size-5" />} className={className} />
      </RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content
          align="end"
          sideOffset={4}
          className="z-(--z-overlay) min-w-48 rounded-card border border-border bg-surface p-1 shadow-menu"
        >
          {ordered.map((item, index) => (
            <RadixMenu.Item
              key={`${index}-${item.label}`}
              onSelect={item.onSelect}
              className={cn(
                'flex min-h-(--size-control) cursor-pointer items-center rounded-control px-3 text-base outline-none',
                'data-[highlighted]:bg-surface-active',
                item.danger ? 'text-danger data-[highlighted]:bg-danger-bg' : 'text-text',
              )}
            >
              {item.label}
            </RadixMenu.Item>
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  )
}
