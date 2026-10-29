'use client'

import Link from 'next/link'
import { ChevronRight, LogOut, UserRound } from 'lucide-react'
import { buildNav } from '@/lib/v2/nav-config'
import { signOut, useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { Button } from '@/ui/button'
import { NavIcon } from './nav-icons'

// Menü ekranı (tasarim.md §5, telefon): izinli tüm hedefler gruplu + Hesabım + Çıkış yap. Masaüstünde yan menü olduğundan
// bu ekrana bağlantı yoktur; adres çubuğundan açılırsa aynı liste görünür.
const rowClass =
  'flex min-h-14 items-center gap-3 px-4 text-base text-text no-underline hover:bg-surface-subtle'

export function MenuScreen() {
  const me = useMe()
  const client = useApiClient()
  const groups = buildNav(me)
  const account = { id: 'account', label: 'Hesabım', href: `/panel/${me.tenant.slug}/hesabim` }

  return (
    <div className="grid gap-4">
      <h1 className="mb-1 mt-1 text-xl font-semibold">Menü</h1>
      {groups.map((group) => {
        const headingId = `menu-grup-${group.id}`
        return (
          <section key={group.id} aria-labelledby={group.label ? headingId : undefined}>
            {group.label ? (
              <h2 id={headingId} className="mb-1.5 px-1 text-sm text-text-muted">
                {group.label}
              </h2>
            ) : null}
            <ul className="m-0 list-none divide-y divide-border overflow-hidden [&_:focus-visible]:-outline-offset-2 rounded-card border border-border bg-surface p-0">
              {group.items.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className={rowClass}>
                    <NavIcon id={item.icon} className="text-text-secondary" />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight aria-hidden="true" className="size-4 text-text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <ul className="m-0 list-none divide-y divide-border overflow-hidden [&_:focus-visible]:-outline-offset-2 rounded-card border border-border bg-surface p-0">
        <li>
          <Link href={account.href} className={rowClass}>
            <UserRound aria-hidden="true" className="size-5 flex-none text-text-secondary" strokeWidth={1.75} />
            <span className="flex-1">{account.label}</span>
            <ChevronRight aria-hidden="true" className="size-4 text-text-muted" />
          </Link>
        </li>
      </ul>
      <Button variant="secondary" icon={<LogOut aria-hidden="true" className="size-4" />} onClick={() => void signOut(client)}>
        Çıkış yap
      </Button>
    </div>
  )
}
