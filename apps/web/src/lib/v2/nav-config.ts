import type { PermissionKey, Role } from '@beautyos/shared'
import { capitalizeTr, resolveTerm } from '@/content/terms'
import type { Me } from './me'

// Tek menü kaynağı (ADR-UI-09, tasarim.md §5). Rol dışı öğe GİZLENİR (soluklaştırılmaz); kapalı modül görünmez.
// Menü yalnız gösterimdir: yetkiyi sunucu zorlar. Yollar W0 eşlemesindeki (routes.ts) /panel/<salon>/<yol> biçimidir.
/** Bileşen eşlemesi features/shell/nav-icons.tsx'te; veri dosyası React'e bağlanmaz. */
export type NavIconId =
  | 'today' | 'calendar' | 'clients' | 'clock' | 'cash' | 'service' | 'staff' | 'commission' | 'chat'
  | 'account' | 'ledger' | 'invoice' | 'truck' | 'box' | 'package' | 'tip' | 'settings' | 'menu' | 'plus'

type ItemDef = {
  id: string
  icon: NavIconId
  /** URL yolu (routes.ts v2 eşlemesi). */
  path: string
  label: (me: Me) => string
  /** Menüde görünmesi için gereken izin (sunucunun /auth/me listesinden). */
  permission?: PermissionKey
  /** İzin tablosunda karşılığı olmayan rol ayrımı. */
  roles?: readonly Role[]
  /** /auth/me activeModules anahtarı. */
  module?: string
}

type GroupDef = { id: string; label?: string; items: readonly ItemDef[] }

const OWNER_MANAGER = ['owner', 'manager'] as const
const term = (me: Me, key: Parameters<typeof resolveTerm>[2], form?: Parameters<typeof resolveTerm>[3]) =>
  resolveTerm(me.tenant.termSet, me.tenant.terms, key, form)
const isStaff = (me: Me) => me.role === 'staff'

const GROUPS: readonly GroupDef[] = [
  {
    id: 'main',
    items: [
      { id: 'today', icon: 'today', path: 'bugun', label: (me) => (isStaff(me) ? 'Günüm' : 'Bugün'), module: 'dashboard' },
      { id: 'calendar', icon: 'calendar', path: 'takvim', label: (me) => (isStaff(me) ? 'Takvimim' : 'Takvim'), module: 'appointments' },
      {
        id: 'clients',
        icon: 'clients',
        path: 'musteriler',
        label: (me) => capitalizeTr(isStaff(me) ? term(me, 'clientsMine') : term(me, 'client', 'plural')),
        module: 'customers',
      },
      { id: 'waitlist', icon: 'clock', path: 'bekleme', label: () => 'Bekleme listesi', permission: 'waitlist.view', module: 'waitlist' },
      { id: 'cash', icon: 'cash', path: 'kasa', label: () => 'Kasa', permission: 'finance.report.daily', module: 'finance' },
    ],
  },
  {
    id: 'service-staff',
    label: 'Hizmet ve personel',
    items: [
      { id: 'services', icon: 'service', path: 'hizmetler', label: (me) => capitalizeTr(term(me, 'service', 'plural')), roles: OWNER_MANAGER, module: 'services' },
      { id: 'staff', icon: 'staff', path: 'personel', label: () => 'Personel', roles: OWNER_MANAGER, module: 'staff' },
      { id: 'my-commission', icon: 'commission', path: 'primim', label: () => 'Primim', roles: ['staff'], module: 'staff-payouts' },
      { id: 'assistant', icon: 'chat', path: 'asistan', label: () => 'Mesaj asistanı', roles: ['owner'] },
    ],
  },
  {
    id: 'management',
    label: 'Yönetim',
    items: [
      { id: 'accounts', icon: 'account', path: 'hesaplar', label: () => 'Hesaplar', permission: 'finance.account.read', module: 'accounts' },
      { id: 'current-accounts', icon: 'ledger', path: 'cari', label: () => 'Cari hesap', permission: 'current_account.read', module: 'current-accounts' },
      { id: 'purchase-invoices', icon: 'invoice', path: 'faturalar', label: () => 'Alış faturaları', permission: 'purchase_invoice.read', module: 'purchase-invoices' },
      { id: 'suppliers', icon: 'truck', path: 'tedarikciler', label: () => 'Tedarikçiler', permission: 'supplier.read', module: 'suppliers' },
      { id: 'inventory', icon: 'box', path: 'stok', label: () => 'Stok', roles: OWNER_MANAGER, module: 'inventory' },
      { id: 'packages', icon: 'package', path: 'paketler', label: () => 'Paketler', roles: OWNER_MANAGER, module: 'packages' },
      { id: 'staff-payouts', icon: 'commission', path: 'odemeler', label: () => 'Personel ödemeleri', roles: OWNER_MANAGER, module: 'staff-payouts' },
      { id: 'tips', icon: 'tip', path: 'bahsis', label: () => 'Bahşiş', roles: OWNER_MANAGER, module: 'tips' },
    ],
  },
  { id: 'settings', items: [{ id: 'settings', icon: 'settings', path: 'ayarlar', label: () => 'Ayarlar', roles: OWNER_MANAGER }] },
]

export type NavItem = { id: string; label: string; href: string; icon: NavIconId }
export type NavGroup = { id: string; label?: string; items: NavItem[] }

function isVisible(item: ItemDef, me: Me): boolean {
  if (item.permission && !me.permissions.includes(item.permission)) return false
  if (item.roles && !item.roles.includes(me.role)) return false
  if (item.module && !me.tenant.activeModules.includes(item.module)) return false
  return true
}

export function buildNav(me: Me): NavGroup[] {
  return GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items
      .filter((item) => isVisible(item, me))
      .map((item) => ({ id: item.id, label: item.label(me), href: `/panel/${me.tenant.slug}/${item.path}`, icon: item.icon })),
  })).filter((group) => group.items.length > 0)
}

export type BottomNav = {
  /** Sırayla: ana ekran, takvim, müşteriler, menü. "+" bu listede değildir; `create` ayrıca verilir (orta konum). */
  items: NavItem[]
  create: { label: string; href: string } | null
}

/** Telefon alt menüsü (tasarim.md §5): Bugün/Günüm · Takvim/Takvimim · [+] · Müşteriler/Müşterilerim · Menü. Öğeler buildNav ile aynı görünürlük kuralından geçer. */
export function buildBottomNav(me: Me): BottomNav {
  const base = `/panel/${me.tenant.slug}`
  const main = new Map(buildNav(me).flatMap((group) => group.items).map((item) => [item.id, item]))
  const items = ['today', 'calendar', 'clients']
    .map((id) => main.get(id))
    .filter((item): item is NavItem => item !== undefined)
  items.push({ id: 'menu', label: 'Menü', href: `${base}/menu`, icon: 'menu' })
  const create = me.tenant.activeModules.includes('appointments')
    ? { label: 'Randevu oluştur', href: `${base}/takvim?yeni=randevu` }
    : null
  return { items, create }
}
