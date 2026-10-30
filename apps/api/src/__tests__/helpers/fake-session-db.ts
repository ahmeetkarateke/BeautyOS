// Oturum (S6) testleri icin bellek ici sahte tablo: gercek Prisma where davranisinin ihtiyac duyulan alt kumesi.
// Rotasyon, yeniden kullanim ve aile iptali mantigi bu sahte uzerinde gercekten calisir (yalniz yuklem eslestirme sahte).
export interface SessionRow {
  id: string
  userId: string
  tenantId: string | null
  familyId: string
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
  revokedAt: Date | null
  reissuedAt: Date | null
  createdAt: Date
}

type Cond = unknown

function matchValue(actual: unknown, cond: Cond): boolean {
  if (cond === null) return actual === null
  if (cond instanceof Date || typeof cond !== 'object') return actual === cond || (actual instanceof Date && cond instanceof Date && actual.getTime() === cond.getTime())
  const c = cond as Record<string, unknown>
  if ('gt' in c) return (actual as Date).getTime() > (c.gt as Date).getTime()
  if ('lt' in c) return (actual as Date).getTime() < (c.lt as Date).getTime()
  if ('gte' in c) return (actual as Date).getTime() >= (c.gte as Date).getTime()
  if ('lte' in c) return (actual as Date).getTime() <= (c.lte as Date).getTime()
  if ('not' in c) return actual !== c.not
  if ('in' in c) return (c.in as unknown[]).includes(actual)
  return false
}

export function matches(row: Record<string, unknown>, where: Record<string, Cond>): boolean {
  return Object.entries(where).every(([k, v]) => matchValue(row[k], v))
}

export function createFakeSessionDb() {
  const rows: SessionRow[] = []
  let seq = 0
  const session = {
    create: async ({ data }: { data: Partial<SessionRow> & { userId: string; familyId: string; tokenHash: string; expiresAt: Date } }) => {
      if (rows.some((r) => r.tokenHash === data.tokenHash)) throw new Error('unique tokenHash')
      const row: SessionRow = {
        id: `s${++seq}`, tenantId: null, usedAt: null, revokedAt: null, reissuedAt: null, createdAt: new Date(), ...data,
      } as SessionRow
      rows.push(row)
      return row
    },
    findUnique: async ({ where }: { where: { tokenHash: string } }) => rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
    findFirst: async ({ where }: { where: Record<string, Cond> }) => rows.find((r) => matches(r as never, where)) ?? null,
    updateMany: async ({ where, data }: { where: Record<string, Cond>; data: Partial<SessionRow> }) => {
      const hit = rows.filter((r) => matches(r as never, where))
      hit.forEach((r) => Object.assign(r, data))
      return { count: hit.length }
    },
    count: async ({ where }: { where: Record<string, Cond> }) => rows.filter((r) => matches(r as never, where)).length,
    deleteMany: async ({ where }: { where: Record<string, Cond> }) => {
      const hit = rows.filter((r) => matches(r as never, where))
      hit.forEach((r) => rows.splice(rows.indexOf(r), 1))
      return { count: hit.length }
    },
  }
  return { rows, session }
}
