import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, type StaffPayoutStatus, type PaymentMethod } from '@prisma/client'
import { db } from '../lib/db'
import { istanbulPeriodBounds } from '../lib/time'
import { authenticateJWT, requireTenantAccess, checkTenantActive } from '../middleware/auth.middleware'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isOwnerOrManager(role: string): boolean {
  return role === 'owner' || role === 'manager'
}

function parseDateOnly(value: string): Date {
  // YYYY-MM-DD bekleniyor — UTC midnight olarak parse et
  return new Date(`${value}T00:00:00.000Z`)
}

function parseDateEndOfDay(value: string): Date {
  return new Date(`${value}T23:59:59.999Z`)
}

async function sumStaffCommissions(
  client: Pick<Prisma.TransactionClient, 'transaction'>,
  tenantId: string,
  staffId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ grossEarned: Prisma.Decimal; transactionCount: number }> {
  // Gün sınırı Europe/Istanbul: 00:00-03:00 arası tamamlanan işlem kendi gününün primine girer.
  const bounds = istanbulPeriodBounds(periodStart, periodEnd)
  if (!bounds) throw new Error('invalid period')

  const result = await client.transaction.aggregate({
    where: {
      tenantId,
      staffId,
      status: 'completed',
      completedAt: { gte: bounds.gte, lt: bounds.lt },
    },
    _sum: { commissionAmount: true },
    _count: { _all: true },
  })

  return {
    grossEarned: new Prisma.Decimal(result._sum.commissionAmount ?? 0),
    transactionCount: result._count._all,
  }
}

function toMoney(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2)
}

const NEGATIVE_NET = {
  error: { code: 'NEGATIVE_NET', message: 'Kesinti, hak ediş ile ek ödemenin toplamını aşamaz.' },
}

async function getMyStaffProfileId(tenantId: string, userId: string): Promise<string | null> {
  const sp = await db.staffProfile.findFirst({
    where: { tenantId, userId },
    select: { id: true },
  })
  return sp?.id ?? null
}

// ─── Schemas ───────────────────────────────────────────────────────────────────

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/

const paymentMethodEnum = z.enum(['cash', 'card', 'mixed', 'online'])
const statusEnum = z.enum(['pending', 'paid', 'cancelled'])

const listQuerySchema = z.object({
  staffId: z.string().uuid().optional(),
  from: z.string().regex(dateOnlyRegex).optional(),
  to: z.string().regex(dateOnlyRegex).optional(),
  status: statusEnum.optional(),
})

const calculateQuerySchema = z.object({
  staffId: z.string().uuid(),
  from: z.string().regex(dateOnlyRegex),
  to: z.string().regex(dateOnlyRegex),
})

const createPayoutSchema = z.object({
  staffId: z.string().uuid(),
  periodStart: z.string().regex(dateOnlyRegex),
  periodEnd: z.string().regex(dateOnlyRegex),
  bonus: z.number().nonnegative().optional(),
  deductions: z.number().nonnegative().optional(),
  notes: z.string().trim().max(500).optional(),
  paymentMethod: paymentMethodEnum.optional(),
})

