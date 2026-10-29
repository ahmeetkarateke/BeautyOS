'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buildBottomNav } from '@/lib/v2/nav-config'
import { useMe } from '@/lib/v2/session'
import { cn } from '@/ui/cn'
import { NavIcon } from './nav-icons'
import { isActivePath } from './shell-helpers'

// Telefon alt menüsü (tasarim.md §5, 1023 px'e kadar): Bugün · Takvim · [+] · Müşteriler · Menü. Uzmanda Günüm dizilimi.
// Menü öğesi; ana üç öğeden hiçbiri etkin değilse (alt ekranlarda) etkin görünür.
const tabClass =
  'grid place-items-center content-center gap-0.5 border-0 bg-transparent text-xs font-medium leading-4 text-text-muted no-underline ' +
  'aria-[current=page]:text-text'

export function BottomNav({ className }: { className?: string }) {
  const me = useMe()
  const pathname = usePathname()
  const { items, create } = buildBottomNav(me)
  const mainActive = items.some((item) => item.id !== 'menu' && isActivePath(pathname, item.href))

  const tabs = items.map((item) => {
    const active = item.id === 'menu' ? !mainActive : isActivePath(pathname, item.href)
    return (
      <Link key={item.id} href={item.href} aria-current={active ? 'page' : undefined} className={tabClass}>
        <NavIcon id={item.icon} className="size-6" />
        <span>{item.label}</span>
      </Link>
    )
  })
  if (create) {
    tabs.splice(
      Math.floor(items.length / 2),
      0,
      <Link
        key="create"
        href={create.href}
        aria-label={create.label}
        data-testid="alt-menu-randevu"
        className="grid size-13 place-items-center self-center justify-self-center rounded-full bg-primary text-on-primary hover:bg-primary-hover"
      >
        <NavIcon id="plus" className="size-6" />
      </Link>,
    )
  }

  return (
    <nav
      aria-label="Alt menü"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      className={cn(
        'fixed inset-x-0 bottom-0 z-(--z-bottombar) grid h-[calc(var(--size-bottombar)+env(safe-area-inset-bottom))] border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      {tabs}
    </nav>
  )
}
