import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
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

  // GET /api/v1/tenants/:slug/services
  router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId

      const services = await db.service.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, durationMinutes: true, price: true, category: true },
      })

      return res.json({
        data: services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.durationMinutes,
          price: Number(s.price),
          category: s.category,
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/staff
  router.get('/staff', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId

      const staff = await db.staffProfile.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          title: true,
          colorCode: true,
          user: { select: { fullName: true } },
        },
      })

      return res.json({
        data: staff.map((s) => ({
          id: s.id,
          title: s.title,
          fullName: s.user.fullName,
          colorCode: s.colorCode,
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  // POST /api/v1/tenants/:slug/appointments
  const createAppointmentSchema = z.object({
    customerId: z.string().uuid(),
    serviceId: z.string().uuid(),
    staffId: z.string().uuid(),
    startAt: z.string().datetime(),
    notes: z.string().max(500).optional(),
  })

  router.post('/appointments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId

      const parsed = createAppointmentSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz randevu verisi.' } })
      }

      const { customerId, serviceId, staffId, startAt, notes } = parsed.data

      const service = await db.service.findFirst({
        where: { id: serviceId, tenantId, isActive: true },
        select: { durationMinutes: true, price: true },
      })
      if (!service) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
      }

      const startDate = new Date(startAt)
      const endDate = new Date(startDate.getTime() + service.durationMinutes * 60 * 1000)

      const referenceCode = `APT-${Date.now().toString(36).toUpperCase()}`

      const appointment = await db.appointment.create({
        data: {
          tenantId,
          customerId,
          serviceId,
          staffId,
          startAt: startDate,
          endAt: endDate,
          priceCharged: service.price,
          referenceCode,
          notes,
          bookingChannel: 'manual',
          status: 'pending',
        },
        include: {
          customer: { select: { fullName: true } },
          service: { select: { name: true } },
          staff: { select: { colorCode: true, user: { select: { fullName: true } } } },
        },
      })

      return res.status(201).json({
        id: appointment.id,
        referenceCode: appointment.referenceCode,
        customerName: appointment.customer.fullName,
        serviceName: appointment.service.name,
        staffName: appointment.staff.user.fullName,
        startTime: appointment.startAt.toISOString(),
        endTime: appointment.endAt.toISOString(),
        status: appointment.status,
        staffColorCode: appointment.staff.colorCode,
      })
    } catch (err) {
      next(err)
    }
  })

  // POST /api/v1/tenants/:slug/customers
  const createCustomerSchema = z.object({
    fullName: z.string().min(2).max(100),
    phone: z.string().min(7).max(20),
    email: z.string().email().optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })

  router.post('/customers', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId

      const parsed = createCustomerSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz müşteri verisi.' } })
      }

      const { fullName, phone, email, birthDate } = parsed.data

      try {
        const customer = await db.customer.create({
          data: {
            tenantId,
            fullName,
            phone,
            email,
            birthDate: birthDate ? new Date(birthDate) : undefined,
          },
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            totalVisits: true,
            createdAt: true,
          },
        })

        return res.status(201).json({
          id: customer.id,
          fullName: customer.fullName,
          phone: customer.phone,
          email: customer.email,
          totalVisits: customer.totalVisits,
          createdAt: customer.createdAt.toISOString(),
        })
      } catch (dbErr: unknown) {
        if ((dbErr as { code?: string }).code === 'P2002') {
          return res.status(409).json({ error: { code: 'DUPLICATE_PHONE', message: 'Bu telefon numarasıyla kayıtlı müşteri zaten var.' } })
        }
        throw dbErr
      }
    } catch (err) {
      next(err)
    }
  })

  // PATCH /api/v1/tenants/:slug/settings
  const settingsSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().min(7).max(20).optional(),
    address: z.string().min(5).max(255).optional(),
    workingHours: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/).optional(),
  })

  router.patch('/settings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (role !== 'owner' && role !== 'manager') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const parsed = settingsSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz alan değeri.' } })
      }

      const { name, ...settingsPatch } = parsed.data
      const tenantId = req.user!.tenantId

      const existing = await db.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant bulunamadı.' } })
      }

      const mergedSettings = {
        ...(existing.settings as object),
        ...settingsPatch,
      }

      const updated = await db.tenant.update({
        where: { id: tenantId },
        data: {
          ...(name ? { name } : {}),
          settings: mergedSettings,
        },
        select: { id: true, name: true, slug: true, settings: true },
      })

      return res.json(updated)
    } catch (err) {
      next(err)
    }
  })

  // PATCH /api/v1/tenants/:slug/users/:userId/password
  const passwordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  })

  router.patch('/users/:userId/password', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params
      const requestingUser = req.user!

      const canChange = requestingUser.userId === userId || requestingUser.role === 'owner'
      if (!canChange) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const parsed = passwordSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz şifre formatı.' } })
      }

      const { currentPassword, newPassword } = parsed.data

      const user = await db.user.findFirst({
        where: { id: userId, tenantId: requestingUser.tenantId, isActive: true },
        select: { id: true, passwordHash: true },
      })

      if (!user) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı.' } })
      }

      const match = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!match) {
        return res.status(401).json({ error: { code: 'INVALID_PASSWORD', message: 'Mevcut şifre hatalı.' } })
      }

      const newHash = await bcrypt.hash(newPassword, 10)
      await db.user.update({ where: { id: userId }, data: { passwordHash: newHash } })

      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  return router
}
