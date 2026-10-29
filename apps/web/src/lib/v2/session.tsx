'use client'

import Link from 'next/link'
import { createContext, use, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { PermissionKey } from '@beautyos/shared'
import { resolveTerm, type TermForm, type TermKey } from '@/content/terms'
import { Forbidden } from '@/ui/states'
import type { Me } from './me'

// Oturum bağlamı: /auth/me yanıtı tek kaynaktır (ADR-UI-09, 10). Web izni ya da terimi kendisi hesaplamaz.
const MeContext = createContext<Me | null>(null)

export function MeProvider({ me, children }: { me: Me; children: ReactNode }) {
  return <MeContext value={me}>{children}</MeContext>
}

export function useMe(): Me {
  const me = use(MeContext)
  if (!me) throw new Error('useMe, MeProvider içinde kullanılmalıdır.')
  return me
}

/** Sunucunun bildirdiği etkin izin listesine bakar. Yalnız gösterimi yönetir; yetkiyi sunucu zorlar. */
export function useCan(permission: PermissionKey): boolean {
  return useMe().permissions.includes(permission)
}

export function useTerm(): (key: TermKey, form?: TermForm) => string {
  const { tenant } = useMe()
  return useMemo(
    () => (key, form) => resolveTerm(tenant.termSet, tenant.terms, key, form),
    [tenant.termSet, tenant.terms],
  )
}

/** Rota koruması: izin yoksa "Yetkisiz" ekranı (içerik hiç çizilmez). */
export function RequirePermission({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  const me = useMe()
  if (!me.permissions.includes(permission)) {
    return <Forbidden action={<Link href={`/panel/${me.tenant.slug}/bugun`}>Bugün’e dön</Link>} />
  }
  return <>{children}</>
}
