'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Building2, Shield, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminStore } from '@/store/admin'

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/tenants', icon: Building2, label: 'Tenantlar' },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const logoutAdmin = useAdminStore((s) => s.logoutAdmin)
  const admin = useAdminStore((s) => s.admin)

  const handleLogout = () => {
    logoutAdmin()
    router.push('/admin/login')
  }

  return (
    <aside className="flex flex-col w-64 bg-white border-r border-salon-border min-h-screen">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-salon-border">
        <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-gray-900">BeautyOS Admin</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-salon-muted hover:bg-salon-bg hover:text-gray-900',
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-salon-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-gray-600">
              {admin?.name?.charAt(0).toUpperCase() ?? 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{admin?.name}</p>
            <p className="text-xs text-salon-muted truncate">{admin?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-sm text-salon-muted hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Çıkış Yap
        </button>
      </div>
    </aside>
  )
}
