import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { db } from '../lib/db'
import { logger } from '../lib/logger'
import { remindersQueue } from '../lib/queue'
import { authenticateJWT, requireTenantAccess } from '../middleware/auth.middleware'
import { TelegramChannel } from '../channels/telegram.channel'

// ─── Timezone Helpers (Europe/Istanbul = UTC+3 permanent since 2016) ──────────

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

function getDashboardPeriodBounds(period: 'today' | 'week' | 'month'): {
  current: PeriodBounds
  previous: PeriodBounds
} {
  const todayStr = getIstanbulDateStr()

  if (period === 'week') {
    const noon = new Date(`${todayStr}T12:00:00+03:00`)
    const dow = noon.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
    const mondayOffset = dow === 0 ? -6 : 1 - dow
    const mondayStr = addDays(todayStr, mondayOffset)
    const sundayStr = addDays(mondayStr, 6)
    return {
      current: { start: toTRBounds(mondayStr).start, end: toTRBounds(sundayStr).end },
      previous: { start: toTRBounds(addDays(mondayStr, -7)).start, end: toTRBounds(addDays(mondayStr, -1)).end },
    }
  }

  if (period === 'month') {
    const [y, m] = todayStr.split('-').map(Number)
    const firstDayStr = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
    const lastDayDate = new Date(Date.UTC(y, m, 0))
    const lastDayStr = lastDayDate.toISOString().split('T')[0]
    const prevLastDay = new Date(Date.UTC(y, m - 1, 0))
    const prevYear = prevLastDay.getUTCFullYear()
    const prevMonth = prevLastDay.getUTCMonth() + 1
    const prevFirstDayStr = `${String(prevYear).padStart(4, '0')}-${String(prevMonth).padStart(2, '0')}-01`
    const prevLastDayStr = prevLastDay.toISOString().split('T')[0]
    return {
      current: { start: toTRBounds(firstDayStr).start, end: toTRBounds(lastDayStr).end },
      previous: { start: toTRBounds(prevFirstDayStr).start, end: toTRBounds(prevLastDayStr).end },
    }
  }

  // today (default)
  return {
    current: toTRBounds(todayStr),
    previous: toTRBounds(addDays(todayStr, -1)),
  }
}

