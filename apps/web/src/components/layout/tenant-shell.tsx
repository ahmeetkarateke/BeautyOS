'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { MobileNav } from './mobile-nav'
import { AuthGuard } from './auth-guard'

interface TenantShellProps {
  slug: string
  children: React.ReactNode
}

export function TenantShell({ slug, children }: TenantShellProps) {
  const pathname = usePathname()
  const isSubscriptionRequired = pathname?.endsWith('/subscription-required')

  if (isSubscriptionRequired) {
    return <AuthGuard>{children}</AuthGuard>
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-salon-bg dark:bg-[#0d0d1a]">
        <div className="hidden sm:flex">
          <Sidebar tenantSlug={slug} />
        </div>
        <main className="flex-1 min-w-0 pb-16 sm:pb-0">
          {children}
        </main>
        <MobileNav tenantSlug={slug} />
      </div>
    </AuthGuard>
  )
}
