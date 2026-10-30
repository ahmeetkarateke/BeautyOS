'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createApiClient } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider, signOut, useApiClient } from '@/lib/v2/api-context'
import { BrandMark } from '@/features/shell/brand-mark'
import { Button } from '@/ui/button'
import { cn } from '@/ui/cn'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { ToastProvider } from '@/ui/toast'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
export const ADMIN_LOGIN_PATH = '/admin/login'

const NAV = [
  { href: '/admin', label: 'Genel bakış' },
  { href: '/admin/salonlar', label: 'Salonlar' },
  { href: '/admin/yasal', label: 'Yasal belgeler' },
] as const

type Navigate = (path: string) => void
const defaultNavigate: Navigate = (path) => window.location.assign(path)
const defaultCreateClient = () => createApiClient({ baseUrl: API_URL })

// Yönetim paneli oturum kapısı. Yetki sunucudadır (her admin ucu süper yönetici ister); burada yalnız oturum yoksa giriş ekranına gidilir.
export function AdminSession({
  children,
  createClient = defaultCreateClient,
  navigate = defaultNavigate,
}: {
  children: ReactNode
  createClient?: () => ApiClient
  navigate?: Navigate
}) {
  const [client] = useState(createClient)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    void client.restoreSession().then((ok) => {
      if (cancelled) return
      if (ok) setReady(true)
      else navigate(ADMIN_LOGIN_PATH)
    })
    return () => {
      cancelled = true
    }
  }, [client, navigate])

  if (!ready) {
    return (
      <SkeletonGroup className="grid min-h-dvh content-start gap-4 bg-page p-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </SkeletonGroup>
    )
  }
  return (
    <ApiClientProvider client={client}>
      <ToastProvider>
        <AdminShell navigate={navigate}>{children}</AdminShell>
      </ToastProvider>
    </ApiClientProvider>
  )
}

function AdminShell({ children, navigate }: { children: ReactNode; navigate: Navigate }) {
  const client = useApiClient()
  const pathname = usePathname()
  const isCurrent = (href: string) => (href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`))
  return (
    <div className="min-h-dvh bg-page text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 font-semibold text-text no-underline">
            <BrandMark />
            Sistem yönetimi
          </Link>
          <span className="rounded-tag bg-surface-active px-2 py-0.5 text-xs text-text-secondary">Yönetim paneli</span>
          <div className="ml-auto">
            <Button variant="secondary" size="sm" onClick={() => void signOut(client, () => navigate(ADMIN_LOGIN_PATH))}>
              Çıkış yap
            </Button>
          </div>
        </div>
        <nav aria-label="Yönetim menüsü" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 [&_:focus-visible]:-outline-offset-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? 'page' : undefined}
              className={cn('inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium text-text-secondary no-underline aria-[current=page]:border-primary aria-[current=page]:text-text')}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6">{children}</main>
    </div>
  )
}
