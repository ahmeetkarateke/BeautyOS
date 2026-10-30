'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import { BrandMark } from '@/features/shell/brand-mark'
import { cn } from '@/ui/cn'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/** Giriş yüzeyinin tek apiClient'ı (token bellekte). Oturum olmadığı için süre-doldu bildirimi yoktur. */
export function AuthClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createApiClient({ baseUrl: API_URL }))
  return <ApiClientProvider client={client}>{children}</ApiClientProvider>
}

/** Ekran değişince odağı başlığa taşır (ekran okuyucu yeni içeriği duyurur, klavye kullanıcısı başa döner). */
export function useFocusHeading(dep: unknown) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [dep])
  return ref
}

type ShellProps = {
  title: string
  lead?: ReactNode
  /** Adım göstergesi ("Adım 1/2"). */
  stepLabel?: string
  children: ReactNode
  /** Odağın başlığa taşınmasını tetikleyen değer (ör. adım numarası). */
  focusKey?: unknown
  footerLinks?: boolean
}

// Prototip: giris.html. Açık zemin, tek sütun 440 px, satış iddiası yok.
export function AuthShell({ title, lead, stepLabel, children, focusKey, footerLinks = true }: ShellProps) {
  const headingRef = useFocusHeading(focusKey ?? title)
  return (
    <div className="flex min-h-dvh flex-col items-center bg-page px-4 py-6">
      <header className="w-full max-w-110">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-text no-underline">
          <BrandMark />
          BeautyOS
        </Link>
      </header>
      <main className={cn('mt-8 w-full max-w-110 sm:mt-16')}>
        {stepLabel ? <p className="text-sm text-text-muted">{stepLabel}</p> : null}
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl leading-8 font-semibold tracking-tight outline-none sm:text-[2rem] sm:leading-10">
          {title}
        </h1>
        {lead ? <p className="mt-1.5 text-text-secondary">{lead}</p> : null}
        <div className="mt-6">{children}</div>
      </main>
      {footerLinks ? (
        <footer className="mt-auto flex flex-wrap justify-center gap-x-3 pt-8 text-xs text-text-muted">
          <Link href="/sartlar" className="inline-flex min-h-11 items-center text-inherit">
            Kullanım şartları
          </Link>
          <Link href="/gizlilik" className="inline-flex min-h-11 items-center text-inherit">
            Gizlilik politikası
          </Link>
          <Link href="/kvkk" className="inline-flex min-h-11 items-center text-inherit">
            KVKK aydınlatma metni
          </Link>
        </footer>
      ) : null}
    </div>
  )
}
