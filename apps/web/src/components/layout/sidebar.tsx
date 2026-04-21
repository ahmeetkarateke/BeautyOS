'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Scissors, LayoutDashboard, Calendar, Users, Settings, LogOut, Sparkles, UserCog, Banknote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'next/navigation'

interface SidebarProps {
  tenantSlug: string
}

const navItems = (slug: string) => [
  { href: `/tenant/${slug}/dashboard`, icon: LayoutDashboard, label: 'Dashboard' },
  { href: `/tenant/${slug}/appointments`, icon: Calendar, label: 'Randevular' },
  { href: `/tenant/${slug}/customers`, icon: Users, label: 'Müşteriler' },
  { href: `/tenant/${slug}/services`, icon: Sparkles, label: 'Hizmetler' },
  { href: `/tenant/${slug}/staff`, icon: UserCog, label: 'Personel' },
  { href: `/tenant/${slug}/finance`, icon: Banknote, label: 'Kasa' },
  { href: `/tenant/${slug}/settings`, icon: Settings, label: 'Ayarlar' },
]

export function Sidebar({ tenantSlug }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col w-64 bg-white border-r border-salon-border min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-salon-border">
        <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <Scissors className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-gray-900">BeautyOS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems(tenantSlug).map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors touch-target',
                active
                  ? 'bg-primary-50 text-primary'
                  : 'text-salon-muted hover:bg-salon-bg hover:text-gray-900',
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-salon-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-primary">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-salon-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-sm text-salon-muted hover:bg-red-50 hover:text-red-600 transition-colors touch-target"
        >
          <LogOut className="w-5 h-5" />
          Çıkış Yap
        </button>
      </div>
    </aside>
  )
}
