'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  tenantSlug: string
}

const navItems = (slug: string) => [
  { href: `/tenant/${slug}/dashboard`, icon: LayoutDashboard, label: 'Dashboard' },
  { href: `/tenant/${slug}/appointments`, icon: Calendar, label: 'Randevular' },
  { href: `/tenant/${slug}/customers`, icon: Users, label: 'Müşteriler' },
  { href: `/tenant/${slug}/settings`, icon: Settings, label: 'Ayarlar' },
]

export function MobileNav({ tenantSlug }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-salon-border z-50 sm:hidden">
      <div className="grid grid-cols-4">
        {navItems(tenantSlug).map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center py-3 text-xs font-medium transition-colors touch-target',
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
