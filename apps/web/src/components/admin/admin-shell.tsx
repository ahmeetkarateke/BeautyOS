'use client'

import { usePathname } from 'next/navigation'
import { AdminGuard } from './admin-guard'
import { AdminSidebar } from './admin-sidebar'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/admin/login'

  if (isLogin) return <>{children}</>

  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-salon-bg">
        <AdminSidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </AdminGuard>
  )
}
