import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { can } from '@beautyos/shared'
import { db } from './db'

// "Kendi musterisi": uzmanin gelecekteki ya da son 12 ay icindeki, iptal edilmemis randevusu olan musteri.
const OWN_CUSTOMER_WINDOW_MS = 365 * 24 * 60 * 60 * 1000

/**
 * Isteği yapan kullanicinin gorebilecegi musterileri sinirlayan Prisma kosulu.
 * - Tum musterileri gorme izni olan rol: bos kosul ({}).
 * - Uzman: yalnizca kendi musterileri.
 * - Profili olmayan uzman: null (hicbir musteriyi gormez).
 * Cagiran `tenantId` kosulunu ayrica koymaya devam eder.
 */
export async function customerAccessFilter(req: Request): Promise<Prisma.CustomerWhereInput | null> {
  if (can(req.user?.role, 'customer.view_all')) return {}

  const profile = await db.staffProfile.findFirst({
    where: { tenantId: req.tenantId!, userId: req.user!.userId },
    select: { id: true },
  })
  if (!profile) return null

  return {
    appointments: {
      some: {
        tenantId: req.tenantId!,
        staffId: profile.id,
        isDeleted: false,
        status: { not: 'cancelled' },
        startAt: { gte: new Date(Date.now() - OWN_CUSTOMER_WINDOW_MS) },
      },
    },
  }
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
