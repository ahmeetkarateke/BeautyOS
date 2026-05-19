import { Prisma, type Waitlist } from '@prisma/client'
import { db } from './db'

export interface FindMatchingWaitlistInput {
  tenantId: string
  serviceId: string
  staffId: string
  slot: Date
}

/**
 * Finds waitlist entries (status='waiting') that match a newly-opened slot.
 *
 * Match rules (FIFO ordering by createdAt asc):
 *  - tenantId equals
 *  - status = 'waiting'
 *  - serviceId is null OR matches the freed slot's serviceId
 *  - staffId  is null OR matches the freed slot's staffId
 *  - preferredDate is null OR matches the freed slot's date (UTC date portion)
 *
 * The caller is responsible for any subsequent notification or status mutation.
 */
export async function findMatchingWaitlistEntries(
  tx: Prisma.TransactionClient | typeof db,
  { tenantId, serviceId, staffId, slot }: FindMatchingWaitlistInput,
): Promise<Waitlist[]> {
  const dayStart = new Date(Date.UTC(slot.getUTCFullYear(), slot.getUTCMonth(), slot.getUTCDate(), 0, 0, 0, 0))
  const dayEnd = new Date(Date.UTC(slot.getUTCFullYear(), slot.getUTCMonth(), slot.getUTCDate(), 23, 59, 59, 999))

  return tx.waitlist.findMany({
    where: {
      tenantId,
      status: 'waiting',
      AND: [
        { OR: [{ serviceId: null }, { serviceId }] },
        { OR: [{ staffId: null }, { staffId }] },
        { OR: [{ preferredDate: null }, { preferredDate: { gte: dayStart, lte: dayEnd } }] },
      ],
    },
    orderBy: { createdAt: 'asc' },
  })
}