const updatePayoutSchema = z.object({
  bonus: z.number().nonnegative().optional(),
  deductions: z.number().nonnegative().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

const markPaidSchema = z.object({
  paymentMethod: paymentMethodEnum,
  notes: z.string().trim().max(500).optional(),
})

// ─── Serializer ────────────────────────────────────────────────────────────────

interface PayoutRow {
  id: string
  tenantId: string
  staffId: string
  periodStart: Date
  periodEnd: Date
  grossEarned: Prisma.Decimal
  bonus: Prisma.Decimal
  deductions: Prisma.Decimal
  netAmount: Prisma.Decimal
  paymentMethod: PaymentMethod
  status: StaffPayoutStatus
  notes: string | null
  paidAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function serializePayout(p: PayoutRow, staffName?: string | null) {
  return {
    id: p.id,
    staffId: p.staffId,
    staffName: staffName ?? null,
    periodStart: p.periodStart.toISOString().slice(0, 10),
    periodEnd: p.periodEnd.toISOString().slice(0, 10),
    grossEarned: Number(p.grossEarned),
    bonus: Number(p.bonus),
    deductions: Number(p.deductions),
    netAmount: Number(p.netAmount),
    paymentMethod: p.paymentMethod,
    status: p.status,
    notes: p.notes,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

// ─── Router ────────────────────────────────────────────────────────────────────

export function createStaffPayoutsRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  // GET /staff-payouts
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz sorgu parametresi.' } })
      }
      const { staffId, from, to, status } = parsed.data
      const tenantId = req.tenantId!
      const role = req.user!.role

      // Staff sadece kendi kayıtlarını görebilir
      let effectiveStaffId = staffId
      if (role === 'staff') {
        const myId = await getMyStaffProfileId(tenantId, req.user!.userId)
        if (!myId) return res.json({ data: [] })
        if (staffId && staffId !== myId) {
          return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu kayıtlara erişim yetkiniz yok.' } })
        }
        effectiveStaffId = myId
      } else if (!isOwnerOrManager(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const where: Prisma.StaffPayoutWhereInput = { tenantId }
      if (effectiveStaffId) where.staffId = effectiveStaffId
      if (status) where.status = status
      if (from || to) {
        where.periodEnd = {}
        if (from) (where.periodEnd as Prisma.DateTimeFilter).gte = parseDateOnly(from)
        if (to) (where.periodEnd as Prisma.DateTimeFilter).lte = parseDateEndOfDay(to)
      }

      const payouts = await db.staffPayout.findMany({
        where,
        orderBy: { periodEnd: 'desc' },
      })

      // Staff isimleri için tek query
      const staffIds = Array.from(new Set(payouts.map((p) => p.staffId)))
      const staffProfiles = staffIds.length > 0
        ? await db.staffProfile.findMany({
          where: { id: { in: staffIds }, tenantId },
          select: { id: true, user: { select: { fullName: true } } },
        })
        : []
      const nameMap = new Map(staffProfiles.map((s) => [s.id, s.user.fullName]))

      return res.json({
        data: payouts.map((p) => serializePayout(p, nameMap.get(p.staffId))),
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /staff-payouts/calculate
  router.get('/calculate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!isOwnerOrManager(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const parsed = calculateQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'staffId, from, to zorunludur.' } })
      }
      const { staffId, from, to } = parsed.data
      const tenantId = req.tenantId!

      if (from > to) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Başlangıç tarihi bitiş tarihinden büyük olamaz.' } })
      }

      const staff = await db.staffProfile.findFirst({
        where: { id: staffId, tenantId },
        select: { id: true, user: { select: { fullName: true } } },
      })
      if (!staff) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
      }

      if (!istanbulPeriodBounds(from, to)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz tarih.' } })
      }
      const periodStart = parseDateOnly(from)
      const periodEnd = parseDateOnly(to)
      const sum = await sumStaffCommissions(db, tenantId, staffId, from, to)
      const grossEarned = Number(sum.grossEarned)
      const transactionCount = sum.transactionCount

      return res.json({
        staffId,
        staffName: staff.user.fullName,
        periodStart: from,
        periodEnd: to,
        grossEarned,
        transactionCount,
      })
    } catch (err) {
      next(err)
    }
  })

  // POST /staff-payouts
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!isOwnerOrManager(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const parsed = createPayoutSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz ödeme verisi.' } })
      }
      const { staffId, periodStart, periodEnd, bonus, deductions, notes, paymentMethod } = parsed.data
      const tenantId = req.tenantId!

      if (periodStart > periodEnd) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Başlangıç tarihi bitiş tarihinden büyük olamaz.' } })
      }

      const staff = await db.staffProfile.findFirst({
        where: { id: staffId, tenantId },
        select: { id: true, user: { select: { fullName: true } } },
      })
      if (!staff) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
      }

      if (!istanbulPeriodBounds(periodStart, periodEnd)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz tarih.' } })
      }
      const startDate = parseDateOnly(periodStart)
      const endDate = parseDateOnly(periodEnd)
      const bonusVal = toMoney(bonus ?? 0)
      const deductionsVal = toMoney(deductions ?? 0)

      // Aynı personel için kontrol + yazma tek işlemde ve personel başına kilit altında: yarışan ikinci istek bekler, çakışmayı görür.
      const outcome = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${`staff-payout:${tenantId}:${staffId}`}))) AS l`
        const overlap = await tx.staffPayout.findFirst({
          where: {
            tenantId,
            staffId,
            status: { not: 'cancelled' },
            periodStart: { lte: endDate },
            periodEnd: { gte: startDate },
          },
          select: { id: true },
        })
        if (overlap) return { kind: 'overlap' as const }

        const { grossEarned } = await sumStaffCommissions(tx, tenantId, staffId, periodStart, periodEnd)
        const netAmount = grossEarned.plus(bonusVal).minus(deductionsVal)
        if (netAmount.isNegative()) return { kind: 'negative' as const }

        const created = await tx.staffPayout.create({
          data: {
            tenantId,
            staffId,
            periodStart: startDate,
            periodEnd: endDate,
            grossEarned,
            bonus: bonusVal,
            deductions: deductionsVal,
            netAmount,
            paymentMethod: paymentMethod ?? 'cash',
            notes: notes ?? null,
          },
        })
        return { kind: 'ok' as const, created }
      })

      if (outcome.kind === 'overlap') {
        return res.status(409).json({ error: { code: 'PAYOUT_OVERLAP', message: 'Bu personel için çakışan dönemde ödeme kaydı zaten var.' } })
      }
      if (outcome.kind === 'negative') return res.status(400).json(NEGATIVE_NET)

      return res.status(201).json(serializePayout(outcome.created, staff.user.fullName))
    } catch (err) {
      next(err)
    }
  })

  // POST /staff-payouts/:id/mark-paid
  router.post('/:id/mark-paid', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!isOwnerOrManager(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const parsed = markPaidSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz veri.' } })
      }
      const { paymentMethod, notes } = parsed.data
      const tenantId = req.tenantId!
      const { id } = req.params

      const existing = await db.staffPayout.findFirst({ where: { id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ödeme kaydı bulunamadı.' } })
      }
      if (existing.status === 'paid') {
        return res.status(409).json({ error: { code: 'ALREADY_PAID', message: 'Bu ödeme zaten yapılmış.' } })
      }
      if (existing.status === 'cancelled') {
        return res.status(409).json({ error: { code: 'CANCELLED', message: 'İptal edilmiş kayıt ödenemez.' } })
      }

      const updated = await db.staffPayout.update({
        where: { id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          paymentMethod,
          ...(notes !== undefined ? { notes } : {}),
        },
      })

      const staff = await db.staffProfile.findFirst({
        where: { id: updated.staffId, tenantId },
        select: { user: { select: { fullName: true } } },
      })

      return res.json(serializePayout(updated, staff?.user.fullName))
    } catch (err) {
      next(err)
    }
  })

  // PATCH /staff-payouts/:id
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!isOwnerOrManager(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const parsed = updatePayoutSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz veri.' } })
      }
      const tenantId = req.tenantId!
      const { id } = req.params

      const existing = await db.staffPayout.findFirst({ where: { id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ödeme kaydı bulunamadı.' } })
      }
      if (existing.status !== 'pending') {
        return res.status(409).json({ error: { code: 'NOT_EDITABLE', message: 'Sadece bekleyen kayıtlar düzenlenebilir.' } })
      }

      const { bonus, deductions, notes } = parsed.data
      const newBonus = bonus !== undefined ? toMoney(bonus) : existing.bonus
      const newDeductions = deductions !== undefined ? toMoney(deductions) : existing.deductions
      const newNet = existing.grossEarned.plus(newBonus).minus(newDeductions)
      if (newNet.isNegative()) return res.status(400).json(NEGATIVE_NET)

      const updated = await db.staffPayout.update({
        where: { id },
        data: {
          bonus: newBonus,
          deductions: newDeductions,
          netAmount: newNet,
          ...(notes !== undefined ? { notes } : {}),
        },
      })

      const staff = await db.staffProfile.findFirst({
        where: { id: updated.staffId, tenantId },
        select: { user: { select: { fullName: true } } },
      })

      return res.json(serializePayout(updated, staff?.user.fullName))
    } catch (err) {
      next(err)
    }
  })

  // DELETE /staff-payouts/:id
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!isOwnerOrManager(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!
      const { id } = req.params

      const existing = await db.staffPayout.findFirst({ where: { id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ödeme kaydı bulunamadı.' } })
      }
      if (existing.status !== 'pending') {
        return res.status(409).json({ error: { code: 'NOT_DELETABLE', message: 'Sadece bekleyen kayıtlar silinebilir.' } })
      }

      await db.staffPayout.delete({ where: { id } })
      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  return router
}
