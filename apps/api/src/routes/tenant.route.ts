import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { db } from '../lib/db'
import { logger } from '../lib/logger'
import { remindersQueue } from '../lib/queue'
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
        limit: z.preprocess(
          (v) => (v === undefined || v === '' ? 10 : Number(v)),
          z.number().int().min(1).max(100),
        ),
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

      const onlineOnly = req.query.onlineOnly === 'true'
      const services = await db.service.findMany({
        where: { tenantId, isActive: true, ...(onlineOnly ? { isOnlineBookable: true } : {}) },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, durationMinutes: true, price: true, category: true, isOnlineBookable: true },
      })

      return res.json({
        data: services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.durationMinutes,
          price: Number(s.price),
          category: s.category,
          isOnlineBookable: s.isOnlineBookable,
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
    startAt: z.string().min(1),
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

      const conflict = await db.appointment.findFirst({
        where: {
          staffId,
          tenantId,
          status: { notIn: ['cancelled', 'no_show'] },
          startAt: { lt: endDate },
          endAt: { gt: startDate },
        },
      })
      if (conflict) {
        return res.status(409).json({ error: { code: 'APPOINTMENT_CONFLICT', message: 'Seçilen personelin bu saatte başka bir randevusu var.' } })
      }

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

      // Hatırlatma job'larını fire-and-forget olarak ekle
      void (async () => {
        try {
          const now = Date.now()
          const startMs = appointment.startAt.getTime()
          const delay24h = startMs - 24 * 60 * 60 * 1000 - now
          const delay2h = startMs - 2 * 60 * 60 * 1000 - now

          if (delay24h > 0) {
            await remindersQueue.add(
              'reminder',
              { type: 'reminder_24h', appointmentId: appointment.id },
              { delay: delay24h, jobId: `reminder-24h-${appointment.id}` },
            )
          } else {
            logger.info({ appointmentId: appointment.id }, '24h hatırlatma zamanı geçmiş, eklenmedi')
          }

          if (delay2h > 0) {
            await remindersQueue.add(
              'reminder',
              { type: 'reminder_2h', appointmentId: appointment.id },
              { delay: delay2h, jobId: `reminder-2h-${appointment.id}` },
            )
          } else {
            logger.info({ appointmentId: appointment.id }, '2h hatırlatma zamanı geçmiş, eklenmedi')
          }
        } catch (err) {
          logger.warn({ err, appointmentId: appointment.id }, 'Hatırlatma job eklenemedi')
        }
      })()

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

  // GET /api/v1/tenants/:slug/settings
  router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId

      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, settings: true },
      })

      if (!tenant) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant bulunamadı.' } })
      }

      return res.json(tenant)
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/customers/:customerId
  router.get('/customers/:customerId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId
      const { customerId } = req.params

      const customer = await db.customer.findFirst({
        where: { id: customerId, tenantId },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          birthDate: true,
          allergyNotes: true,
          preferenceNotes: true,
          totalVisits: true,
          lifetimeValue: true,
          segment: true,
          lastVisitAt: true,
          createdAt: true,
          appointments: {
            orderBy: { startAt: 'desc' },
            take: 20,
            select: {
              id: true,
              startAt: true,
              endAt: true,
              status: true,
              priceCharged: true,
              service: { select: { name: true } },
              staff: { select: { user: { select: { fullName: true } } } },
            },
          },
        },
      })

      if (!customer) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      return res.json({
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
        birthDate: customer.birthDate?.toISOString() ?? null,
        allergyNotes: customer.allergyNotes,
        preferenceNotes: customer.preferenceNotes,
        totalVisits: customer.totalVisits,
        lifetimeValue: Number(customer.lifetimeValue),
        segment: customer.segment,
        lastVisitAt: customer.lastVisitAt?.toISOString() ?? null,
        createdAt: customer.createdAt.toISOString(),
        appointments: customer.appointments.map((a) => ({
          id: a.id,
          startTime: a.startAt.toISOString(),
          endTime: a.endAt.toISOString(),
          status: a.status,
          priceCharged: Number(a.priceCharged),
          serviceName: a.service.name,
          staffName: a.staff.user.fullName,
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  // PATCH /api/v1/tenants/:slug/appointments/:appointmentId/status
  const appointmentStatusSchema = z.object({
    status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
    cancellationReason: z.string().max(255).optional(),
  })

  router.patch('/appointments/:appointmentId/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId
      const { appointmentId } = req.params

      const parsed = appointmentStatusSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz durum değeri.' } })
      }

      const { status, cancellationReason } = parsed.data

      const existing = await db.appointment.findFirst({ where: { id: appointmentId, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
      }

      const updated = await db.appointment.update({
        where: { id: appointmentId },
        data: {
          status,
          ...(cancellationReason ? { cancellationReason } : {}),
        },
        select: { id: true, status: true, cancellationReason: true },
      })

      if (status === 'completed' && existing.status !== 'completed') {
        const appt = await db.appointment.findFirst({
          where: { id: appointmentId },
          include: { service: true },
        })
        if (appt) {
          const rate = Number(appt.service.commissionRate)
          const gross = Number(appt.priceCharged)
          await db.transaction.create({
            data: {
              tenantId,
              appointmentId,
              staffId: appt.staffId,
              grossAmount: gross,
              commissionRate: rate,
              commissionAmount: gross * rate,
              paymentMethod: 'cash',
              cashAmount: gross,
              status: 'completed',
              completedAt: new Date(),
            },
          })
        }
      }

      return res.json(updated)
    } catch (err) {
      next(err)
    }
  })

  // PATCH /api/v1/tenants/:slug/settings
  const settingsSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().min(7).max(20).optional(),
    address: z.string().min(5).max(255).optional(),
    workingHours: z.string().min(1).max(200).optional(),
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

  // ─── Services CRUD ────────────────────────────────────────────────────────────

  const createServiceSchema = z.object({
    name: z.string().min(1).max(100),
    category: z.string().max(50).optional(),
    durationMinutes: z.number().int().min(5),
    price: z.number().min(0),
    bufferMinutes: z.number().int().min(0).optional().default(0),
  })

  const updateServiceSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    category: z.string().max(50).optional(),
    durationMinutes: z.number().int().min(5).optional(),
    price: z.number().min(0).optional(),
    bufferMinutes: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    isOnlineBookable: z.boolean().optional(),
  })

  router.post('/services', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (role !== 'owner' && role !== 'manager') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const parsed = createServiceSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz hizmet verisi.' } })
      }

      const service = await db.service.create({
        data: { ...parsed.data, tenantId: req.user!.tenantId },
        select: { id: true, name: true, durationMinutes: true, price: true, category: true, bufferMinutes: true, isActive: true },
      })

      return res.status(201).json({ ...service, price: Number(service.price) })
    } catch (err) {
      next(err)
    }
  })

  router.patch('/services/:serviceId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (role !== 'owner' && role !== 'manager') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const parsed = updateServiceSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz hizmet verisi.' } })
      }

      const { serviceId } = req.params
      const tenantId = req.user!.tenantId

      const existing = await db.service.findFirst({ where: { id: serviceId, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
      }

      const updated = await db.service.update({
        where: { id: serviceId },
        data: parsed.data,
        select: { id: true, name: true, durationMinutes: true, price: true, category: true, bufferMinutes: true, isActive: true, isOnlineBookable: true },
      })

      return res.json({ ...updated, price: Number(updated.price) })
    } catch (err) {
      next(err)
    }
  })

  router.delete('/services/:serviceId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (role !== 'owner' && role !== 'manager') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const { serviceId } = req.params
      const tenantId = req.user!.tenantId

      const existing = await db.service.findFirst({ where: { id: serviceId, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
      }

      await db.service.update({ where: { id: serviceId }, data: { isActive: false } })

      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  // ─── Staff CRUD ────────────────────────────────────────────────────────────────

  const createStaffSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(2).max(100),
    title: z.string().min(1).max(100),
    bio: z.string().max(500).optional(),
    colorCode: z.number().int().optional(),
  })

  const updateStaffSchema = z.object({
    title: z.string().min(1).max(100).optional(),
    bio: z.string().max(500).optional(),
    colorCode: z.number().int().optional(),
    workingHours: z.record(z.unknown()).optional(),
  })

  router.post('/staff', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (role !== 'owner' && role !== 'manager') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const parsed = createStaffSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz personel verisi.' } })
      }

      const { email, password, fullName, title, bio, colorCode } = parsed.data
      const tenantId = req.user!.tenantId

      const existingUser = await db.user.findFirst({ where: { email, tenantId } })
      if (existingUser) {
        return res.status(409).json({ error: { code: 'DUPLICATE_EMAIL', message: 'Bu e-posta adresiyle kayıtlı kullanıcı zaten var.' } })
      }

      const passwordHash = await bcrypt.hash(password, 10)

      const result = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { tenantId, email, passwordHash, fullName, role: 'staff' },
        })
        const staffProfile = await tx.staffProfile.create({
          data: { userId: user.id, tenantId, title, bio, colorCode },
          select: {
            id: true,
            title: true,
            bio: true,
            colorCode: true,
            user: { select: { id: true, fullName: true, email: true } },
          },
        })
        return staffProfile
      })

      return res.status(201).json({
        id: result.id,
        title: result.title,
        bio: result.bio,
        colorCode: result.colorCode,
        fullName: result.user.fullName,
        email: result.user.email,
        userId: result.user.id,
      })
    } catch (err) {
      next(err)
    }
  })

  router.patch('/staff/:staffId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (role !== 'owner' && role !== 'manager') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const parsed = updateStaffSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz personel verisi.' } })
      }

      const { staffId } = req.params
      const tenantId = req.user!.tenantId

      const existing = await db.staffProfile.findFirst({ where: { id: staffId, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
      }

      const { workingHours, ...rest } = parsed.data
      const updated = await db.staffProfile.update({
        where: { id: staffId },
        data: {
          ...rest,
          ...(workingHours !== undefined && { workingHours: workingHours as Prisma.InputJsonValue }),
        },
        include: { user: { select: { fullName: true, email: true } } },
      })

      return res.json({
        id: updated.id,
        title: updated.title,
        bio: updated.bio,
        colorCode: updated.colorCode,
        workingHours: updated.workingHours,
        fullName: updated.user.fullName,
        email: updated.user.email,
      })
    } catch (err) {
      next(err)
    }
  })

  router.delete('/staff/:staffId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (role !== 'owner' && role !== 'manager') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const { staffId } = req.params
      const tenantId = req.user!.tenantId

      const profile = await db.staffProfile.findFirst({
        where: { id: staffId, tenantId },
        select: { userId: true },
      })
      if (!profile) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
      }

      await db.user.update({ where: { id: profile.userId }, data: { isActive: false } })

      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  // ─── Customer PATCH ────────────────────────────────────────────────────────────

  const updateCustomerSchema = z.object({
    fullName: z.string().min(2).max(100).optional(),
    phone: z.string().min(7).max(20).optional(),
    email: z.string().email().optional().nullable(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    allergyNotes: z.string().max(500).optional().nullable(),
    preferenceNotes: z.string().max(500).optional().nullable(),
  })

  router.patch('/customers/:customerId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { customerId } = req.params
      const tenantId = req.user!.tenantId

      const parsed = updateCustomerSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz müşteri verisi.' } })
      }

      const existing = await db.customer.findFirst({ where: { id: customerId, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      const { birthDate, ...rest } = parsed.data

      try {
        const updated = await db.customer.update({
          where: { id: customerId },
          data: {
            ...rest,
            ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
          },
          select: {
            id: true, fullName: true, phone: true, email: true,
            birthDate: true, allergyNotes: true, preferenceNotes: true,
            totalVisits: true, segment: true, lastVisitAt: true, createdAt: true,
          },
        })

        return res.json({
          ...updated,
          birthDate: updated.birthDate?.toISOString() ?? null,
          lastVisitAt: updated.lastVisitAt?.toISOString() ?? null,
          createdAt: updated.createdAt.toISOString(),
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

  // GET /api/v1/tenants/:slug/reports/daily?date=YYYY-MM-DD
  router.get('/reports/daily', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId
      const dateStr = (req.query.date as string | undefined) ?? new Date().toISOString().split('T')[0]

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz tarih formatı. YYYY-MM-DD bekleniyor.' } })
      }

      const dayStart = new Date(`${dateStr}T00:00:00.000Z`)
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`)

      const [transactions, expenses] = await Promise.all([
        db.transaction.findMany({
          where: { tenantId, status: 'completed', completedAt: { gte: dayStart, lte: dayEnd } },
          select: { grossAmount: true, paymentMethod: true, cashAmount: true, cardAmount: true },
        }),
        db.expense.findMany({
          where: { tenantId, expenseDate: { gte: dayStart, lte: dayEnd } },
          select: { title: true, category: true, amount: true },
        }),
      ])

      const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.grossAmount), 0)
      const cashRevenue = transactions.reduce((sum, t) => sum + Number(t.cashAmount), 0)
      const cardRevenue = transactions.reduce((sum, t) => sum + Number(t.cardAmount), 0)
      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

      return res.json({
        date: dateStr,
        totalRevenue,
        cashRevenue,
        cardRevenue,
        completedCount: transactions.length,
        netRevenue: totalRevenue - totalExpenses,
        expenses: expenses.map((e) => ({ title: e.title, category: e.category, amount: Number(e.amount) })),
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/reports/staff-commissions?date=YYYY-MM-DD
  router.get('/reports/staff-commissions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId
      const dateStr = (req.query.date as string | undefined) ?? new Date().toISOString().split('T')[0]

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz tarih formatı. YYYY-MM-DD bekleniyor.' } })
      }

      const dayStart = new Date(`${dateStr}T00:00:00.000Z`)
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`)

      const transactions = await db.transaction.findMany({
        where: { tenantId, status: 'completed', completedAt: { gte: dayStart, lte: dayEnd } },
        select: {
          staffId: true,
          grossAmount: true,
          commissionAmount: true,
        },
      })

      const staffIds = [...new Set(transactions.map((t) => t.staffId))]
      const staffProfiles = await db.staffProfile.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, user: { select: { fullName: true } } },
      })
      const staffMap = new Map(staffProfiles.map((s) => [s.id, s.user.fullName]))

      const grouped = new Map<string, { staffName: string; completedCount: number; grossAmount: number; commissionAmount: number }>()
      for (const t of transactions) {
        const entry = grouped.get(t.staffId) ?? {
          staffName: staffMap.get(t.staffId) ?? 'Bilinmiyor',
          completedCount: 0,
          grossAmount: 0,
          commissionAmount: 0,
        }
        entry.completedCount += 1
        entry.grossAmount += Number(t.grossAmount)
        entry.commissionAmount += Number(t.commissionAmount)
        grouped.set(t.staffId, entry)
      }

      return res.json({
        data: [...grouped.entries()].map(([staffId, v]) => ({ staffId, ...v })),
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
