import type { PermissionKey, Role } from '@beautyos/shared'
import { capitalizeTr, resolveTerm } from '@/content/terms'
import type { Me } from './me'

// Tek menü kaynağı (ADR-UI-09, tasarim.md §5). Rol dışı öğe GİZLENİR (soluklaştırılmaz); kapalı modül görünmez.
// Menü yalnız gösterimdir: yetkiyi sunucu zorlar. Yollar W0 eşlemesindeki (routes.ts) /panel/<salon>/<yol> biçimidir.
type ItemDef = {
  id: string
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
      { id: 'today', path: 'bugun', label: (me) => (isStaff(me) ? 'Günüm' : 'Bugün'), module: 'dashboard' },
      { id: 'calendar', path: 'takvim', label: (me) => (isStaff(me) ? 'Takvimim' : 'Takvim'), module: 'appointments' },
      {
        id: 'clients',
        path: 'musteriler',
        label: (me) => capitalizeTr(isStaff(me) ? term(me, 'clientsMine') : term(me, 'client', 'plural')),
        module: 'customers',
      },
      { id: 'waitlist', path: 'bekleme', label: () => 'Bekleme listesi', permission: 'waitlist.view', module: 'waitlist' },
      { id: 'cash', path: 'kasa', label: () => 'Kasa', permission: 'finance.report.daily', module: 'finance' },
    ],
  },
  {
    id: 'service-staff',
    label: 'Hizmet ve personel',
    items: [
      { id: 'services', path: 'hizmetler', label: (me) => capitalizeTr(term(me, 'service', 'plural')), roles: OWNER_MANAGER, module: 'services' },
      { id: 'staff', path: 'personel', label: () => 'Personel', roles: OWNER_MANAGER, module: 'staff' },
      { id: 'my-commission', path: 'primim', label: () => 'Primim', roles: ['staff'], module: 'staff-payouts' },
      { id: 'assistant', path: 'asistan', label: () => 'Mesaj asistanı', roles: ['owner'] },
    ],
  },
  {
    id: 'management',
    label: 'Yönetim',
    items: [
      { id: 'accounts', path: 'hesaplar', label: () => 'Hesaplar', permission: 'finance.account.read', module: 'accounts' },
      { id: 'current-accounts', path: 'cari', label: () => 'Cari hesap', permission: 'current_account.read', module: 'current-accounts' },
      { id: 'purchase-invoices', path: 'faturalar', label: () => 'Alış faturaları', permission: 'purchase_invoice.read', module: 'purchase-invoices' },
      { id: 'suppliers', path: 'tedarikciler', label: () => 'Tedarikçiler', permission: 'supplier.read', module: 'suppliers' },
      { id: 'inventory', path: 'stok', label: () => 'Stok', roles: OWNER_MANAGER, module: 'inventory' },
      { id: 'packages', path: 'paketler', label: () => 'Paketler', roles: OWNER_MANAGER, module: 'packages' },
      { id: 'staff-payouts', path: 'odemeler', label: () => 'Personel ödemeleri', roles: OWNER_MANAGER, module: 'staff-payouts' },
      { id: 'tips', path: 'bahsis', label: () => 'Bahşiş', roles: OWNER_MANAGER, module: 'tips' },
    ],
  },
  { id: 'settings', items: [{ id: 'settings', path: 'ayarlar', label: () => 'Ayarlar', roles: OWNER_MANAGER }] },
]

export type NavItem = { id: string; label: string; href: string }
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
      .map((item) => ({ id: item.id, label: item.label(me), href: `/panel/${me.tenant.slug}/${item.path}` })),
  })).filter((group) => group.items.length > 0)
}
