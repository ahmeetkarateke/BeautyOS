import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { db } from '../lib/db'
import { authenticateJWT, requireSuperAdmin } from '../middleware/auth.middleware'

const patchTenantSchema = z.object({
  isActive: z.boolean().optional(),
  trialEndsAt: z.string().datetime().optional(),
  plan: z.enum(['trial', 'starter', 'pro']).optional(),
})

export function createAdminRouter(): Router {
  const router = Router()

  // Süper yönetici HTTP ile oluşturulmaz (S7-K3): apps/api/scripts/create-superadmin.ts

  // All routes below require JWT + superadmin role
  router.use(authenticateJWT, requireSuperAdmin)

  // GET /tenants — list with optional filters
  router.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, plan, isActive } = req.query

      const where: Record<string, unknown> = {}
      if (typeof search === 'string' && search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ]
      }
      if (typeof plan === 'string' && plan) {
        where.plan = plan
      }
      if (typeof isActive === 'string' && isActive !== '') {
        where.isActive = isActive === 'true'
      }

      const tenants = await db.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          isActive: true,
          trialEndsAt: true,
          createdAt: true,
          _count: {
            select: { users: true, appointments: true, customers: true },
          },
          users: {
            where: { role: 'owner' },
            select: { email: true, phone: true, fullName: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return res.json({ tenants })
    } catch (err) {
      next(err)
    }
  })

  // GET /tenants/:tenantId — detail + 30-day activity summary
  router.get('/tenants/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, plan: true, isActive: true, trialEndsAt: true, createdAt: true },
      })

      if (!tenant) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant bulunamadı.' } })
      }

      const [totalAppointments, totalCustomers, revenueAgg, lastAppointment] = await Promise.all([
        db.appointment.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
        db.customer.count({ where: { tenantId } }),
        db.transaction.aggregate({
          where: { tenantId, createdAt: { gte: thirtyDaysAgo }, status: 'completed' },
          _sum: { grossAmount: true },
        }),
        db.appointment.findFirst({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ])

      return res.json({
        tenant,
        activity: {
          totalAppointments,
          totalCustomers,
          totalRevenue: Number(revenueAgg._sum.grossAmount ?? 0),
          lastActivityAt: lastAppointment?.createdAt ?? null,
        },
      })
    } catch (err) {
      next(err)
    }
  })

  // PATCH /tenants/:tenantId — update plan, isActive, trialEndsAt
  router.patch('/tenants/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = req.params
      const parsed = patchTenantSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Geçersiz veri.' } })
      }

      const { isActive, trialEndsAt, plan } = parsed.data
      if (isActive === undefined && trialEndsAt === undefined && plan === undefined) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'En az bir alan gerekli.' } })
      }

      const existing = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant bulunamadı.' } })
      }

      const updated = await db.tenant.update({
        where: { id: tenantId },
        data: {
          ...(isActive !== undefined ? { isActive } : {}),
          ...(trialEndsAt !== undefined ? { trialEndsAt: new Date(trialEndsAt) } : {}),
          ...(plan !== undefined ? { plan } : {}),
        },
        select: { id: true, name: true, slug: true, plan: true, isActive: true, trialEndsAt: true },
      })

      return res.json({ tenant: updated })
    } catch (err) {
      next(err)
    }
  })

  // GET /stats — overall summary
  router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const [totalTenants, activeTenants, trialTenants, expiredTenants, recentRegistrations] = await Promise.all([
        db.tenant.count(),
        db.tenant.count({ where: { isActive: true } }),
        db.tenant.count({ where: { plan: 'trial', isActive: true, trialEndsAt: { gte: now } } }),
        db.tenant.count({ where: { OR: [{ isActive: false }, { trialEndsAt: { lt: now } }] } }),
        db.tenant.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      ])

      return res.json({
        stats: {
          totalTenants,
          activeTenants,
          trialTenants,
          expiredTenants,
          recentRegistrations,
        },
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
