'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Calendar, Users, Clock, Menu, X, LogOut,
  Sparkles, UserCog, Banknote, MessageSquare, Wallet, Package, Boxes, HandCoins, Settings, Scissors, BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useActiveModules } from '@/hooks/use-active-modules'

interface MobileNavProps {
  tenantSlug: string
}

const BOT_FEATURES_ENABLED = process.env.NEXT_PUBLIC_BOT_FEATURES_ENABLED === 'true'

interface NavItem {
  href: string
  icon: typeof LayoutDashboard
  label: string
  moduleKey?: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const BOTTOM_BAR_ITEMS = (slug: string): NavItem[] => [
  { href: `/tenant/${slug}/dashboard`,    icon: LayoutDashboard, label: 'Bugün',     moduleKey: 'dashboard' },
  { href: `/tenant/${slug}/appointments`, icon: Calendar,         label: 'Randevu',   moduleKey: 'appointments' },
  { href: `/tenant/${slug}/customers`,    icon: Users,            label: 'Müşteri',   moduleKey: 'customers' },
  { href: `/tenant/${slug}/waitlist`,     icon: Clock,            label: 'Bekleme',   moduleKey: 'waitlist' },
]

const DRAWER_GROUPS = (slug: string): NavGroup[] => [
  {
    label: 'GÜNLÜK',
    items: [
      { href: `/tenant/${slug}/dashboard`,    icon: LayoutDashboard, label: 'Dashboard',        moduleKey: 'dashboard' },
      { href: `/tenant/${slug}/appointments`, icon: Calendar,         label: 'Randevular',      moduleKey: 'appointments' },
      { href: `/tenant/${slug}/waitlist`,     icon: Clock,            label: 'Bekleme Listesi', moduleKey: 'waitlist' },
    ],
  },
  {
    label: 'MÜŞTERİ',
    items: [
      { href: `/tenant/${slug}/customers`, icon: Users, label: 'Müşteriler', moduleKey: 'customers' },
      { href: `/tenant/${slug}/packages`,  icon: Boxes, label: 'Paketler',   moduleKey: 'packages' },
    ],
  },
  {
    label: 'PERSONEL & HİZMET',
    items: [
      { href: `/tenant/${slug}/services`,      icon: Sparkles,  label: 'Hizmetler',          moduleKey: 'services' },
      { href: `/tenant/${slug}/staff`,         icon: UserCog,   label: 'Personel',           moduleKey: 'staff' },
      { href: `/tenant/${slug}/staff-payouts`, icon: Wallet,    label: 'Personel Ödemeleri', moduleKey: 'staff-payouts' },
      { href: `/tenant/${slug}/tips`,          icon: HandCoins, label: 'Bahşiş',             moduleKey: 'tips' },
    ],
  },
  {
    label: 'FİNANS & STOK',
    items: [
      { href: `/tenant/${slug}/finance`,          icon: Banknote, label: 'Kasa',       moduleKey: 'finance' },
      { href: `/tenant/${slug}/current-accounts`, icon: BookOpen, label: 'Cari Hesap', moduleKey: 'current-accounts' },
      { href: `/tenant/${slug}/inventory`,        icon: Package,  label: 'Stok',       moduleKey: 'inventory' },
    ],
  },
  ...(BOT_FEATURES_ENABLED
    ? [{
        label: 'BOT',
        items: [{ href: `/tenant/${slug}/bot-conversations`, icon: MessageSquare, label: 'Bot Konuşmaları' } as NavItem],
      }]
    : []),
]

const STAFF_EXCLUDED_SUFFIXES = ['/staff', '/staff-payouts', '/finance', '/settings']

function isVisibleForRole(href: string, role?: string): boolean {
  if (role !== 'staff') return true
  return !STAFF_EXCLUDED_SUFFIXES.some((p) => href.endsWith(p))
}

export function MobileNav({ tenantSlug }: MobileNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { activeModules } = useActiveModules(tenantSlug)
  const activeSet = new Set(activeModules)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Drawer açıkken body scroll engelle.
  // Sadece drawer açıkken müdahale et — kapalı durumda body.style'a dokunma
  // (Radix Dialog'un kendi scroll-lock'unu bozma riski var).
  useEffect(() => {
    if (!drawerOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [drawerOpen])

  // Path değişince drawer kapansın
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  function visibleItem(item: NavItem): boolean {
    if (item.moduleKey && !activeSet.has(item.moduleKey)) return false
    if (!isVisibleForRole(item.href, user?.role)) return false
    return true
  }

  const bottomItems = BOTTOM_BAR_ITEMS(tenantSlug).filter(visibleItem)

  const visibleGroups: NavGroup[] = DRAWER_GROUPS(tenantSlug)
    .map((g) => ({ ...g, items: g.items.filter(visibleItem) }))
    .filter((g) => g.items.length > 0)

  const showSettings = activeSet.has('settings') && isVisibleForRole(`/tenant/${tenantSlug}/settings`, user?.role)

  function handleLogout() {
    setDrawerOpen(false)
    logout()
    router.push('/login')
  }

  return (
    <>
      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0f0f1a] border-t border-salon-border dark:border-white/8 z-40 sm:hidden">
        <div className="flex items-stretch">
          {bottomItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center py-2.5 text-[11px] font-medium transition-colors touch-target min-w-0',
                  active ? 'text-primary' : 'text-salon-muted dark:text-white/50',
                )}
              >
                <Icon className={cn('w-5 h-5 mb-0.5', active && 'text-primary')} />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-2.5 text-[11px] font-medium text-salon-muted dark:text-white/50 touch-target min-w-0"
            aria-label="Tüm menü"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span>Tümü</span>
          </button>
        </div>
      </nav>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 sm:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel — sağdan slide-in */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-[88%] max-w-xs bg-white dark:bg-[#0f0f1a] border-l border-salon-border dark:border-white/8 transform transition-transform duration-300 sm:hidden flex flex-col',
          drawerOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-salon-border dark:border-white/8 h-14 px-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">BeautyOS</span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-md text-salon-muted hover:bg-salon-bg dark:text-white/50 dark:hover:bg-white/5"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer nav (kategorize) */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group, gi) => (
            <div key={group.label} className={cn(gi > 0 && 'mt-5')}>
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-widest text-salon-muted/70 dark:text-white/30 uppercase">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm font-medium transition-colors touch-target',
                        active
                          ? 'bg-primary-50 text-primary dark:bg-primary/15 dark:text-primary'
                          : 'text-salon-muted hover:bg-salon-bg hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white',
                      )}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {showSettings && (
            <div className="mt-5 pt-3 border-t border-salon-border/40 dark:border-white/8">
              <Link
                href={`/tenant/${tenantSlug}/settings`}
                className={cn(
                  'flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm font-medium transition-colors touch-target',
                  pathname.startsWith(`/tenant/${tenantSlug}/settings`)
                    ? 'bg-primary-50 text-primary dark:bg-primary/15 dark:text-primary'
                    : 'text-salon-muted hover:bg-salon-bg hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white',
                )}
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">Ayarlar</span>
              </Link>
            </div>
          )}
        </div>

        {/* Drawer footer — kullanıcı + çıkış */}
        <div className="border-t border-salon-border dark:border-white/8 px-3 py-3 space-y-1 flex-shrink-0">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-primary">
                {user?.name?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-xs text-salon-muted dark:text-white/40 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm text-salon-muted hover:bg-red-50 hover:text-red-600 dark:text-white/40 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors touch-target"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>
    </>
  )
}