export function createTenantRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)

  // GET /api/v1/tenants/:slug/dashboard?period=today|week|month
  router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId
      const periodParam = req.query.period as string | undefined
      const period = (periodParam === 'week' || periodParam === 'month') ? periodParam : 'today'

      const { current, previous } = getDashboardPeriodBounds(period)

      const [
        currentAppointments,
        previousAppointments,
        totalCustomers,
        currentTransactions,
        previousTransactions,
        totalStaff,
      ] = await Promise.all([
        db.appointment.count({
          where: { tenantId, startAt: { gte: current.start, lte: current.end } },
        }),
        db.appointment.count({
          where: { tenantId, startAt: { gte: previous.start, lte: previous.end } },
        }),
        db.customer.count({ where: { tenantId } }),
        db.transaction.aggregate({
          where: { tenantId, completedAt: { gte: current.start, lte: current.end }, status: 'completed' },
          _sum: { grossAmount: true },
        }),
        db.transaction.aggregate({
          where: { tenantId, completedAt: { gte: previous.start, lte: previous.end }, status: 'completed' },
          _sum: { grossAmount: true },
        }),
        db.staffProfile.count({ where: { tenantId } }),
      ])

      const currentRevenue = Number(currentTransactions._sum.grossAmount ?? 0)
      const previousRevenue = Number(previousTransactions._sum.grossAmount ?? 0)

      const revenueChange = previousRevenue === 0
        ? (currentRevenue > 0 ? null : 0)
        : Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)

      const appointmentChange = previousAppointments === 0
        ? (currentAppointments > 0 ? null : 0)
        : Math.round(((currentAppointments - previousAppointments) / previousAppointments) * 100)

      const periodDays = Math.max(1, Math.round((current.end.getTime() - current.start.getTime()) / (1000 * 60 * 60 * 24)))
      const maxSlots = totalStaff * 8 * periodDays
      const occupancyRate = maxSlots === 0 ? 0 : Math.min(100, Math.round((currentAppointments / maxSlots) * 100))

      return res.json({
        period,
        todayRevenue: currentRevenue,
        todayAppointmentCount: currentAppointments,
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
          customer: { select: { fullName: true, phone: true } },
          service: { select: { name: true, category: true } },
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
          referenceCode: a.referenceCode,
          customerName: a.customer.fullName,
          customerPhone: a.customer.phone,
          serviceName: a.service.name,
          serviceCategory: a.service.category ?? '',
          staffName: a.staff.user.fullName,
          startTime: a.startAt.toISOString(),
          endTime: a.endAt.toISOString(),
          status: a.status,
          priceCharged: Number(a.priceCharged ?? 0),
          notes: a.notes ?? '',
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
        select: { id: true, name: true, durationMinutes: true, price: true, category: true, isOnlineBookable: true, followUpSchedule: true },
      })

      return res.json({
        data: services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.durationMinutes,
          price: Number(s.price),
          category: s.category,
          isOnlineBookable: s.isOnlineBookable,
          followUpSchedule: s.followUpSchedule ?? null,
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
        where: { tenantId, user: { isActive: true } },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { fullName: true, email: true } },
          serviceAssignments: {
            where: { isActive: true },
            include: { service: { select: { id: true, name: true, category: true } } },
          },
        },
      })

      return res.json({
        data: staff.map((s) => ({
          id: s.id,
          title: s.title,
          fullName: s.user.fullName,
          email: s.user.email,
          colorCode: s.colorCode,
          workingHours: s.workingHours,
          skills: s.serviceAssignments.map((a) => ({
            serviceId: a.serviceId,
            serviceName: a.service.name,
            category: a.service.category,
          })),
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

      const assignment = await db.staffServiceAssignment.findFirst({
        where: { staffId, serviceId, tenantId, isActive: true },
      })
      if (!assignment) {
        return res.status(422).json({
          error: { code: 'STAFF_NOT_SKILLED', message: 'Seçilen personel bu hizmeti yapamaz.' },
        })
      }
      const priceCharged = assignment.priceOverride ?? service.price

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
          priceCharged,
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
        select: { id: true, name: true, slug: true, settings: true, onboardingCompleted: true },
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
    cancellationReason: z.string().optional(),
    priceCharged: z.number().positive().optional(),
    paymentMethod: z.enum(['cash', 'card']).optional(),
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

      const TERMINAL_STATUSES = ['completed', 'cancelled', 'no_show']
      if (TERMINAL_STATUSES.includes(existing.status)) {
        return res.status(409).json({
          error: { code: 'STATUS_LOCKED', message: 'Tamamlanan veya iptal edilen randevunun durumu değiştirilemez.' },
        })
      }

      const updated = await db.appointment.update({
        where: { id: appointmentId },
        data: {
          status,
          ...(cancellationReason ? { cancellationReason } : {}),
        },
        select: { id: true, status: true, cancellationReason: true },
      })

      let followUpAppointments: Array<{ id: string; startAt: string; label: string }> = []

      if (status === 'completed' && existing.status !== 'completed') {
        const appt = await db.appointment.findFirst({
          where: { id: appointmentId },
          include: {
            service: true,
            customer: { select: { fullName: true, phone: true } },
            tenant: { select: { telegramBotToken: true, settings: true } },
          },
        })
        if (appt) {
          const rate = Number(appt.service.commissionRate)
          const gross = parsed.data.priceCharged ?? Number(appt.priceCharged)
          const method = parsed.data.paymentMethod ?? 'cash'
          const completedAt = new Date()
          await db.transaction.create({
            data: {
              tenantId,
              appointmentId,
              staffId: appt.staffId,
              grossAmount: gross,
              commissionRate: rate,
              commissionAmount: gross * rate,
              paymentMethod: method,
              cashAmount: method === 'cash' ? gross : 0,
              cardAmount: method === 'card' ? gross : 0,
              status: 'completed',
              completedAt,
            },
          })
          if (parsed.data.priceCharged) {
            await db.appointment.update({
              where: { id: appointmentId },
              data: { priceCharged: gross },
            })
          }

          // Takip randevuları oluştur
          const tenantSettings = appt.tenant?.settings as { followUpEnabled?: boolean } | null
          const schedule = appt.service.followUpSchedule
          if (
            tenantSettings?.followUpEnabled === true &&
            Array.isArray(schedule) &&
            schedule.length > 0
          ) {
            for (const entry of schedule as Array<{ day: number; label: string }>) {
              const fuStart = new Date(completedAt.getTime() + entry.day * 24 * 60 * 60 * 1000)
              const fuEnd = new Date(fuStart.getTime() + appt.service.durationMinutes * 60 * 1000)
              const fuAppt = await db.appointment.create({
                data: {
                  tenantId,
                  customerId: appt.customerId,
                  staffId: appt.staffId,
                  serviceId: appt.serviceId,
                  startAt: fuStart,
                  endAt: fuEnd,
                  status: 'pending',
                  notes: entry.label,
                  bookingChannel: 'manual',
                  referenceCode: `APT-${Date.now().toString(36).toUpperCase()}-F${entry.day}`,
                  priceCharged: appt.priceCharged,
                },
              })
              followUpAppointments.push({ id: fuAppt.id, startAt: fuStart.toISOString(), label: entry.label })
            }

            // Bildirimleri fire-and-forget gönder
            void (async () => {
              try {
                const botToken = appt.tenant?.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN
                if (!botToken) return
                const channel = new TelegramChannel(botToken)
                for (const fu of followUpAppointments) {
                  const tarih = new Date(fu.startAt).toLocaleDateString('tr-TR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'Europe/Istanbul',
                  })
                  const text = `${appt.service.name} işleminiz tamamlandı! ${fu.label} kontrolünüz (${tarih}) takvime eklendi. Saat değişikliği için bize yazabilirsiniz.`
                  await channel.sendText(appt.customer.phone, text)
                }
              } catch (err) {
                logger.warn({ err, appointmentId }, 'Follow-up bildirimleri gönderilemedi')
              }
            })()
          }
        }
      }

      return res.json({
        ...updated,
        ...(followUpAppointments.length > 0 ? { followUpAppointments } : {}),
      })
    } catch (err) {
      next(err)
    }
  })

  // PATCH /api/v1/tenants/:slug/appointments/:appointmentId/reschedule
  const rescheduleSchema = z.object({
    startAt: z.string().datetime(),
  })

  router.patch('/appointments/:appointmentId/reschedule', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (role !== 'owner' && role !== 'manager') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Randevu saati yalnızca owner veya manager tarafından değiştirilebilir.' } })
      }

      const tenantId = req.user!.tenantId
      const { appointmentId } = req.params

      const parsed = rescheduleSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz tarih formatı. ISO 8601 bekleniyor.' } })
      }

      const existing = await db.appointment.findFirst({
        where: { id: appointmentId, tenantId },
        include: { service: { select: { durationMinutes: true } } },
      })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
      }

      const TERMINAL_STATUSES = ['completed', 'cancelled', 'no_show']
      if (TERMINAL_STATUSES.includes(existing.status)) {
        return res.status(409).json({
          error: { code: 'STATUS_LOCKED', message: 'Tamamlanan veya iptal edilen randevunun saati değiştirilemez.' },
        })
      }

      const newStart = new Date(parsed.data.startAt)
      const newEnd = new Date(newStart.getTime() + existing.service.durationMinutes * 60 * 1000)

      const conflict = await db.appointment.findFirst({
        where: {
          id: { not: appointmentId },
          staffId: existing.staffId,
          tenantId,
          status: { notIn: ['cancelled', 'no_show'] },
          startAt: { lt: newEnd },
          endAt: { gt: newStart },
        },
      })
      if (conflict) {
        return res.status(409).json({ error: { code: 'SLOT_CONFLICT', message: 'Seçilen personelin bu saatte başka bir randevusu var.' } })
      }

      const updated = await db.appointment.update({
        where: { id: appointmentId },
        data: { startAt: newStart, endAt: newEnd },
        include: {
          customer: { select: { fullName: true } },
          service: { select: { name: true } },
          staff: { select: { colorCode: true, user: { select: { fullName: true } } } },
        },
      })

      // Eski reminder job'larını sil, yeni zamana göre yeniden planla
      void (async () => {
        try {
          await remindersQueue.remove(`reminder-24h-${appointmentId}`)
          await remindersQueue.remove(`reminder-2h-${appointmentId}`)

          const now = Date.now()
          const startMs = newStart.getTime()
          const delay24h = startMs - 24 * 60 * 60 * 1000 - now
          const delay2h = startMs - 2 * 60 * 60 * 1000 - now

          if (delay24h > 0) {
            await remindersQueue.add(
              'reminder',
              { type: 'reminder_24h', appointmentId },
              { delay: delay24h, jobId: `reminder-24h-${appointmentId}` },
            )
          }
          if (delay2h > 0) {
            await remindersQueue.add(
              'reminder',
              { type: 'reminder_2h', appointmentId },
              { delay: delay2h, jobId: `reminder-2h-${appointmentId}` },
            )
          }
        } catch (err) {
          logger.warn({ err, appointmentId }, 'Reschedule sonrası hatırlatma job güncellenemedi')
        }
      })()

      return res.json({
        id: updated.id,
        referenceCode: updated.referenceCode,
        customerName: updated.customer.fullName,
        serviceName: updated.service.name,
        staffName: updated.staff.user.fullName,
        startTime: updated.startAt.toISOString(),
        endTime: updated.endAt.toISOString(),
        status: updated.status,
        staffColorCode: updated.staff.colorCode,
      })
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
    onboardingCompleted: z.boolean().optional(),
    businessType: z.enum(['barbershop', 'beauty_center', 'nail_studio', 'aesthetic', 'other']).optional(),
    followUpEnabled: z.boolean().optional(),
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

      const { name, onboardingCompleted, ...settingsPatch } = parsed.data
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
          ...(onboardingCompleted !== undefined ? { onboardingCompleted } : {}),
          settings: mergedSettings,
        },
        select: { id: true, name: true, slug: true, settings: true, onboardingCompleted: true },
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

  const followUpEntrySchema = z.object({
    day: z.number().int().min(1).max(365),
    label: z.string().max(100),
  })

  const createServiceSchema = z.object({
    name: z.string().min(1).max(100),
    category: z.string().max(50).optional(),
    durationMinutes: z.number().int().min(5),
    price: z.number().min(0),
    bufferMinutes: z.number().int().min(0).optional().default(0),
    followUpSchedule: z.array(followUpEntrySchema).max(10).optional().nullable(),
  })

  const updateServiceSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    category: z.string().max(50).optional(),
    durationMinutes: z.number().int().min(5).optional(),
    price: z.number().min(0).optional(),
    bufferMinutes: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    isOnlineBookable: z.boolean().optional(),
    followUpSchedule: z.array(followUpEntrySchema).max(10).optional().nullable(),
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

      const { followUpSchedule: fuSchedule, ...serviceData } = parsed.data
      const service = await db.service.create({
        data: {
          ...serviceData,
          tenantId: req.user!.tenantId,
          ...(fuSchedule !== undefined ? { followUpSchedule: fuSchedule ?? Prisma.DbNull } : {}),
        },
        select: { id: true, name: true, durationMinutes: true, price: true, category: true, bufferMinutes: true, isActive: true, followUpSchedule: true },
      })

      return res.status(201).json({ ...service, price: Number(service.price), followUpSchedule: service.followUpSchedule ?? null })
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

      const { followUpSchedule: fuSchedule, ...updateData } = parsed.data
      const updated = await db.service.update({
        where: { id: serviceId },
        data: {
          ...updateData,
          ...(fuSchedule !== undefined ? { followUpSchedule: fuSchedule ?? Prisma.DbNull } : {}),
        },
        select: { id: true, name: true, durationMinutes: true, price: true, category: true, bufferMinutes: true, isActive: true, isOnlineBookable: true, followUpSchedule: true },
      })

      return res.json({ ...updated, price: Number(updated.price), followUpSchedule: updated.followUpSchedule ?? null })
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

  // POST /api/v1/tenants/:slug/finance/close-day?date=YYYY-MM-DD
  router.post('/finance/close-day', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId
      const dateStr = (req.query.date as string | undefined) ?? getIstanbulDateStr()

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz tarih formatı. YYYY-MM-DD bekleniyor.' } })
      }

      const { start: dayStart, end: dayEnd } = toTRBounds(dateStr)
      const expenseDayStart = new Date(`${dateStr}T00:00:00.000Z`)
      const expenseDayEnd = new Date(`${dateStr}T23:59:59.999Z`)

      const [transactions, expenses, staffProfiles] = await Promise.all([
        db.transaction.findMany({
          where: { tenantId, status: 'completed', completedAt: { gte: dayStart, lte: dayEnd } },
          select: {
            id: true,
            grossAmount: true,
            cashAmount: true,
            cardAmount: true,
            paymentMethod: true,
            commissionAmount: true,
            staffId: true,
            completedAt: true,
            notes: true,
            appointment: {
              select: {
                startAt: true,
                customer: { select: { fullName: true } },
                service: { select: { name: true } },
              },
            },
          },
          orderBy: { completedAt: 'asc' },
        }),
        db.expense.findMany({
          where: { tenantId, expenseDate: { gte: expenseDayStart, lte: expenseDayEnd } },
          select: { id: true, title: true, category: true, amount: true },
        }),
        db.staffProfile.findMany({
          where: { tenantId },
          select: { id: true, userId: true },
        }),
      ])

      const userIds = staffProfiles.map((s) => s.userId)
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true },
      })
      const userMap = new Map(users.map((u) => [u.id, u.fullName]))
      const staffMap = new Map(staffProfiles.map((s) => [s.id, userMap.get(s.userId) ?? 'Bilinmiyor']))

      const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.grossAmount), 0)
      const cashRevenue = transactions.reduce((sum, t) => sum + Number(t.cashAmount), 0)
      const cardRevenue = transactions.reduce((sum, t) => sum + Number(t.cardAmount), 0)
      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

      const commissionMap = new Map<string, {
        staffId: string
        staffName: string
        completedCount: number
        grossAmount: number
        commissionAmount: number
      }>()
      for (const t of transactions) {
        if (!t.staffId) continue
        const entry = commissionMap.get(t.staffId) ?? {
          staffId: t.staffId,
          staffName: staffMap.get(t.staffId) ?? 'Bilinmiyor',
          completedCount: 0,
          grossAmount: 0,
          commissionAmount: 0,
        }
        entry.completedCount += 1
        entry.grossAmount += Number(t.grossAmount)
        entry.commissionAmount += Number(t.commissionAmount)
        commissionMap.set(t.staffId, entry)
      }

      return res.json({
        date: dateStr,
        totalRevenue,
        cashRevenue,
        cardRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        transactionCount: transactions.length,
        transactions: transactions.map((t) => ({
          id: t.id,
          time: t.appointment?.startAt.toISOString() ?? t.completedAt?.toISOString() ?? null,
          customerName: t.appointment?.customer.fullName ?? null,
          serviceName: t.appointment?.service.name ?? null,
          amount: Number(t.grossAmount),
          paymentMethod: t.paymentMethod,
          notes: t.notes ?? null,
        })),
        expenses: expenses.map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          amount: Number(e.amount),
        })),
        staffCommissions: [...commissionMap.values()],
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/reports/daily?date=YYYY-MM-DD (single day)
  //   or ?from=YYYY-MM-DD&to=YYYY-MM-DD[&groupBy=day] (date range)
  router.get('/reports/daily', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId
      const today = getIstanbulDateStr()
      const dateParam = req.query.date as string | undefined
      const fromParam = (req.query.from as string | undefined) ?? dateParam ?? today
      const toParam = (req.query.to as string | undefined) ?? dateParam ?? today
      const groupBy = req.query.groupBy as string | undefined

      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromParam) || !/^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz tarih formatı. YYYY-MM-DD bekleniyor.' } })
      }

      if (fromParam > toParam) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'from tarihi to tarihinden büyük olamaz.' } })
      }

      const rangeStart = toTRBounds(fromParam).start
      const rangeEnd = toTRBounds(toParam).end
      const expenseRangeStart = new Date(`${fromParam}T00:00:00.000Z`)
      const expenseRangeEnd = new Date(`${toParam}T23:59:59.999Z`)

      const [transactions, expenses] = await Promise.all([
        db.transaction.findMany({
          where: { tenantId, status: 'completed', completedAt: { gte: rangeStart, lte: rangeEnd } },
          select: {
            id: true,
            grossAmount: true,
            paymentMethod: true,
            cashAmount: true,
            cardAmount: true,
            completedAt: true,
            notes: true,
            appointment: {
              select: {
                startAt: true,
                customer: { select: { fullName: true } },
                service: { select: { name: true, category: true } },
              },
            },
          },
          orderBy: { completedAt: 'asc' },
        }),
        db.expense.findMany({
          where: { tenantId, expenseDate: { gte: expenseRangeStart, lte: expenseRangeEnd } },
          select: { id: true, title: true, category: true, amount: true, expenseDate: true },
        }),
      ])

      const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.grossAmount), 0)
      const cashRevenue = transactions.reduce((sum, t) => sum + Number(t.cashAmount), 0)
      const cardRevenue = transactions.reduce((sum, t) => sum + Number(t.cardAmount), 0)
      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

      const txMapped = transactions.map((t) => ({
        id: t.id,
        time: t.appointment?.startAt.toISOString() ?? t.completedAt?.toISOString() ?? null,
        customerName: t.appointment?.customer.fullName ?? null,
        serviceName: t.appointment?.service.name ?? null,
        serviceCategory: t.appointment?.service.category ?? 'Diğer',
        amount: Number(t.grossAmount),
        paymentMethod: t.paymentMethod,
        notes: t.notes ?? null,
      }))

      const expensesMapped = expenses.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: Number(e.amount),
      }))

      const base = {
        from: fromParam,
        to: toParam,
        totalRevenue,
        cashRevenue,
        cardRevenue,
        completedCount: transactions.length,
        netRevenue: totalRevenue - totalExpenses,
        transactions: txMapped,
        expenses: expensesMapped,
      }

      if (groupBy === 'day') {
        const dayMap = new Map<string, {
          date: string
          revenue: number
          cashRevenue: number
          cardRevenue: number
          completedCount: number
          expenses: number
        }>()

        for (const t of transactions) {
          const key = getIstanbulDateStr(t.completedAt ?? new Date())
          const entry = dayMap.get(key) ?? { date: key, revenue: 0, cashRevenue: 0, cardRevenue: 0, completedCount: 0, expenses: 0 }
          entry.revenue += Number(t.grossAmount)
          entry.cashRevenue += Number(t.cashAmount)
          entry.cardRevenue += Number(t.cardAmount)
          entry.completedCount += 1
          dayMap.set(key, entry)
        }

        for (const e of expenses) {
          const key = getIstanbulDateStr(e.expenseDate)
          const entry = dayMap.get(key) ?? { date: key, revenue: 0, cashRevenue: 0, cardRevenue: 0, completedCount: 0, expenses: 0 }
          entry.expenses += Number(e.amount)
          dayMap.set(key, entry)
        }

        const daily = [...dayMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, v]) => ({ ...v, netRevenue: v.revenue - v.expenses }))

        return res.json({ ...base, daily })
      }

      return res.json(base)
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

      const staffIds = [...new Set(transactions.map((t) => t.staffId).filter((id): id is string => id !== null))]
      const staffProfiles = await db.staffProfile.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, userId: true },
      })
      const userIds = staffProfiles.map((s) => s.userId)
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true },
      })
      const userMap = new Map(users.map((u) => [u.id, u.fullName]))
      const staffMap = new Map(staffProfiles.map((s) => [s.id, userMap.get(s.userId) ?? 'Bilinmiyor']))

      const grouped = new Map<string, { staffName: string; completedCount: number; grossAmount: number; commissionAmount: number }>()
      for (const t of transactions) {
        if (!t.staffId) continue
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

  // ─── Manual Revenues ─────────────────────────────────────────────────────────

  const createRevenueSchema = z.object({
    description: z.string().min(1),
    amount: z.coerce.number().positive(),
    paymentMethod: z.enum(['cash', 'card']),
    revenueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })

  router.post('/revenues', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId

      const parsed = createRevenueSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz veri.' } })
      }

      const { description, amount, paymentMethod, revenueDate } = parsed.data
      const completedAt = new Date(`${revenueDate}T${new Date().toTimeString().slice(0, 8)}`)

      const revenue = await db.transaction.create({
        data: {
          tenantId,
          appointmentId: null,
          staffId: null,
          grossAmount: amount,
          commissionRate: 0,
          commissionAmount: 0,
          paymentMethod,
          cashAmount: paymentMethod === 'cash' ? amount : 0,
          cardAmount: paymentMethod === 'card' ? amount : 0,
          status: 'completed',
          notes: description,
          completedAt,
        },
        select: { id: true, grossAmount: true, paymentMethod: true },
      })

      return res.status(201).json({ id: revenue.id, amount: Number(revenue.grossAmount), paymentMethod: revenue.paymentMethod })
    } catch (err) {
      next(err)
    }
  })

  // ─── Expenses CRUD ────────────────────────────────────────────────────────────

  const createExpenseSchema = z.object({
    title: z.string().min(1),
    category: z.string().min(1),
    amount: z.coerce.number().positive(),
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })

  router.post('/expenses', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'owner') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const parsed = createExpenseSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz gider verisi.' } })
      }

      const { title, category, amount, expenseDate } = parsed.data
      const expense = await db.expense.create({
        data: {
          tenantId: req.user!.tenantId,
          title,
          category,
          amount,
          expenseDate: new Date(`${expenseDate}T00:00:00.000Z`),
        },
        select: { id: true, title: true, category: true, amount: true, expenseDate: true },
      })

      return res.status(201).json({
        id: expense.id,
        title: expense.title,
        category: expense.category,
        amount: Number(expense.amount),
        expenseDate: expense.expenseDate.toISOString().split('T')[0],
      })
    } catch (err) {
      next(err)
    }
  })

  router.delete('/expenses/:expenseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'owner') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      const { expenseId } = req.params
      const tenantId = req.user!.tenantId

      const existing = await db.expense.findFirst({ where: { id: expenseId, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Gider bulunamadı.' } })
      }

      await db.expense.delete({ where: { id: expenseId } })

      return res.status(204).send()
    } catch (err) {
      next(err)
    }
  })

  // ─── Staff Skills (StaffServiceAssignment) ───────────────────────────────────

  const assignServiceSchema = z.object({
    serviceId: z.string().uuid(),
    commissionType: z.enum(['percentage', 'fixed']).default('percentage'),
    commissionValue: z.coerce.number().min(0).default(0),
    priceOverride: z.coerce.number().positive().optional(),
  })

  router.get('/staff/:staffId/services', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { staffId } = req.params
      const tenantId = req.user!.tenantId
      const assignments = await db.staffServiceAssignment.findMany({
        where: { staffId, tenantId, isActive: true },
        include: { service: { select: { id: true, name: true, category: true, durationMinutes: true, price: true } } },
      })
      return res.json({
        data: assignments.map((a) => ({
          id: a.id,
          serviceId: a.serviceId,
          serviceName: a.service.name,
          serviceCategory: a.service.category,
          durationMinutes: a.service.durationMinutes,
          basePrice: Number(a.service.price),
          priceOverride: a.priceOverride ? Number(a.priceOverride) : null,
          commissionType: a.commissionType,
          commissionValue: Number(a.commissionValue),
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  router.post('/staff/:staffId/services', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'owner') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const { staffId } = req.params
      const tenantId = req.user!.tenantId
      const parsed = assignServiceSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz veri.' } })
      }
      const result = await db.staffServiceAssignment.upsert({
        where: { staffId_serviceId: { staffId, serviceId: parsed.data.serviceId } },
        create: { staffId, tenantId, ...parsed.data, isActive: true },
        update: { ...parsed.data, isActive: true },
      })
      return res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  })

  router.delete('/staff/:staffId/services/:serviceId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'owner') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const { staffId, serviceId } = req.params
      await db.staffServiceAssignment.updateMany({
        where: { staffId, serviceId, tenantId: req.user!.tenantId },
        data: { isActive: false },
      })
      return res.status(204).send()
    } catch (err) {
      next(err)
    }
  })

  // ─── Staff Leaves (StaffLeave) ────────────────────────────────────────────────

  const createLeaveSchema = z.object({
    leaveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    leaveType: z.enum(['day_off', 'sick_leave', 'vacation', 'other']).default('day_off'),
    note: z.string().optional(),
  })

  router.get('/staff/:staffId/leaves', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId
      const leaves = await db.staffLeave.findMany({
        where: { staffId: req.params.staffId, tenantId },
        orderBy: { leaveDate: 'asc' },
      })
      return res.json({ data: leaves })
    } catch (err) {
      next(err)
    }
  })

  router.post('/staff/:staffId/leaves', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'owner') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const parsed = createLeaveSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz veri.' } })
      }
      const leave = await db.staffLeave.create({
        data: {
          staffId: req.params.staffId,
          tenantId: req.user!.tenantId,
          leaveDate: new Date(`${parsed.data.leaveDate}T00:00:00.000Z`),
          leaveType: parsed.data.leaveType,
          note: parsed.data.note,
        },
      })
      return res.status(201).json(leave)
    } catch (err) {
      next(err)
    }
  })

  router.delete('/staff/:staffId/leaves/:leaveId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'owner') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const { leaveId } = req.params
      const tenantId = req.user!.tenantId
      const existing = await db.staffLeave.findFirst({ where: { id: leaveId, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'İzin kaydı bulunamadı.' } })
      }
      await db.staffLeave.delete({ where: { id: leaveId } })
      return res.status(204).send()
    } catch (err) {
      next(err)
    }
  })

  return router
}
