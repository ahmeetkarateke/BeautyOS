'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, ChevronRight, LogOut, UserRound } from 'lucide-react'
import { buildNav } from '@/lib/v2/nav-config'
import type { NavGroup, NavItem } from '@/lib/v2/nav-config'
import { signOut, useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { Avatar, personTone } from '@/ui/avatar'
import { cn } from '@/ui/cn'
import { BrandMark } from './brand-mark'
import { NavIcon } from './nav-icons'
import { isActivePath, roleLabel, useManagementOpen } from './shell-helpers'

// Masaüstü yan menü (tasarim.md §5, 1024 px ve üstü): 248 px, zemin renginde. Rol dışı öğe GİZLİ (buildNav), kapalı modül görünmez.
const itemClass =
  'flex min-h-9 items-center gap-2.5 rounded-control px-2.5 text-sm font-medium text-text-secondary no-underline ' +
  'hover:bg-surface-active hover:text-text pointer-coarse:min-h-11 aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-soft-text'

function SideLink({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <Link href={item.href} aria-current={isActivePath(pathname, item.href) ? 'page' : undefined} className={itemClass}>
      <NavIcon id={item.icon} />
      <span>{item.label}</span>
    </Link>
  )
}

function GroupLabel({ children }: { children: string }) {
  return <p className="mt-4 px-2.5 pb-1.5 text-xs text-text-muted">{children}</p>
}

function ManagementGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, toggle] = useManagementOpen()
  const listId = 'yan-menu-yonetim'
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggle}
        className="mt-4 flex w-full cursor-pointer items-center justify-between rounded-control border-0 bg-transparent px-2.5 pb-1.5 text-left text-xs text-text-muted hover:text-text"
      >
        <span>{group.label}</span>
        <Chevron aria-hidden="true" className="size-4" />
      </button>
      {open ? (
        <ul id={listId} className="m-0 grid list-none gap-0.5 p-0">
          {group.items.map((item) => (
            <li key={item.id}>
              <SideLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function SideNav({ className }: { className?: string }) {
  const me = useMe()
  const client = useApiClient()
  const pathname = usePathname()
  const groups = buildNav(me)
  const settings = groups.find((group) => group.id === 'settings')?.items[0]
  const base = `/panel/${me.tenant.slug}`
  const account: NavItem = { id: 'account', label: 'Hesabım', href: `${base}/hesabim`, icon: 'staff' }
  const homeHref = groups[0]?.items[0]?.href ?? base

  return (
    <aside className={cn('sticky top-0 h-dvh flex-col gap-0.5 overflow-y-auto clip-safe border-r border-border bg-page px-3 py-4', className)}>
      <Link href={homeHref} aria-label="BeautyOS ana sayfa" className="flex items-center gap-2.5 px-2 pb-3 pt-1 text-text no-underline">
        <BrandMark />
        <span className="text-base font-semibold tracking-tight">BeautyOS</span>
      </Link>
      <div className="mb-3 flex items-center gap-2.5 rounded-card border border-border bg-surface p-2">
        <span aria-hidden="true" className="grid size-7 flex-none place-items-center rounded-full bg-primary text-xs font-semibold text-on-primary">
          {me.tenant.name.split(/\s+/).slice(0, 2).map((word) => word.charAt(0).toLocaleUpperCase('tr-TR')).join('')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-5">{me.tenant.name}</span>
          <span className="block text-xs text-text-muted">{roleLabel(me)}</span>
        </span>
      </div>

      <nav aria-label="Ana menü" className="flex flex-1 flex-col gap-0.5">
        {groups
          .filter((group) => group.id !== 'settings')
          .map((group) =>
            group.id === 'management' ? (
              <ManagementGroup key={group.id} group={group} pathname={pathname} />
            ) : (
              <div key={group.id} className="grid gap-0.5">
                {group.label ? <GroupLabel>{group.label}</GroupLabel> : null}
                <ul className="m-0 grid list-none gap-0.5 p-0">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <SideLink item={item} pathname={pathname} />
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        <div className="mt-auto pt-3">
          <SideLink item={settings ?? account} pathname={pathname} />
        </div>
      </nav>

      <div className="grid gap-0.5 pt-1">
        <div className="flex items-center gap-2.5 rounded-card p-2">
          <Avatar name={me.user.name} tone={me.staffId ? personTone(me.staffId) : undefined} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium leading-5">{me.user.name}</span>
            <span className="block text-xs text-text-muted">{roleLabel(me)}</span>
          </span>
          {settings ? (
            <Link href={account.href} aria-label="Hesabım" className="grid size-9 place-items-center rounded-control text-text-secondary hover:bg-surface-active hover:text-text">
              <UserRound aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
          <button
            type="button"
            aria-label="Çıkış yap"
            onClick={() => void signOut(client)}
            className="grid size-9 cursor-pointer place-items-center rounded-control border-0 bg-transparent text-text-secondary hover:bg-surface-active hover:text-text"
          >
            <LogOut aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
