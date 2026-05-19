'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, Users, Settings, Sparkles, UserCog, Banknote, MessageSquare, Clock, Boxes, HandCoins, Wallet, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useActiveModules } from '@/hooks/use-active-modules'

interface MobileNavProps {
  tenantSlug: string
}

const BOT_FEATURES_ENABLED = process.env.NEXT_PUBLIC_BOT_FEATURES_ENABLED === 'true'

const navItems = (slug: string) => [
  { href: `/tenant/${slug}/dashboard`,     icon: LayoutDashboard, label: 'Dashboard',  moduleKey: 'dashboard' },
  { href: `/tenant/${slug}/appointments`,  icon: Calendar,         label: 'Randevular', moduleKey: 'appointments' },
  { href: `/tenant/${slug}/customers`,     icon: Users,            label: 'Müşteriler', moduleKey: 'customers' },
  { href: `/tenant/${slug}/waitlist`,      icon: Clock,            label: 'Bekleme',    moduleKey: 'waitlist' },
  { href: `/tenant/${slug}/services`,      icon: Sparkles,         label: 'Hizmetler',  moduleKey: 'services' },
  { href: `/tenant/${slug}/packages`,      icon: Boxes,            label: 'Paketler',   moduleKey: 'packages' },
  { href: `/tenant/${slug}/staff`,         icon: UserCog,          label: 'Personel',   moduleKey: 'staff' },
  { href: `/tenant/${slug}/staff-payouts`, icon: Wallet,           label: 'Ödemeler',   moduleKey: 'staff-payouts' },
  { href: `/tenant/${slug}/tips`,          icon: HandCoins,        label: 'Bahşiş',     moduleKey: 'tips' },
  { href: `/tenant/${slug}/inventory`,     icon: Package,          label: 'Stok',       moduleKey: 'inventory' },
  { href: `/tenant/${slug}/finance`,       icon: Banknote,         label: 'Kasa',       moduleKey: 'finance' },
  ...(BOT_FEATURES_ENABLED ? [{ href: `/tenant/${slug}/bot-conversations`, icon: MessageSquare, label: 'Bot', moduleKey: undefined as string | undefined }] : []),
  { href: `/tenant/${slug}/settings`,      icon: Settings,         label: 'Ayarlar',    moduleKey: 'settings' },
]

export function MobileNav({ tenantSlug }: MobileNavProps) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const { activeModules } = useActiveModules(tenantSlug)
  const activeSet = new Set(activeModules)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-salon-border z-50 sm:hidden">
      <div className="flex overflow-x-auto scrollbar-none">
        {navItems(tenantSlug)
          .filter((item) => !item.moduleKey || activeSet.has(item.moduleKey))
          .filter((item) =>
            user?.role !== 'staff' ||
            !['/staff', '/staff-payouts', '/finance', '/settings'].some((p) => item.href.endsWith(p)),
          )
          .map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center py-3 px-3 text-xs font-medium transition-colors touch-target flex-shrink-0 min-w-[64px]',
                active ? 'text-primary' : 'text-salon-muted',
              )}
            >
              <Icon className={cn('w-5 h-5 mb-1', active && 'text-primary')} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
