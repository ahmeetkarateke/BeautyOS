'use client'

import { useState, useEffect } from 'react'
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

  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 1280)
    const onResize = () => {
      if (window.innerWidth >= 1280) setSidebarOpen(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (isSubscriptionRequired) {
    return <AuthGuard>{children}</AuthGuard>
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-salon-bg dark:bg-[#0d0d1a]">
        <div className="hidden sm:flex flex-shrink-0">
          <Sidebar tenantSlug={slug} open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
        </div>
        <main className="flex-1 min-w-0 pb-16 sm:pb-0">
          {children}
        </main>
        <MobileNav tenantSlug={slug} />
      </div>
    </AuthGuard>
  )
}
