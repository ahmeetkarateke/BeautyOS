// Modüler aktivasyon sistemi — frontend kaynağı.
// apps/api/src/lib/modules.ts içindeki MODULE_KEYS ile senkron tutulmalıdır.

export type ModuleCategory = 'core' | 'finance' | 'staff' | 'inventory' | 'automation' | 'marketing'

export interface ModuleDef {
  key: string
  label: string
  description: string
  category: ModuleCategory
  icon: string // lucide-react icon adı
  href: (slug: string) => string
  defaultEnabled: boolean
}

export const MODULE_REGISTRY: ModuleDef[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Günlük özet, randevular ve hızlı erişim.',
    category: 'core',
    icon: 'LayoutDashboard',
    href: (slug) => `/tenant/${slug}/dashboard`,
    defaultEnabled: true,
  },
  {
    key: 'appointments',
    label: 'Randevular',
    description: 'Takvim, randevu oluşturma ve yönetim.',
    category: 'core',
    icon: 'Calendar',
    href: (slug) => `/tenant/${slug}/appointments`,
    defaultEnabled: true,
  },
  {
    key: 'customers',
    label: 'Müşteriler',
    description: 'Müşteri kartları, geçmiş ve segmentasyon.',
    category: 'core',
    icon: 'Users',
    href: (slug) => `/tenant/${slug}/customers`,
    defaultEnabled: true,
  },
  {
    key: 'services',
    label: 'Hizmetler',
    description: 'Hizmet katalogu, süre ve fiyatlar.',
    category: 'core',
    icon: 'Sparkles',
    href: (slug) => `/tenant/${slug}/services`,
    defaultEnabled: true,
  },
  {
    key: 'staff',
    label: 'Personel',
    description: 'Personel kartları, izin ve çalışma saatleri.',
    category: 'staff',
    icon: 'UserCog',
    href: (slug) => `/tenant/${slug}/staff`,
    defaultEnabled: true,
  },
  {
    key: 'packages',
    label: 'Paketler',
    description: 'Çoklu seans / abonelik paketleri.',
    category: 'core',
    icon: 'Package',
    href: (slug) => `/tenant/${slug}/packages`,
    defaultEnabled: true,
  },
  {
    key: 'tips',
    label: 'Bahşiş',
    description: 'Personel bahşiş takibi ve raporu.',
    category: 'staff',
    icon: 'HandCoins',
    href: (slug) => `/tenant/${slug}/tips`,
    defaultEnabled: true,
  },
  {
    key: 'staff-payouts',
    label: 'Personel Ödemeleri',
    description: 'Komisyon ve maaş ödemeleri.',
    category: 'staff',
    icon: 'Wallet',
    href: (slug) => `/tenant/${slug}/staff-payouts`,
    defaultEnabled: true,
  },
  {
    key: 'finance',
    label: 'Finans',
    description: 'Kasa, gelir-gider ve raporlar.',
    category: 'finance',
    icon: 'Banknote',
    href: (slug) => `/tenant/${slug}/finance`,
    defaultEnabled: true,
  },
  {
    key: 'inventory',
    label: 'Stok',
    description: 'Ürün stoğu ve düşüm takibi.',
    category: 'inventory',
    icon: 'Boxes',
    href: (slug) => `/tenant/${slug}/inventory`,
    defaultEnabled: true,
  },
  {
    key: 'waitlist',
    label: 'Bekleme Listesi',
    description: 'Sıra/bekleme yönetimi.',
    category: 'core',
    icon: 'Clock',
    href: (slug) => `/tenant/${slug}/waitlist`,
    defaultEnabled: true,
  },
  {
    key: 'settings',
    label: 'Ayarlar',
    description: 'Salon profili, hesap ve modüller.',
    category: 'core',
    icon: 'Settings',
    href: (slug) => `/tenant/${slug}/settings`,
    defaultEnabled: true,
  },
]

export const MODULE_KEYS: string[] = MODULE_REGISTRY.map((m) => m.key)

export const MODULE_TEMPLATES: Record<string, string[]> = {
  full: [...MODULE_KEYS],
  salon: ['dashboard', 'appointments', 'customers', 'services', 'staff', 'packages', 'tips', 'finance', 'settings'],
  barbershop: ['dashboard', 'appointments', 'customers', 'services', 'staff', 'tips', 'finance', 'settings'],
  nail_studio: ['dashboard', 'appointments', 'customers', 'services', 'staff', 'packages', 'inventory', 'finance', 'settings'],
}

export const MODULE_TEMPLATE_META: Array<{ key: keyof typeof MODULE_TEMPLATES; label: string; description: string }> = [
  { key: 'full', label: 'Tam', description: 'Tüm modüller aktif.' },
  { key: 'salon', label: 'Salon', description: 'Güzellik salonu için önerilen set.' },
  { key: 'barbershop', label: 'Berber', description: 'Berber/kuaför için sade set.' },
  { key: 'nail_studio', label: 'Nail Studio', description: 'Nail art stüdyosu için stoklu set.' },
]

export const MODULE_CATEGORY_LABELS: Record<ModuleCategory, string> = {
  core: 'Temel',
  finance: 'Finans',
  staff: 'Personel',
  inventory: 'Stok',
  automation: 'Otomasyon',
  marketing: 'Pazarlama',
}

/**
 * Verilen activeModules değerini normalize eder.
 * Boş/eksik ise tüm modüller aktif kabul edilir (mevcut tenant'lar bozulmasın).
 */
export function resolveActiveModules(activeModules: unknown): string[] {
  if (!Array.isArray(activeModules) || activeModules.length === 0) {
    return [...MODULE_KEYS]
  }
  const filtered = activeModules.filter((k): k is string => typeof k === 'string' && MODULE_KEYS.includes(k))
  if (filtered.length === 0) return [...MODULE_KEYS]
  return filtered
}
