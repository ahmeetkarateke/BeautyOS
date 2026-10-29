import { permissionsFor } from '@beautyos/shared'
import type { Role } from '@beautyos/shared'
import type { Me } from './me'

// Yalnız testler için: /auth/me yanıtı biçiminde örnek oturum. İzinler paylaşılan paketin tablosundan gelir (web rolden izin türetmez; test verisi kurar).
export const ALL_MODULES = [
  'dashboard', 'appointments', 'customers', 'services', 'staff', 'packages', 'tips', 'staff-payouts', 'finance',
  'current-accounts', 'purchase-invoices', 'suppliers', 'accounts', 'inventory', 'waitlist',
]

export function makeMe(role: Role, over: Partial<Me['tenant']> = {}): Me {
  return {
    role,
    permissions: permissionsFor(role),
    staffId: role === 'staff' ? 's1' : null,
    user: { id: 'u1', email: 'defne@example.com', name: 'Defne Kaya' },
    tenant: {
      slug: 'defne',
      name: 'Defne Güzellik',
      businessType: 'beauty_center',
      termSet: 'salon',
      terms: {},
      activeModules: ALL_MODULES,
      bookingMode: 'verified',
      timezone: 'Europe/Istanbul',
      ...over,
    },
  }
}
