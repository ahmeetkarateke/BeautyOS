import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { db } from '../lib/db'
import { authenticateJWT, requireTenantAccess } from '../middleware/auth.middleware'

export function createTenantRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)

  // GET /api/v1/tenants/:slug/dashboard
  router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)

      const yesterdayStart = new Date(todayStart)
      yesterdayStart.setDate(yesterdayStart.getDate() - 1)
      const yesterdayEnd = new Date(todayEnd)
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1)

      const [
        todayAppointments,
        yesterdayAppointments,
        totalCustomers,
        todayTransactions,
        yesterdayTransactions,
        totalStaff,
      ] = await Promise.all([
        db.appointment.count({
          where: { tenantId, startAt: { gte: todayStart, lte: todayEnd } },
        }),
        db.appointment.count({
          where: { tenantId, startAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        }),
        db.customer.count({ where: { tenantId } }),
        db.transaction.aggregate({
          where: { tenantId, createdAt: { gte: todayStart, lte: todayEnd }, status: 'completed' },
          _sum: { grossAmount: true },
        }),
        db.transaction.aggregate({
          where: { tenantId, createdAt: { gte: yesterdayStart, lte: yesterdayEnd }, status: 'completed' },
          _sum: { grossAmount: true },
        }),
        db.staffProfile.count({ where: { tenantId } }),
      ])

      const todayRevenue = Number(todayTransactions._sum.grossAmount ?? 0)
      const yesterdayRevenue = Number(yesterdayTransactions._sum.grossAmount ?? 0)

      const revenueChange = yesterdayRevenue === 0
        ? 0
        : Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)

      const appointmentChange = yesterdayAppointments === 0
        ? 0
        : Math.round(((todayAppointments - yesterdayAppointments) / yesterdayAppointments) * 100)

      const maxSlots = totalStaff * 8
      const occupancyRate = maxSlots === 0 ? 0 : Math.min(100, Math.round((todayAppointments / maxSlots) * 100))

      return res.json({
        todayRevenue,
        todayAppointmentCount: todayAppointments,
        totalCustomers,
        occupancyRate,
        revenueChange,
        appointmentChange,
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/appointments?date=YYYY-MM-DD&limit=10
  router.get('/appointments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId

      const querySchema = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional().default(10),
      })

      const parsed = querySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz sorgu parametresi.' } })
      }

      const { date, limit } = parsed.data

      let dateFilter = {}
      if (date) {
        const start = new Date(`${date}T00:00:00.000Z`)
        const end = new Date(`${date}T23:59:59.999Z`)
        dateFilter = { startAt: { gte: start, lte: end } }
      }

      const appointments = await db.appointment.findMany({
        where: { tenantId, ...dateFilter },
        take: limit,
        orderBy: { startAt: 'asc' },
        include: {
          customer: { select: { fullName: true } },
          service: { select: { name: true } },
          staff: {
            select: {
              colorCode: true,
              user: { select: { fullName: true } },
            },
          },
        },
      })

      return res.json({
        data: appointments.map((a) => ({
          id: a.id,
          customerName: a.customer.fullName,
          serviceName: a.service.name,
          staffName: a.staff.user.fullName,
          startTime: a.startAt.toISOString(),
          endTime: a.endAt.toISOString(),
          status: a.status,
          staffColorCode: a.staff.colorCode,
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/customers
  router.get('/customers', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId

      const customers = await db.customer.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          totalVisits: true,
          lastVisitAt: true,
          createdAt: true,
        },
      })

      return res.json({
        data: customers.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          phone: c.phone,
          email: c.email,
          totalVisits: c.totalVisits,
          lastVisitDate: c.lastVisitAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
