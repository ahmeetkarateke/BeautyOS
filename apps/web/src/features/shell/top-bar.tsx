'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'
import { buildBottomNav, buildNav } from '@/lib/v2/nav-config'
import { useMe } from '@/lib/v2/session'
import { Avatar, personTone } from '@/ui/avatar'
import { buttonClassName } from '@/ui/button'
import { cn } from '@/ui/cn'
import { BrandMark } from './brand-mark'
import { isActivePath, screenTitle } from './shell-helpers'

// Telefon üst barı (tasarim.md §5). Ana ekranlarda marka + salon adı + müşteri ara + hesabım;
// alt ekranlarda geri oku + ekran adı + hesabım. Geri, Menü ekranına gider (tarayıcı geçmişine bağlı değil: doğrudan bağlantıda da çalışır).
export function TopBar({ className }: { className?: string }) {
  const me = useMe()
  const pathname = usePathname()
  const base = `/panel/${me.tenant.slug}`
  const topLevel = buildBottomNav(me).items.some((item) => isActivePath(pathname, item.href))
  const clients = buildNav(me).flatMap((group) => group.items).find((item) => item.id === 'clients')
  const account = (
    <Link href={`${base}/hesabim`} className={buttonClassName({ variant: 'icon' })}>
      {/* aria-label yerine gizli metin: görünür baş harfler adın parçası olmayınca axe label-content-name-mismatch verir. */}
      <span aria-hidden="true">
        <Avatar name={me.user.name} tone={me.staffId ? personTone(me.staffId) : undefined} size="sm" />
      </span>
      <span className="sr-only">Hesabım</span>
    </Link>
  )
  const title = screenTitle(buildNav(me).flatMap((group) => group.items), pathname, 'Hesabım')

  return (
    <header className={cn('sticky top-0 z-(--z-topbar) flex h-(--size-topbar) items-center gap-1 bg-page pl-4 pr-1', className)}>
      {topLevel ? (
        <>
          <BrandMark size={26} />
          <span className="ml-2 min-w-0 flex-1 truncate text-base font-semibold">{me.tenant.name}</span>
          {clients ? (
            <Link href={clients.href} aria-label="Müşteri ara" className={buttonClassName({ variant: 'icon' })}>
              <Search aria-hidden="true" className="size-5" />
            </Link>
          ) : null}
        </>
      ) : (
        <>
          <Link href={`${base}/menu`} aria-label="Geri" className={cn(buttonClassName({ variant: 'icon' }), '-ml-3')}>
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <span className="min-w-0 flex-1 truncate text-base font-semibold">{title}</span>
        </>
      )}
      {account}
    </header>
  )
}
