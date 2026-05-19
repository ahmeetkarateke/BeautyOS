import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, PackageStatus } from '@prisma/client'
import { db } from '../lib/db'
import { authenticateJWT, requireTenantAccess, checkTenantActive } from '../middleware/auth.middleware'

const UUID = z.string().uuid()

const createPackageSchema = z.object({
  serviceId: UUID,
  name: z.string().trim().min(2).max(100),
  totalSessions: z.number().int().min(1).max(100),
  price: z.number().positive(),
  validityDays: z.number().int().min(1).max(1095).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

const updatePackageSchema = z.object({
  serviceId: UUID.optional(),
  name: z.string().trim().min(2).max(100).optional(),
  totalSessions: z.number().int().min(1).max(100).optional(),
  price: z.number().positive().optional(),
  validityDays: z.number().int().min(1).max(1095).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

const sellPackageSchema = z.object({
  customerId: UUID,
  packageId: UUID,
  pricePaid: z.number().positive().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

const useSessionSchema = z.object({
  appointmentId: UUID.optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

const updateCustomerPackageSchema = z.object({
  status: z.nativeEnum(PackageStatus).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

function requireOwnerOrManager(req: Request, res: Response): boolean {
  const role = req.user!.role
  if (role !== 'owner' && role !== 'manager') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
    return false
  }
  return true
}

function serializePackage<T extends { price: Prisma.Decimal }>(pkg: T): Omit<T, 'price'> & { price: number } {
  const { price, ...rest } = pkg
  return { ...rest, price: Number(price) }
}

function serializeCustomerPackage<T extends { pricePaid: Prisma.Decimal; package?: { price: Prisma.Decimal } | null }>(
  cp: T,
): Omit<T, 'pricePaid' | 'package'> & { pricePaid: number; package?: (Omit<NonNullable<T['package']>, 'price'> & { price: number }) | null } {
  const { pricePaid, package: pkg, ...rest } = cp
  return {
    ...rest,
    pricePaid: Number(pricePaid),
    package: pkg ? { ...pkg, price: Number(pkg.price) } : pkg,
  } as Omit<T, 'pricePaid' | 'package'> & { pricePaid: number; package?: (Omit<NonNullable<T['package']>, 'price'> & { price: number }) | null }
}

export function createPackagesRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  // ─── ServicePackage CRUD ───────────────────────────────────────────────────

  router.get('/packages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId : undefined
      const includeInactive = req.query.includeInactive === 'true'

      const where: Prisma.ServicePackageWhereInput = { tenantId }
      if (serviceId) where.serviceId = serviceId
      if (!includeInactive) where.isActive = true

      const packages = await db.servicePackage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { service: { select: { id: true, name: true, durationMinutes: true } } },
      })

      return res.json({ data: packages.map((p) => serializePackage(p)) })
    } catch (err) {
      next(err)
    }
  })

  router.post('/packages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const parsed = createPackageSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz paket verisi.' } })
      }
      const tenantId = req.tenantId!

      const service = await db.service.findFirst({ where: { id: parsed.data.serviceId, tenantId } })
      if (!service) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
      }

      const created = await db.servicePackage.create({
        data: {
          tenantId,
          serviceId: parsed.data.serviceId,
          name: parsed.data.name,
          totalSessions: parsed.data.totalSessions,
          price: new Prisma.Decimal(parsed.data.price),
          validityDays: parsed.data.validityDays ?? null,
          description: parsed.data.description ?? null,
          isActive: parsed.data.isActive ?? true,
        },
        include: { service: { select: { id: true, name: true, durationMinutes: true } } },
      })

      return res.status(201).json(serializePackage(created))
    } catch (err) {
      next(err)
    }
  })

  router.patch('/packages/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const parsed = updatePackageSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz paket verisi.' } })
      }
      const tenantId = req.tenantId!
      const { id } = req.params

      const existing = await db.servicePackage.findFirst({ where: { id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Paket bulunamadı.' } })
      }

      const data: Prisma.ServicePackageUpdateInput = {}
      if (parsed.data.name !== undefined) data.name = parsed.data.name
      if (parsed.data.totalSessions !== undefined) data.totalSessions = parsed.data.totalSessions
      if (parsed.data.price !== undefined) data.price = new Prisma.Decimal(parsed.data.price)
      if (parsed.data.validityDays !== undefined) data.validityDays = parsed.data.validityDays
      if (parsed.data.description !== undefined) data.description = parsed.data.description
      if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive
      if (parsed.data.serviceId !== undefined) {
        const svc = await db.service.findFirst({ where: { id: parsed.data.serviceId, tenantId } })
        if (!svc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
        data.service = { connect: { id: parsed.data.serviceId } }
      }

      const updated = await db.servicePackage.update({
        where: { id },
        data,
        include: { service: { select: { id: true, name: true, durationMinutes: true } } },
      })

      return res.json(serializePackage(updated))
    } catch (err) {
      next(err)
    }
  })

  router.delete('/packages/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const tenantId = req.tenantId!
      const { id } = req.params

      const existing = await db.servicePackage.findFirst({ where: { id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Paket bulunamadı.' } })
      }

      const activeCount = await db.customerPackage.count({
        where: { packageId: id, tenantId, status: PackageStatus.active },
      })
      if (activeCount > 0) {
        return res.status(409).json({
          error: {
            code: 'PACKAGE_IN_USE',
            message: `Bu paketi kullanan ${activeCount} aktif müşteri paketi var. Önce onları tamamlayın veya iptal edin.`,
          },
        })
      }

      await db.servicePackage.update({ where: { id }, data: { isActive: false } })
      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  // ─── CustomerPackage ───────────────────────────────────────────────────────

  router.get('/customer-packages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined
      const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined

      const where: Prisma.CustomerPackageWhereInput = { tenantId }
      if (customerId) where.customerId = customerId
      if (statusRaw && (Object.values(PackageStatus) as string[]).includes(statusRaw)) {
        where.status = statusRaw as PackageStatus
      }

      const list = await db.customerPackage.findMany({
        where,
        orderBy: { purchaseDate: 'desc' },
        include: {
          package: { include: { service: { select: { id: true, name: true } } } },
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      })

      return res.json({
        data: list.map((cp) => serializeCustomerPackage(cp)),
      })
    } catch (err) {
      next(err)
    }
  })

  router.post('/customer-packages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const parsed = sellPackageSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz satış verisi.' } })
      }
      const tenantId = req.tenantId!

      const [customer, pkg] = await Promise.all([
        db.customer.findFirst({ where: { id: parsed.data.customerId, tenantId } }),
        db.servicePackage.findFirst({ where: { id: parsed.data.packageId, tenantId, isActive: true } }),
      ])
      if (!customer) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }
      if (!pkg) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Paket bulunamadı veya pasif.' } })
      }

      const pricePaid = parsed.data.pricePaid !== undefined ? parsed.data.pricePaid : Number(pkg.price)
      const purchaseDate = new Date()
      const expiresAt = pkg.validityDays
        ? new Date(purchaseDate.getTime() + pkg.validityDays * 24 * 60 * 60 * 1000)
        : null

      const created = await db.customerPackage.create({
        data: {
          tenantId,
          customerId: parsed.data.customerId,
          packageId: parsed.data.packageId,
          totalSessions: pkg.totalSessions,
          remainingSessions: pkg.totalSessions,
          pricePaid: new Prisma.Decimal(pricePaid),
          status: PackageStatus.active,
          purchaseDate,
          expiresAt,
          notes: parsed.data.notes ?? null,
        },
        include: {
          package: { include: { service: { select: { id: true, name: true } } } },
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      })

      return res.status(201).json(serializeCustomerPackage(created))
    } catch (err) {
      next(err)
    }
  })

  router.post('/customer-packages/:id/use', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (role !== 'owner' && role !== 'manager' && role !== 'staff') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }
      const parsed = useSessionSchema.safeParse(req.body ?? {})
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz kullanım verisi.' } })
      }
      const tenantId = req.tenantId!
      const { id } = req.params

      type UseError = { kind: 'error'; status: number; code: string; message: string }
      const result = await db.$transaction(async (tx) => {
        const cp = await tx.customerPackage.findFirst({ where: { id, tenantId } })
        if (!cp) return { kind: 'error', status: 404, code: 'NOT_FOUND', message: 'Müşteri paketi bulunamadı.' } satisfies UseError
        if (cp.status !== PackageStatus.active) {
          return { kind: 'error', status: 409, code: 'PACKAGE_NOT_ACTIVE', message: 'Paket aktif değil.' } satisfies UseError
        }
        if (cp.remainingSessions <= 0) {
          return { kind: 'error', status: 409, code: 'NO_SESSIONS_LEFT', message: 'Bu pakette kalan seans yok.' } satisfies UseError
        }
        if (cp.expiresAt && cp.expiresAt < new Date()) {
          await tx.customerPackage.update({ where: { id }, data: { status: PackageStatus.expired } })
          return { kind: 'error', status: 409, code: 'PACKAGE_EXPIRED', message: 'Paketin geçerlilik süresi dolmuş.' } satisfies UseError
        }

        const newRemaining = cp.remainingSessions - 1
        const isCompleted = newRemaining === 0

        const updated = await tx.customerPackage.update({
          where: { id },
          data: {
            remainingSessions: newRemaining,
            status: isCompleted ? PackageStatus.completed : cp.status,
            completedAt: isCompleted ? new Date() : cp.completedAt,
          },
          include: {
            package: { include: { service: { select: { id: true, name: true } } } },
            customer: { select: { id: true, fullName: true, phone: true } },
          },
        })

        const usage = await tx.packageUsage.create({
          data: {
            customerPackageId: id,
            tenantId,
            appointmentId: parsed.data.appointmentId ?? null,
            notes: parsed.data.notes ?? null,
          },
        })

        return { kind: 'ok' as const, customerPackage: updated, usage }
      })

      if (result.kind === 'error') {
        return res.status(result.status).json({ error: { code: result.code, message: result.message } })
      }

      return res.json({
        customerPackage: serializeCustomerPackage(result.customerPackage),
        usage: result.usage,
      })
    } catch (err) {
      next(err)
    }
  })

  router.patch('/customer-packages/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const parsed = updateCustomerPackageSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz veri.' } })
      }
      const tenantId = req.tenantId!
      const { id } = req.params

      const existing = await db.customerPackage.findFirst({ where: { id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri paketi bulunamadı.' } })
      }

      const data: Prisma.CustomerPackageUpdateInput = {}
      if (parsed.data.status !== undefined) {
        data.status = parsed.data.status
        if (parsed.data.status === PackageStatus.completed && !existing.completedAt) {
          data.completedAt = new Date()
        }
      }
      if (parsed.data.notes !== undefined) data.notes = parsed.data.notes

      const updated = await db.customerPackage.update({
        where: { id },
        data,
        include: {
          package: { include: { service: { select: { id: true, name: true } } } },
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      })

      return res.json(serializeCustomerPackage(updated))
    } catch (err) {
      next(err)
    }
  })

  router.get('/customer-packages/:id/usages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const { id } = req.params

      const cp = await db.customerPackage.findFirst({ where: { id, tenantId }, select: { id: true } })
      if (!cp) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri paketi bulunamadı.' } })
      }

      const usages = await db.packageUsage.findMany({
        where: { customerPackageId: id, tenantId },
        orderBy: { usedAt: 'desc' },
      })

      return res.json({ data: usages })
    } catch (err) {
      next(err)
    }
  })

  return router
}
