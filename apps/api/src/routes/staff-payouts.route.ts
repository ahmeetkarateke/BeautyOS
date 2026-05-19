import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, type StaffPayoutStatus, type PaymentMethod } from '@prisma/client'
import { db } from '../lib/db'
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
  tenantId: string,
  staffId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ grossEarned: number; transactionCount: number }> {
  const start = new Date(`${periodStart.toISOString().slice(0, 10)}T00:00:00.000Z`)
  const end = new Date(`${periodEnd.toISOString().slice(0, 10)}T23:59:59.999Z`)

  const result = await db.transaction.aggregate({
    where: {
      tenantId,
      staffId,
      status: 'completed',
      completedAt: { gte: start, lte: end },
    },
    _sum: { commissionAmount: true },
    _count: { _all: true },
  })

  return {
    grossEarned: Number(result._sum.commissionAmount ?? 0),
    transactionCount: result._count._all,
  }
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

      const periodStart = parseDateOnly(from)
      const periodEnd = parseDateOnly(to)
      const { grossEarned, transactionCount } = await sumStaffCommissions(tenantId, staffId, periodStart, periodEnd)

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

      const startDate = parseDateOnly(periodStart)
      const endDate = parseDateOnly(periodEnd)

      const { grossEarned } = await sumStaffCommissions(tenantId, staffId, startDate, endDate)
      const bonusVal = bonus ?? 0
      const deductionsVal = deductions ?? 0
      const netAmount = grossEarned + bonusVal - deductionsVal

      const created = await db.staffPayout.create({
        data: {
          tenantId,
          staffId,
          periodStart: startDate,
          periodEnd: endDate,
          grossEarned: new Prisma.Decimal(grossEarned),
          bonus: new Prisma.Decimal(bonusVal),
          deductions: new Prisma.Decimal(deductionsVal),
          netAmount: new Prisma.Decimal(netAmount),
          paymentMethod: paymentMethod ?? 'cash',
          notes: notes ?? null,
        },
      })

      return res.status(201).json(serializePayout(created, staff.user.fullName))
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
      const newBonus = bonus !== undefined ? new Prisma.Decimal(bonus) : existing.bonus
      const newDeductions = deductions !== undefined ? new Prisma.Decimal(deductions) : existing.deductions
      const grossNum = Number(existing.grossEarned)
      const bonusNum = Number(newBonus)
      const deductionsNum = Number(newDeductions)
      const newNet = grossNum + bonusNum - deductionsNum

      const updated = await db.staffPayout.update({
        where: { id },
        data: {
          bonus: newBonus,
          deductions: newDeductions,
          netAmount: new Prisma.Decimal(newNet),
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
