import { db } from './db'
import type { SalonContext } from '../ai/intent.service'
import { TEST_SALON } from '../ai/intent.service'

export async function getSalon(tenantId: string): Promise<SalonContext> {
  // 'test-tenant' slug → test verisini döndür (MVP geçiş dönemi)
  if (tenantId === 'test-tenant') {
    return TEST_SALON
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      services: { where: { isActive: true, isOnlineBookable: true } },
      staffProfiles: { where: { acceptsOnlineBooking: true } },
    },
  })

  if (!tenant) return TEST_SALON

  return {
    name: tenant.name,
    services: tenant.services.map((s: { name: string; durationMinutes: number; price: unknown }) => ({
      name: s.name,
      duration: s.durationMinutes,
      price: Number(s.price),
    })),
    staff: tenant.staffProfiles.map((sp: { title: string }) => ({
      name: sp.title,
      title: sp.title,
    })),
    workingHours: tenant.settings && typeof tenant.settings === 'object'
      ? (tenant.settings as Record<string, unknown>)['workingHours'] as string ?? '09:00-19:00'
      : '09:00-19:00',
    address: tenant.settings && typeof tenant.settings === 'object'
      ? (tenant.settings as Record<string, unknown>)['address'] as string ?? ''
      : '',
  }
}
