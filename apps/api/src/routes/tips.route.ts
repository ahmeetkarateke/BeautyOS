import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { ensurePermission } from '../middleware/permission'
import { Prisma, TipSource } from '@prisma/client'
import { db } from '../lib/db'
import { logger } from '../lib/logger'
import { authenticateJWT, requireTenantAccess, checkTenantActive } from '../middleware/auth.middleware'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getIstanbulDateStr(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split('T')[0]
}

function toTRBounds(dateStr: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateStr}T00:00:00+03:00`),
    end: new Date(`${dateStr}T23:59:59.999+03:00`),
  }
}

type PeriodBounds = { start: Date; end: Date }

function getPeriodBounds(period: 'today' | 'week' | 'month'): PeriodBounds {
  const todayStr = getIstanbulDateStr()

  if (period === 'week') {
    const noon = new Date(`${todayStr}T12:00:00+03:00`)
    const dow = noon.getUTCDay()
    const mondayOffset = dow === 0 ? -6 : 1 - dow
    const mondayStr = addDays(todayStr, mondayOffset)
    const sundayStr = addDays(mondayStr, 6)
    return { start: toTRBounds(mondayStr).start, end: toTRBounds(sundayStr).end }
  }

  if (period === 'month') {
    const [y, m] = todayStr.split('-').map(Number)
    const firstDayStr = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
    const lastDayDate = new Date(Date.UTC(y, m, 0))
    const lastDayStr = lastDayDate.toISOString().split('T')[0]
    return { start: toTRBounds(firstDayStr).start, end: toTRBounds(lastDayStr).end }
  }

  return toTRBounds(todayStr)
}

function parseRange(from?: string, to?: string): { start: Date; end: Date } | null {
  if (!from && !to) return null
  const today = getIstanbulDateStr()
  const f = from ?? today
  const t = to ?? today
  return { start: toTRBounds(f).start, end: toTRBounds(t).end }
}

function isOwnerOrManager(role: string | undefined): boolean {
  return role === 'owner' || role === 'manager'
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const tipSourceEnum = z.enum(['cash', 'card', 'salon_pool'])

const createTipBodySchema = z.object({
  appointmentId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  amount: z.number().positive().max(1_000_000),
  source: tipSourceEnum,
  notes: z.string().trim().max(500).optional(),
  collectedAt: z.string().datetime().optional(),
})

const updateTipBodySchema = z.object({
  amount: z.number().positive().max(1_000_000).optional(),
  source: tipSourceEnum.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  staffId: z.string().uuid().nullable().optional(),
  appointmentId: z.string().uuid().nullable().optional(),
})

const distributionItemSchema = z.object({
  staffId: z.string().uuid(),
  amount: z.number().positive().optional(),
  shareWeight: z.number().positive().optional(),
  notes: z.string().trim().max(500).optional(),
}).refine((v) => v.amount !== undefined || v.shareWeight !== undefined, {
  message: 'amount veya shareWeight zorunlu.',
})

const distributeBodySchema = z.object({
  tipIds: z.array(z.string().uuid()).optional(),
  distributions: z.array(distributionItemSchema).min(1),
  notes: z.string().trim().max(500).optional(),
})

// ─── Router ───────────────────────────────────────────────────────────────────

export function createTipsRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  // POST /tips — record a tip
  router.post('/tips', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      if (!ensurePermission(req, res, 'tip.record')) return

      const parsed = createTipBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Geçersiz veri.' } })
      }
      const data = parsed.data

      if (data.source !== 'salon_pool' && !data.appointmentId && !data.staffId) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Personel veya randevu seçilmeli ya da havuz seçeneği kullanılmalı.' } })
      }

      if (data.appointmentId) {
        const appt = await db.appointment.findFirst({
          where: { id: data.appointmentId, tenantId },
          select: { id: true, staffId: true },
        })
        if (!appt) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
        }
      }

      if (data.staffId) {
        const staff = await db.staffProfile.findFirst({
          where: { id: data.staffId, tenantId },
          select: { id: true },
        })
        if (!staff) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
        }
      }

      const created = await db.tipEntry.create({
        data: {
          tenantId,
          appointmentId: data.appointmentId ?? null,
          staffId: data.staffId ?? null,
          amount: new Prisma.Decimal(data.amount),
          source: data.source as TipSource,
          notes: data.notes ?? null,
          collectedAt: data.collectedAt ? new Date(data.collectedAt) : new Date(),
          isDistributed: false,
        },
      })

      return res.status(201).json({
        id: created.id,
        amount: Number(created.amount),
        source: created.source,
        staffId: created.staffId,
        appointmentId: created.appointmentId,
        notes: created.notes,
        collectedAt: created.collectedAt.toISOString(),
        isDistributed: created.isDistributed,
      })
    } catch (err) {
      logger.error({ err }, 'Tip create failed')
      next(err)
    }
  })

  // GET /tips — list tip entries
  router.get('/tips', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Resepsiyon bahşiş KAYDEDER ama listeyi/özeti görmez (matris 33-35); varsayılan ret.
      if (req.user!.role === 'receptionist') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!
      const role = req.user!.role
      const userId = req.user!.userId

      const querySchema = z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        staffId: z.string().optional(),
        source: tipSourceEnum.optional(),
        isDistributed: z.enum(['true', 'false']).optional(),
        limit: z.preprocess(
          (v) => (v === undefined || v === '' ? 50 : Number(v)),
          z.number().int().min(1).max(200),
        ),
        cursor: z.string().uuid().optional(),
      })
      const parsed = querySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz sorgu parametresi.' } })
      }
      const { from, to, staffId, source, isDistributed, limit, cursor } = parsed.data

      // Staff: only their own tips (staffId=mine or forced)
      let staffFilter: Prisma.TipEntryWhereInput = {}
      if (role === 'staff') {
        const myProfile = await db.staffProfile.findFirst({
          where: { tenantId, userId },
          select: { id: true },
        })
        if (!myProfile) {
          return res.json({ data: [], nextCursor: null })
        }
        staffFilter = { staffId: myProfile.id }
      } else if (staffId === 'mine') {
        const myProfile = await db.staffProfile.findFirst({
          where: { tenantId, userId },
          select: { id: true },
        })
        if (!myProfile) {
          return res.json({ data: [], nextCursor: null })
        }
        staffFilter = { staffId: myProfile.id }
      } else if (staffId) {
        const parsedStaffId = z.string().uuid().safeParse(staffId)
        if (!parsedStaffId.success) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz staffId.' } })
        }
        staffFilter = { staffId: parsedStaffId.data }
      }

      const range = parseRange(from, to)
      const dateFilter: Prisma.TipEntryWhereInput = range
        ? { collectedAt: { gte: range.start, lte: range.end } }
        : {}

      const where: Prisma.TipEntryWhereInput = {
        tenantId,
        ...staffFilter,
        ...dateFilter,
        ...(source ? { source } : {}),
        ...(isDistributed ? { isDistributed: isDistributed === 'true' } : {}),
      }

      const entries = await db.tipEntry.findMany({
        where,
        orderBy: { collectedAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          distributions: {
            select: {
              id: true,
              staffId: true,
              amount: true,
              shareWeight: true,
              notes: true,
              distributedAt: true,
            },
          },
        },
      })

      const hasMore = entries.length > limit
      const page = hasMore ? entries.slice(0, limit) : entries
      const nextCursor = hasMore ? page[page.length - 1].id : null

      const staffIds = new Set<string>()
      const appointmentIds = new Set<string>()
      for (const e of page) {
        if (e.staffId) staffIds.add(e.staffId)
        if (e.appointmentId) appointmentIds.add(e.appointmentId)
        for (const d of e.distributions) staffIds.add(d.staffId)
      }
      const [staffList, appointments] = await Promise.all([
        staffIds.size > 0
          ? db.staffProfile.findMany({
              where: { id: { in: Array.from(staffIds) }, tenantId },
              select: { id: true, user: { select: { fullName: true } } },
            })
          : Promise.resolve([] as Array<{ id: string; user: { fullName: string } }>),
        appointmentIds.size > 0
          ? db.appointment.findMany({
              where: { id: { in: Array.from(appointmentIds) }, tenantId },
              select: { id: true, referenceCode: true, customer: { select: { fullName: true } } },
            })
          : Promise.resolve([] as Array<{ id: string; referenceCode: string; customer: { fullName: string } }>),
      ])
      const staffNameById = new Map(staffList.map((s) => [s.id, s.user.fullName]))
      const apptById = new Map(appointments.map((a) => [a.id, a]))

      return res.json({
        data: page.map((e) => {
          const appt = e.appointmentId ? apptById.get(e.appointmentId) : undefined
          return {
          id: e.id,
          amount: Number(e.amount),
          source: e.source,
          notes: e.notes,
          collectedAt: e.collectedAt.toISOString(),
          isDistributed: e.isDistributed,
          staffId: e.staffId,
          staffName: e.staffId ? staffNameById.get(e.staffId) ?? null : null,
          appointmentId: e.appointmentId,
          appointmentReference: appt?.referenceCode ?? null,
          customerName: appt?.customer?.fullName ?? null,
          distributions: e.distributions.map((d) => ({
            id: d.id,
            staffId: d.staffId,
            staffName: staffNameById.get(d.staffId) ?? null,
            amount: Number(d.amount),
            shareWeight: d.shareWeight !== null ? Number(d.shareWeight) : null,
            notes: d.notes,
            distributedAt: d.distributedAt.toISOString(),
          })),
          }
        }),
        nextCursor,
      })
    } catch (err) {
      next(err)
    }
  })

  // PATCH /tips/:id
  router.patch('/tips/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const role = req.user!.role
      if (!isOwnerOrManager(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetki yok.' } })
      }

      const idParsed = z.string().uuid().safeParse(req.params.id)
      if (!idParsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz id.' } })
      }
      const id = idParsed.data

      const parsed = updateTipBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Geçersiz veri.' } })
      }
      const data = parsed.data

      const existing = await db.tipEntry.findFirst({
        where: { id, tenantId },
        select: { id: true, isDistributed: true },
      })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bahşiş kaydı bulunamadı.' } })
      }
      if (existing.isDistributed) {
        return res.status(409).json({ error: { code: 'CONFLICT', message: 'Dağıtılmış bahşiş düzenlenemez.' } })
      }

      const updateData: Prisma.TipEntryUpdateInput = {}
      if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount)
      if (data.source !== undefined) updateData.source = data.source as TipSource
      if (data.notes !== undefined) updateData.notes = data.notes
      if (data.staffId !== undefined) {
        if (data.staffId) {
          const staff = await db.staffProfile.findFirst({ where: { id: data.staffId, tenantId }, select: { id: true } })
          if (!staff) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
          }
        }
        updateData.staffId = data.staffId
      }
      if (data.appointmentId !== undefined) {
        if (data.appointmentId) {
          const appt = await db.appointment.findFirst({ where: { id: data.appointmentId, tenantId }, select: { id: true } })
          if (!appt) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
          }
        }
        updateData.appointmentId = data.appointmentId
      }

      const updated = await db.tipEntry.update({ where: { id }, data: updateData })

      return res.json({
        id: updated.id,
        amount: Number(updated.amount),
        source: updated.source,
        notes: updated.notes,
        staffId: updated.staffId,
        appointmentId: updated.appointmentId,
        collectedAt: updated.collectedAt.toISOString(),
        isDistributed: updated.isDistributed,
      })
    } catch (err) {
      next(err)
    }
  })

  // DELETE /tips/:id
  router.delete('/tips/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const role = req.user!.role
      if (!isOwnerOrManager(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetki yok.' } })
      }

      const idParsed = z.string().uuid().safeParse(req.params.id)
      if (!idParsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz id.' } })
      }
      const id = idParsed.data

      const existing = await db.tipEntry.findFirst({
        where: { id, tenantId },
        select: { id: true, isDistributed: true },
      })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bahşiş kaydı bulunamadı.' } })
      }
      if (existing.isDistributed) {
        return res.status(409).json({ error: { code: 'CONFLICT', message: 'Dağıtılmış bahşiş silinemez.' } })
      }

      await db.tipEntry.delete({ where: { id } })
      return res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  // GET /tips/summary
  router.get('/tips/summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Resepsiyon bahşiş KAYDEDER ama listeyi/özeti görmez (matris 33-35); varsayılan ret.
      if (req.user!.role === 'receptionist') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!

      const querySchema = z.object({
        period: z.enum(['today', 'week', 'month', 'custom']).optional(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      const parsed = querySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz sorgu parametresi.' } })
      }
      const { period, from, to } = parsed.data
      const effectivePeriod = period ?? 'today'

      let bounds: PeriodBounds
      if (effectivePeriod === 'custom') {
        const range = parseRange(from, to)
        if (!range) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'custom periyodu için from/to gerekli.' } })
        }
        bounds = range
      } else {
        bounds = getPeriodBounds(effectivePeriod)
      }

      const rangeFilter = { collectedAt: { gte: bounds.start, lte: bounds.end } }

      const [totalAgg, undistributedAgg, perStaffRaw, staffCount, distributionsAgg] = await Promise.all([
        db.tipEntry.aggregate({
          where: { tenantId, ...rangeFilter },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        db.tipEntry.aggregate({
          where: { tenantId, isDistributed: false },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        db.tipEntry.groupBy({
          by: ['staffId'],
          where: { tenantId, staffId: { not: null }, ...rangeFilter },
          _sum: { amount: true },
        }),
        db.staffProfile.count({ where: { tenantId } }),
        db.tipDistribution.groupBy({
          by: ['staffId'],
          where: { tenantId, distributedAt: { gte: bounds.start, lte: bounds.end } },
          _sum: { amount: true },
        }),
      ])

      const staffTotals = new Map<string, number>()
      for (const row of perStaffRaw) {
        if (!row.staffId) continue
        staffTotals.set(row.staffId, (staffTotals.get(row.staffId) ?? 0) + Number(row._sum.amount ?? 0))
      }
      for (const row of distributionsAgg) {
        staffTotals.set(row.staffId, (staffTotals.get(row.staffId) ?? 0) + Number(row._sum.amount ?? 0))
      }

      const staffIds = Array.from(staffTotals.keys())
      const staffNames = staffIds.length > 0
        ? await db.staffProfile.findMany({
            where: { id: { in: staffIds }, tenantId },
            select: { id: true, user: { select: { fullName: true } } },
          })
        : []
      const nameById = new Map(staffNames.map((s) => [s.id, s.user.fullName]))

      const perStaff = staffIds
        .map((id) => ({
          staffId: id,
          staffName: nameById.get(id) ?? 'Bilinmeyen',
          total: staffTotals.get(id) ?? 0,
        }))
        .sort((a, b) => b.total - a.total)

      const totalAmount = Number(totalAgg._sum.amount ?? 0)
      const undistributedTotal = Number(undistributedAgg._sum.amount ?? 0)
      const avgPerStaff = staffCount > 0 ? totalAmount / staffCount : 0

      return res.json({
        period: effectivePeriod,
        from: bounds.start.toISOString(),
        to: bounds.end.toISOString(),
        totalAmount,
        totalCount: totalAgg._count._all,
        undistributedTotal,
        undistributedCount: undistributedAgg._count._all,
        avgPerStaff,
        staffCount,
        perStaff,
      })
    } catch (err) {
      next(err)
    }
  })

  // POST /tips/distribute
  router.post('/tips/distribute', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const role = req.user!.role
      if (!isOwnerOrManager(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetki yok.' } })
      }

      const parsed = distributeBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Geçersiz veri.' } })
      }
      const { tipIds, distributions, notes } = parsed.data

      // Mode detection
      const hasAmounts = distributions.every((d) => d.amount !== undefined)
      const hasWeights = distributions.every((d) => d.shareWeight !== undefined)
      if (!hasAmounts && !hasWeights) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Tüm dağıtımlar amount veya shareWeight olmalı (karışık olamaz).' } })
      }

      const result = await db.$transaction(async (tx) => {
        const tipsWhere: Prisma.TipEntryWhereInput = {
          tenantId,
          isDistributed: false,
          ...(tipIds && tipIds.length > 0 ? { id: { in: tipIds } } : {}),
        }
        const targetTips = await tx.tipEntry.findMany({
          where: tipsWhere,
          select: { id: true, amount: true },
        })

        if (targetTips.length === 0) {
          throw new HttpError(400, 'NO_POOL', 'Dağıtılacak bahşiş bulunamadı.')
        }
        if (tipIds && targetTips.length !== tipIds.length) {
          throw new HttpError(409, 'CONFLICT', 'Seçili bahşişlerden bazıları zaten dağıtılmış.')
        }

        const poolTotal = targetTips.reduce((sum, t) => sum + Number(t.amount), 0)

        // Verify staff ids belong to tenant
        const staffIds = distributions.map((d) => d.staffId)
        const staffList = await tx.staffProfile.findMany({
          where: { id: { in: staffIds }, tenantId },
          select: { id: true },
        })
        if (staffList.length !== new Set(staffIds).size) {
          throw new HttpError(404, 'NOT_FOUND', 'Bazı personeller bulunamadı.')
        }

        // Compute amounts
        let allocations: Array<{ staffId: string; amount: number; shareWeight: number | null; notes: string | null }>
        if (hasWeights) {
          const totalWeight = distributions.reduce((s, d) => s + (d.shareWeight ?? 0), 0)
          if (totalWeight <= 0) {
            throw new HttpError(400, 'VALIDATION_ERROR', 'Toplam ağırlık 0\'dan büyük olmalı.')
          }
          // Proportional, distribute remainder to last
          let allocated = 0
          allocations = distributions.map((d, idx) => {
            let amt: number
            if (idx === distributions.length - 1) {
              amt = Math.round((poolTotal - allocated) * 100) / 100
            } else {
              amt = Math.round((poolTotal * (d.shareWeight ?? 0) / totalWeight) * 100) / 100
              allocated += amt
            }
            return {
              staffId: d.staffId,
              amount: amt,
              shareWeight: d.shareWeight ?? null,
              notes: d.notes ?? notes ?? null,
            }
          })
        } else {
          const sum = distributions.reduce((s, d) => s + (d.amount ?? 0), 0)
          if (Math.abs(sum - poolTotal) > 0.01) {
            throw new HttpError(400, 'AMOUNT_MISMATCH', `Dağıtım toplamı (${sum.toFixed(2)}) havuz toplamına (${poolTotal.toFixed(2)}) eşit olmalı.`)
          }
          allocations = distributions.map((d) => ({
            staffId: d.staffId,
            amount: d.amount!,
            shareWeight: null,
            notes: d.notes ?? notes ?? null,
          }))
        }

        const isSingleTip = targetTips.length === 1
        const linkTipEntryId = isSingleTip ? targetTips[0].id : null

        const createdDistributions = await Promise.all(
          allocations
            .filter((a) => a.amount > 0)
            .map((a) =>
              tx.tipDistribution.create({
                data: {
                  tenantId,
                  tipEntryId: linkTipEntryId,
                  staffId: a.staffId,
                  amount: new Prisma.Decimal(a.amount),
                  shareWeight: a.shareWeight !== null ? new Prisma.Decimal(a.shareWeight) : null,
                  notes: a.notes,
                },
              }),
            ),
        )

        await tx.tipEntry.updateMany({
          where: { id: { in: targetTips.map((t) => t.id) } },
          data: { isDistributed: true },
        })

        return {
          poolTotal,
          tipCount: targetTips.length,
          distributionCount: createdDistributions.length,
          distributions: createdDistributions.map((d) => ({
            id: d.id,
            staffId: d.staffId,
            amount: Number(d.amount),
            shareWeight: d.shareWeight !== null ? Number(d.shareWeight) : null,
            notes: d.notes,
            distributedAt: d.distributedAt.toISOString(),
          })),
        }
      })

      return res.status(201).json(result)
    } catch (err) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: { code: err.code, message: err.message } })
      }
      logger.error({ err }, 'Tip distribute failed')
      next(err)
    }
  })

  return router
}

// ─── Local error helper ───────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}
