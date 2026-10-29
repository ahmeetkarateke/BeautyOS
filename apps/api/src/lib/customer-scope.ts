import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { can } from '@beautyos/shared'
import { db } from './db'

// "Kendi musterisi": uzmanin gelecekteki ya da son 12 ay icindeki, iptal edilmemis randevusu olan musteri.
const OWN_CUSTOMER_WINDOW_MS = 365 * 24 * 60 * 60 * 1000

/** Uzmanin "kendi musterisi" kosulu (musteri secimi icin); cagiran tenantId'yi ayrica koyar. */
export function ownCustomerWhere(tenantId: string, staffProfileId: string): Prisma.CustomerWhereInput {
  return {
    appointments: {
      some: {
        tenantId,
        staffId: staffProfileId,
        isDeleted: false,
        status: { not: 'cancelled' },
        startAt: { gte: new Date(Date.now() - OWN_CUSTOMER_WINDOW_MS) },
      },
    },
  }
}

/** Istegi yapan kullanicinin uzman profili (yoksa null). */
export async function ownStaffProfileId(req: Request): Promise<string | null> {
  const profile = await db.staffProfile.findFirst({
    where: { tenantId: req.tenantId!, userId: req.user!.userId },
    select: { id: true },
  })
  return profile?.id ?? null
}

/**
 * Isteği yapan kullanicinin gorebilecegi musterileri sinirlayan Prisma kosulu.
 * - Tum musterileri gorme izni olan rol: bos kosul ({}).
 * - Uzman: yalnizca kendi musterileri.
 * - Profili olmayan uzman: null (hicbir musteriyi gormez).
 * Cagiran `tenantId` kosulunu ayrica koymaya devam eder.
 */
export async function customerAccessFilter(req: Request): Promise<Prisma.CustomerWhereInput | null> {
  if (can(req.user?.role, 'customer.view_all')) return {}

  const profileId = await ownStaffProfileId(req)
  if (!profileId) return null
  return ownCustomerWhere(req.tenantId!, profileId)
}

/** Musteri bu kiracida var mi ve isteği yapan kullanici ona erisebiliyor mu? */
export async function canAccessCustomer(req: Request, customerId: string): Promise<boolean> {
  const scope = await customerAccessFilter(req)
  if (scope === null) return false
  const found = await db.customer.findFirst({
    where: { id: customerId, tenantId: req.tenantId!, ...scope },
    select: { id: true },
  })
  return found !== null
}
