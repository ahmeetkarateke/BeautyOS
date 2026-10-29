import type { Role } from './roles'

/**
 * Tek izin tablosu (ADR-UI-09): rol -> izin. Sunucu bunu zorlar, arayuz yalnizca gosterir.
 * Her anahtarin yorumundaki sayi, docs/tasarim-girdisi/roller-ve-akislar.md 1.4 matrisindeki satir numarasidir.
 * "Kendi musterisi" kapsami (uzman) izin tablosunda degil, servis sorgusunda uygulanir.
 */
const OWNER_MANAGER = ['owner', 'manager'] as const
const OWNER_MANAGER_RECEPTION = ['owner', 'manager', 'receptionist'] as const
const OWNER_MANAGER_STAFF = ['owner', 'manager', 'staff'] as const

export const PERMISSIONS = {
  'dashboard.revenue': OWNER_MANAGER, // 2
  'finance.close_day': OWNER_MANAGER_RECEPTION, // 37
  'finance.report.daily': OWNER_MANAGER_RECEPTION, // 36 (resepsiyon yalniz bugun: rota sinirlar), 41
  'finance.report.commissions': OWNER_MANAGER, // 42
  'finance.revenue.create': OWNER_MANAGER_RECEPTION, // 38
  'finance.account.read': OWNER_MANAGER, // 43
  'finance.account.write': OWNER_MANAGER, // 43
  'current_account.read': OWNER_MANAGER, // 44
  'current_account.write': OWNER_MANAGER, // 44
  'purchase_invoice.read': OWNER_MANAGER, // 45
  'purchase_invoice.write': OWNER_MANAGER, // 45
  'supplier.read': OWNER_MANAGER, // 46
  'customer.view_all': OWNER_MANAGER_RECEPTION, // 13 (uzman yalniz kendi musterilerini gorur)
  'customer.write': OWNER_MANAGER_RECEPTION, // 15 (uzman duzenleyemez; kendi musterisinde not duzenleme acilirsa kapsam + alan beyaz listesi gerekir)
  'appointment.approve': OWNER_MANAGER_RECEPTION, // online talep onay/ret
  'appointment.reschedule': OWNER_MANAGER_RECEPTION, // 6
  'tip.record': OWNER_MANAGER_RECEPTION, // 33
  'waitlist.view': OWNER_MANAGER_RECEPTION, // 11 (liste musteri adi ve telefonu tasir)
  'waitlist.write': OWNER_MANAGER_RECEPTION, // 11, 12 (bildirim yaniti telefon ve e-posta tasir)
  'health.view': OWNER_MANAGER_STAFF, // 17 (uzman yalniz kendi musterisinde)
  'health.write': OWNER_MANAGER_STAFF, // 17
  'customer.photo.view': OWNER_MANAGER_STAFF, // 19 (uzman yalniz kendi musterisinde)
  'customer.photo.write': OWNER_MANAGER_STAFF, // 19
} as const satisfies Record<string, readonly Role[]>

export type PermissionKey = keyof typeof PERMISSIONS

/** Rolun bu izni var mi? Bilinmeyen rol ya da izin her zaman false (kapali basarisizlik). */
export function can(role: unknown, key: PermissionKey): boolean {
  // Anahtar disaridan gelebilir: 'constructor' gibi miras adlar tabloda sayilmaz.
  if (!Object.hasOwn(PERMISSIONS, key)) return false
  const allowed = PERMISSIONS[key] as readonly string[]
  return typeof role === 'string' && allowed.includes(role)
}

/** Rolun etkin izin listesi (A1: GET /auth/me bunu doner). */
export function permissionsFor(role: unknown): PermissionKey[] {
  return (Object.keys(PERMISSIONS) as PermissionKey[]).filter((key) => can(role, key))
}
