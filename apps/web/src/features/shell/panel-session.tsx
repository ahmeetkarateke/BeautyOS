'use client'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ApiError, createApiClient } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import { parseMe } from '@/lib/v2/me'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { AppShell } from './app-shell'
import { AccountInactiveScreen, ConnectionLostScreen, ErrorScreen, OfflineBar, SessionExpiredScreen } from './system-screens'

// Panel oturum kapısı. Sayfa açılışında HttpOnly çerezle token alır, /auth/me ile kimliği, izinleri ve salonu yükler.
// Adresteki salon kısaltması (slug) yalnız yönlendirme ipucudur: kiracıyı ve yetkiyi sunucunun /auth/me yanıtı belirler,
// adres başka salonu gösteriyorsa kullanıcı kendi paneline gönderilir ve o salona ait hiçbir şey çizilmez.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export type SessionHooks = { onSessionExpired: () => void; onSubscriptionRequired: () => void }

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; me: Me }
  | { kind: 'expired' }
  | { kind: 'inactive' }
  | { kind: 'offline' }
  | { kind: 'error' }
  | { kind: 'subscription' }

const defaultCreateClient = (hooks: SessionHooks) => createApiClient({ baseUrl: API_URL, ...hooks })

function classify(error: unknown): State {
  if (error instanceof ApiError) {
    if (error.status === 0) return { kind: 'offline' }
    if (error.code === 'TENANT_DELETED') return { kind: 'inactive' }
    if (error.status === 401) return { kind: 'expired' }
    if (error.status === 402) return { kind: 'subscription' }
  }
  return { kind: 'error' }
}

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

// Türk I'sı: kısaltmalar makine karşılaştırmasıdır, dil bağımsız küçük harf kullanılır.
const sameSlug = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

function LoadingScreen() {
  return (
    <SkeletonGroup className="grid min-h-dvh content-start gap-4 bg-page p-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </SkeletonGroup>
  )
}

export function PanelSession({
  slug,
  children,
  createClient = defaultCreateClient,
}: {
  slug: string
  children: ReactNode
  /** Testler için: gerçek ağ yerine sahte istemci verilebilir. */
  createClient?: (hooks: SessionHooks) => ApiClient
}) {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const stateRef = useRef(state)
  const [attempt, setAttempt] = useState(0)
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)

  const [client] = useState(() =>
    createClient({
      onSessionExpired: () => setState({ kind: 'expired' }),
      onSubscriptionRequired: () => setState({ kind: 'subscription' }),
    }),
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (!(await client.restoreSession())) {
          if (!cancelled) setState({ kind: 'expired' })
          return
        }
        const me = parseMe(await client.request('/api/v1/auth/me'))
        if (!cancelled) setState({ kind: 'ready', me })
      } catch (error) {
        if (!cancelled) setState(classify(error))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [client, attempt])

  // Düzen efekti: ekran "offline" çizildiği anda ref de güncel olmalı. Pasif efekt geç kalırsa
  // hemen ardından gelen "online" olayı eski durumu görüp yeniden denemeyi sessizce atlar.
  useLayoutEffect(() => {
    stateRef.current = state
  })

  useEffect(() => {
    const goOnline = () => {
      // Sunucuya ulaşılamadığı için açılamayan oturum, bağlantı gelince kendiliğinden yeniden denenir.
      if (stateRef.current.kind === 'offline') {
        setState({ kind: 'loading' })
        setAttempt((n) => n + 1)
      }
    }
    window.addEventListener('online', goOnline)
    return () => window.removeEventListener('online', goOnline)
  }, [])

  // Abonelik bitti (402): kullanıcı abonelik ekranına gider; yönlendirme sürerken yükleme görünür.
  const subscriptionEnded = state.kind === 'subscription'
  useEffect(() => {
    if (subscriptionEnded) router.replace(`/panel/${slug}/abonelik-bitti`)
  }, [subscriptionEnded, slug, router])

  const foreignSalon = state.kind === 'ready' && !sameSlug(state.me.tenant.slug, slug)
  const ownSlug = state.kind === 'ready' ? state.me.tenant.slug : null
  useEffect(() => {
    if (foreignSalon && ownSlug) router.replace(`/panel/${ownSlug}/bugun`)
  }, [foreignSalon, ownSlug, router])

  switch (state.kind) {
    case 'loading':
    case 'subscription':
      return <LoadingScreen />
    case 'expired':
      return <SessionExpiredScreen />
    case 'inactive':
      return <AccountInactiveScreen />
    case 'offline':
      return <ConnectionLostScreen onRetry={() => { setState({ kind: 'loading' }); setAttempt((n) => n + 1) }} />
    case 'error':
      return <ErrorScreen reset={() => { setState({ kind: 'loading' }); setAttempt((n) => n + 1) }} />
    case 'ready':
      if (foreignSalon) return <LoadingScreen />
      return (
        <ApiClientProvider client={client}>
          <MeProvider me={state.me}>
            <AppShell>{children}</AppShell>
          </MeProvider>
          {online ? null : <OfflineBar />}
        </ApiClientProvider>
      )
  }
}
