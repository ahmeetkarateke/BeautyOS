'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Scissors, LayoutDashboard, Calendar, Users, Settings, LogOut,
  Sparkles, UserCog, Banknote, Sun, Moon, Menu, X, MessageSquare, Clock, Wallet, Package, Boxes, HandCoins, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { useActiveModules } from '@/hooks/use-active-modules'

interface SidebarProps {
  tenantSlug: string
  open: boolean
  onToggle: () => void
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

const navGroups = (slug: string): NavGroup[] => [
  {
    label: 'GÜNLÜK',
    items: [
      { href: `/tenant/${slug}/dashboard`,    icon: LayoutDashboard, label: 'Dashboard',         moduleKey: 'dashboard' },
      { href: `/tenant/${slug}/appointments`, icon: Calendar,         label: 'Randevular',       moduleKey: 'appointments' },
      { href: `/tenant/${slug}/waitlist`,     icon: Clock,            label: 'Bekleme Listesi',  moduleKey: 'waitlist' },
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
      { href: `/tenant/${slug}/finance`,   icon: Banknote, label: 'Kasa', moduleKey: 'finance' },
      { href: `/tenant/${slug}/inventory`, icon: Package,  label: 'Stok', moduleKey: 'inventory' },
    ],
  },
  ...(BOT_FEATURES_ENABLED
    ? [{
        label: 'BOT',
        items: [{ href: `/tenant/${slug}/bot-conversations`, icon: MessageSquare, label: 'Bot Konuşmaları' } as NavItem],
      }]
    : []),
]

interface TrialSettings {
  plan?: string
  trialEndsAt?: string
}

function trialDaysLeft(trialEndsAt: string): number {
  const end = new Date(trialEndsAt)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const STAFF_EXCLUDED_SUFFIXES = ['/staff', '/staff-payouts', '/finance', '/settings']

function isVisibleForRole(href: string, role?: string): boolean {
  if (role !== 'staff') return true
  return !STAFF_EXCLUDED_SUFFIXES.some((p) => href.endsWith(p))
}

export function Sidebar({ tenantSlug, open, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const { dark, toggle } = useThemeStore()

  const { data: settingsData } = useQuery({
    queryKey: ['tenant-settings', tenantSlug],
    queryFn: () => apiFetch<TrialSettings>(`/api/v1/tenants/${tenantSlug}/settings`),
  })

  const plan = settingsData?.plan
  const trialEndsAt = settingsData?.trialEndsAt
  const days = trialEndsAt ? trialDaysLeft(trialEndsAt) : null

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const { activeModules } = useActiveModules(tenantSlug)
  const activeSet = new Set(activeModules)

  // Açılır/kapanır grup state'i — localStorage ile persist
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('beautyos_sidebar_collapsed')
      if (raw) setCollapsed(JSON.parse(raw))
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])
  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] }
      try { localStorage.setItem('beautyos_sidebar_collapsed', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  // Aktif modüller + rol filtresi
  const visibleGroups: NavGroup[] = navGroups(tenantSlug)
    .map((g) => ({
      ...g,
      items: g.items
        .filter((item) => !item.moduleKey || activeSet.has(item.moduleKey))
        .filter((item) => isVisibleForRole(item.href, user?.role)),
    }))
    .filter((g) => g.items.length > 0)

  const settingsHref = `/tenant/${tenantSlug}/settings`
  const showSettings = isVisibleForRole(settingsHref, user?.role) && activeSet.has('settings')

  return (
    <aside
      className={cn(
        'flex flex-col min-h-screen bg-white border-r border-salon-border dark:bg-[#0f0f1a] dark:border-white/8 transition-all duration-300',
        open ? 'w-64' : 'w-16',
      )}
    >
      {/* Logo + Toggle */}
      <div className="flex items-center border-b border-salon-border dark:border-white/8 h-[61px] px-3 flex-shrink-0">
        <button
          onClick={onToggle}
          className="w-10 h-10 flex items-center justify-center rounded-md text-salon-muted hover:bg-salon-bg dark:text-white/50 dark:hover:bg-white/5 transition-colors flex-shrink-0"
          aria-label="Menüyü aç/kapat"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {open && (
          <div className="flex items-center gap-2.5 ml-1 overflow-hidden">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center flex-shrink-0 dark:shadow-[0_0_12px_rgba(107,72,255,0.4)]">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">BeautyOS</span>
          </div>
        )}
      </div>

      {/* Nav — kategorize, accordion */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {visibleGroups.map((group, gi) => {
          // Aktif sayfa içeren grubu otomatik açık tut (kullanıcı manuel kapatsa bile)
          const hasActiveChild = group.items.some(
            (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
          )
          // Sidebar daraltılmışsa (icon-only) — başlık + chevron yerine sadece itemları göster
          const isCollapsed = open && hydrated && !hasActiveChild && collapsed[group.label] === true
          return (
            <div key={group.label} className={cn(gi > 0 && 'mt-3')}>
              {open ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold tracking-widest text-salon-muted/70 dark:text-white/30 uppercase hover:text-salon-muted dark:hover:text-white/50 transition-colors"
                  aria-expanded={!isCollapsed}
                  aria-label={`${group.label} grubunu aç/kapa`}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 transition-transform duration-200',
                      isCollapsed && '-rotate-90',
                    )}
                  />
                </button>
              ) : null}
              <div
                className={cn(
                  'space-y-0.5 overflow-hidden transition-all duration-200',
                  isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100 mt-0.5',
                )}
              >
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={!open ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-colors touch-target',
                        open ? '' : 'justify-center',
                        active
                          ? 'bg-primary-50 text-primary dark:bg-primary/15 dark:text-primary'
                          : 'text-salon-muted hover:bg-salon-bg hover:text-gray-900 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white',
                      )}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {open && <span className="truncate">{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Ayarlar — alt blok */}
        {showSettings && (
          <div className="mt-4 pt-3 border-t border-salon-border/40 dark:border-white/8">
            <Link
              href={settingsHref}
              title={!open ? 'Ayarlar' : undefined}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-colors touch-target',
                open ? '' : 'justify-center',
                pathname === settingsHref || pathname.startsWith(settingsHref + '/')
                  ? 'bg-primary-50 text-primary dark:bg-primary/15 dark:text-primary'
                  : 'text-salon-muted hover:bg-salon-bg hover:text-gray-900 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white',
              )}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              {open && <span className="truncate">Ayarlar</span>}
            </Link>
          </div>
        )}
      </nav>

      {/* Trial banner */}
      {open && plan === 'trial' && days !== null && (
        <div
          className={cn(
            'mx-2 mb-2 px-3 py-2 rounded-lg text-xs font-medium',
            days > 7
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
              : days > 0
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
          )}
        >
          {days <= 0
            ? 'Deneme süresi doldu'
            : days <= 7
              ? `${days} gün kaldı`
              : `Deneme: ${days} gün`}
        </div>
      )}

      {/* Alt alan */}
      <div className="px-2 py-3 border-t border-salon-border dark:border-white/8 space-y-1">
        {/* Tema toggle */}
        <button
          onClick={toggle}
          title={!open ? (dark ? 'Açık Tema' : 'Koyu Tema') : undefined}
          className={cn(
            'flex items-center gap-3 px-2.5 py-2.5 w-full rounded-md text-sm font-medium transition-all duration-200 touch-target text-salon-muted hover:bg-salon-bg hover:text-gray-900 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white',
            !open && 'justify-center',
          )}
        >
          <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </span>
          {open && (
            <>
              <span>{dark ? 'Açık Tema' : 'Koyu Tema'}</span>
              <span
                className="ml-auto w-8 h-4 rounded-full relative transition-colors duration-200 flex-shrink-0"
                style={{ background: dark ? '#6B48FF' : '#E5E7EB' }}
              >
                <span
                  className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 shadow-sm"
                  style={{ left: dark ? '18px' : '2px' }}
                />
              </span>
            </>
          )}
        </button>

        {/* Kullanıcı */}
        {open ? (
          <div className="flex items-center gap-3 px-2.5 py-2">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">
                {user?.name?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-xs text-salon-muted dark:text-white/40 truncate">{user?.email}</p>
            </div>
          </div>
        ) : (
          <div
            title={user?.name ?? ''}
            className="flex justify-center py-2"
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary/20 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary">
                {user?.name?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          title={!open ? 'Çıkış Yap' : undefined}
          className={cn(
            'flex items-center gap-3 px-2.5 py-2.5 w-full rounded-md text-sm text-salon-muted hover:bg-red-50 hover:text-red-600 dark:text-white/40 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors touch-target',
            !open && 'justify-center',
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {open && 'Çıkış Yap'}
        </button>
      </div>
    </aside>
  )
}
