import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, BusinessType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { db } from '../lib/db'
import { logger } from '../lib/logger'
import { remindersQueue } from '../lib/queue'
import { authenticateJWT, requireTenantAccess, checkTenantActive } from '../middleware/auth.middleware'
import { TelegramChannel } from '../channels/telegram.channel'
import { getSlots } from '../lib/slots'
import { isValidModuleKey } from '../lib/modules'
import { can, termOverrideKeyAllowed, validateTermOverrides } from '@beautyos/shared'
import { requirePermission, ensurePermission } from '../middleware/permission'
import { TERM_SETS } from '../lib/me-profile'
import { customerAccessFilter, ownCustomerWhere, ownStaffProfileId } from '../lib/customer-scope'
import { phoneInUse } from '../lib/customer-phone'
import { normalizePhoneTR } from '../lib/sms/types'
import { revokeUserSessions } from '../lib/sessions'
import { maskPhone, escapeLike, STAFF_SEARCH_MIN_LENGTH, STAFF_SEARCH_MAX_RESULTS } from '../lib/customer-privacy'
import { SLOT_TAKEN_BODY, isSlotOverlapError, respondSlotTakenOr } from '../lib/slot-conflict'
import { normalizeEmail } from '../lib/credentials'
import { istanbulDayRange } from '../lib/time'
import { strongPassword } from '../lib/password-policy'

const XSS_PATTERN = /<[^>]*>|javascript:/i

function noXss(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .refine((v) => !XSS_PATTERN.test(v), { message: 'Geçersiz karakter içeriyor.' })
}

function httpsOnlyUrl() {
  return z
    .string()
    .trim()
    .max(500)
    .url()
    .refine((v) => /^https?:\/\//i.test(v), { message: 'Yalnızca http(s) URL kabul edilir.' })
}

// Salon settings.workingHours hem eski string ("09:00-19:00") hem yeni JSON formatını destekler.
// Yeni personel oluştururken bu helper personelin default workingHours'unu üretir.
type DaySchedule = { start: string; end: string } | null
type WorkingHoursMap = { monday: DaySchedule; tuesday: DaySchedule; wednesday: DaySchedule; thursday: DaySchedule; friday: DaySchedule; saturday: DaySchedule; sunday: DaySchedule }

function resolveTenantWorkingHours(value: unknown): WorkingHoursMap {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    if ('monday' in obj || 'sunday' in obj) {
      const days: Array<keyof WorkingHoursMap> = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      const result = {} as WorkingHoursMap
      for (const day of days) {
        const v = obj[day]
        if (v && typeof v === 'object' && 'start' in v && 'end' in v) {
          result[day] = { start: String((v as { start: string }).start), end: String((v as { end: string }).end) }
        } else {
          result[day] = null
        }
      }
      return result
    }
  }
  if (typeof value === 'string') {
    const m = value.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/)
    if (m) {
      const s = { start: m[1], end: m[2] }
      return { monday: s, tuesday: s, wednesday: s, thursday: s, friday: s, saturday: s, sunday: null }
    }
  }
  const def = { start: '09:00', end: '19:00' }
  return { monday: def, tuesday: def, wednesday: def, thursday: def, friday: def, saturday: def, sunday: null }
}

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
  router.use(checkTenantActive)

  const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: (req) => req.tenantId ?? 'unknown',
    skip: (req) => !req.query.search,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Arama limiti aşıldı. 1 dakika sonra tekrar deneyin.' } },
  })

  const appointmentCreateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.tenantId ?? 'unknown',
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Randevu oluşturma limiti aşıldı. 1 dakika sonra tekrar deneyin.' } },
  })

  // GET /api/v1/tenants/:slug/dashboard?period=today|week|month
  router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
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

      // Ciro yalnizca izinli rollere doner (matris 2); uzman icin alan yanitta hic yer almaz.
      const showRevenue = can(req.user!.role, 'dashboard.revenue')

      return res.json({
        period,
        ...(showRevenue ? { todayRevenue: currentRevenue, revenueChange } : {}),
        todayAppointmentCount: currentAppointments,
        totalCustomers,
        occupancyRate,
        appointmentChange,
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/slots — Authenticated slot lookup for salon admin
  // Salon admin'in randevu oluşturma akışı için. publicBookingEnabled flag'inden bağımsız çalışır.
  router.get('/slots', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slotsQuerySchema = z.object({
        serviceId: z.string().uuid(),
        staffId: z.union([z.string().uuid(), z.literal('any')]),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      const parsed = slotsQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'serviceId, staffId ve date (YYYY-MM-DD) zorunludur.' } })
      }
      const { serviceId, staffId, date } = parsed.data
      const tenantId = req.tenantId!

      if (staffId !== 'any') {
        const slots = await getSlots({ tenantId, serviceId, staffId, date })
        return res.json({ date, slots: slots.map((s) => ({ ...s, staffId })) })
      }

      const staffList = await db.staffProfile.findMany({
        where: {
          tenantId,
          serviceAssignments: { some: { serviceId, isActive: true } },
        },
        select: { id: true },
      })

      const allResults = await Promise.all(
        staffList.map(async (sp) => {
          const slots = await getSlots({ tenantId, serviceId, staffId: sp.id, date })
          return slots.map((s) => ({ ...s, staffId: sp.id }))
        }),
      )

      const byTime = new Map<string, { id: string; label: string; available: boolean; staffId: string }>()
      for (const list of allResults) {
        for (const slot of list) {
          const existing = byTime.get(slot.id)
          if (!existing || (!existing.available && slot.available)) {
            byTime.set(slot.id, slot)
          }
        }
      }

      const merged = Array.from(byTime.values()).sort((a, b) => a.id.localeCompare(b.id))
      return res.json({ date, slots: merged })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/appointments?date=YYYY-MM-DD&limit=10&staffId=UUID&serviceId=UUID&status=...&search=TEXT
  router.get('/appointments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!

      const querySchema = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.preprocess(
          (v) => (v === undefined || v === '' ? 10 : Number(v)),
          z.number().int().min(1).max(100),
        ),
        staffId: z.string().uuid().optional(),
        serviceId: z.string().uuid().optional(),
        status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
        statusIn: z.string().optional(),
        search: z.string().min(2).optional(),
      })

      const parsed = querySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz sorgu parametresi.' } })
      }

      const { date, dateFrom, dateTo, limit, staffId, serviceId, status, statusIn, search } = parsed.data

      // Gün sınırları Europe/Istanbul gününe göredir (A4). Aralıkta (date, dateFrom/dateTo) satır sınırı yoktur; en çok 31 gün.
      let dateFilter = {}
      let hasDateRange = false
      // Yalnız biri verilirse (dateFrom ya da dateTo) o tek gün sayılır; açık uçlu aralık yoktur.
      const rangeFrom = dateFrom ?? date ?? dateTo
      const rangeTo = dateTo ?? date ?? dateFrom
      if (rangeFrom && rangeTo) {
        const range = istanbulDayRange(rangeFrom, rangeTo)
        if (!range.ok) {
          const message = range.reason === 'RANGE_TOO_LARGE' ? 'Tarih aralığı en çok 31 gün olabilir.' : 'Geçersiz tarih aralığı.'
          return res.status(400).json({ error: { code: range.reason, message } })
        }
        dateFilter = { startAt: { gte: range.gte, lt: range.lt } }
        hasDateRange = true
      }

      const VALID_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'] as const
      const statusInArr = statusIn?.split(',').map((s) => s.trim()).filter((s): s is typeof VALID_STATUSES[number] => VALID_STATUSES.includes(s as never))
      const statusFilter = status
        ? { status }
        : statusInArr && statusInArr.length > 0
          ? { status: { in: statusInArr } }
          : {}

      // Staff sadece kendi randevularını görebilir
      let staffFilter: { staffId?: string } = {}
      if (req.user!.role === 'staff') {
        const myProfile = await db.staffProfile.findFirst({
          where: { tenantId, userId: req.user!.userId },
          select: { id: true },
        })
        if (!myProfile) {
          return res.json({ data: [] })
        }
        staffFilter = { staffId: myProfile.id }
      } else if (staffId) {
        staffFilter = { staffId }
      }

      const appointments = await db.appointment.findMany({
        where: {
          tenantId,
          isDeleted: false,
          ...dateFilter,
          ...staffFilter,
          ...(serviceId ? { serviceId } : {}),
          ...statusFilter,
          ...(search
            ? {
                OR: [
                  { customer: { fullName: { contains: search, mode: 'insensitive' as const } } },
                  { requestedName: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        ...(hasDateRange ? {} : { take: limit }),
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
          customerId: a.customerId,
          serviceId: a.serviceId,
          staffId: a.staffId,
          durationMinutes: Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60000),
          customerName: a.customer?.fullName ?? a.requestedName ?? '',
          customerPhone: a.customer?.phone ?? a.requestedPhone ?? '',
          unverified: a.customer === null,
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

  async function respondStaffCustomerSearch(req: Request, res: Response, rawSearch: string | undefined) {
    const tenantId = req.tenantId!
    const term = rawSearch?.trim() ?? ''
    if (term.length < STAFF_SEARCH_MIN_LENGTH) {
      return res.status(400).json({
        error: { code: 'SEARCH_REQUIRED', message: `Müşteri aramak için en az ${STAFF_SEARCH_MIN_LENGTH} karakter yazın.` },
      })
    }
    const profileId = await ownStaffProfileId(req)
    if (!profileId) return res.json({ data: [], nextCursor: null })

    // Telefon yalniz kendi musterilerinde aranir: baska musterinin numarasi rakam rakam sorgulanarak cikarilamaz.
    const own = ownCustomerWhere(tenantId, profileId)
    const pattern = escapeLike(term)
    const rows = await db.customer.findMany({
      where: {
        tenantId,
        OR: [
          { fullName: { contains: pattern, mode: 'insensitive' as const } },
          { AND: [own, { phone: { contains: pattern, mode: 'insensitive' as const } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: STAFF_SEARCH_MAX_RESULTS,
      select: { id: true, fullName: true, phone: true, email: true, totalVisits: true, lastVisitAt: true, createdAt: true },
    })
    const ownRows = rows.length
      ? await db.customer.findMany({ where: { tenantId, id: { in: rows.map((r) => r.id) }, ...own }, select: { id: true } })
      : []
    const ownIds = new Set(ownRows.map((r) => r.id))

    return res.json({
      data: rows.map((c) => {
        const isOwn = ownIds.has(c.id)
        return {
          id: c.id,
          fullName: c.fullName,
          phone: isOwn ? c.phone : maskPhone(c.phone),
          phoneMasked: !isOwn,
          isOwn,
          email: isOwn ? c.email : null,
          totalVisits: isOwn ? c.totalVisits : null,
          lastVisitDate: isOwn ? (c.lastVisitAt?.toISOString() ?? null) : null,
          createdAt: c.createdAt.toISOString(),
        }
      }),
      nextCursor: null,
    })
  }

  // GET /api/v1/tenants/:slug/customers?search=TEXT&cursor=ID&limit=20
  router.get('/customers', searchLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!

      const querySchema = z.object({
        search: z.string().min(2).optional(),
        cursor: z.string().uuid().optional(),
        limit: z.preprocess(
          (v) => (v === undefined || v === '' ? 50 : Number(v)),
          z.number().int().min(1).max(200),
        ),
      })

      const parsed = querySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz sorgu parametresi.' } })
      }

      const { search, cursor, limit } = parsed.data

      // R4: uzman icin liste yok; yalniz arama kipi (>=3 karakter, <=10 sonuc, maskeli telefon).
      if (!can(req.user?.role, 'customer.view_all')) {
        return respondStaffCustomerSearch(req, res, search)
      }

      const searchFilter = search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}

      const accessFilter = await customerAccessFilter(req)
      if (accessFilter === null) {
        return res.json({ data: [], nextCursor: null })
      }

      const customers = await db.customer.findMany({
        where: { tenantId, ...accessFilter, ...searchFilter },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
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

      const hasMore = customers.length > limit
      const page = hasMore ? customers.slice(0, limit) : customers
      const nextCursor = hasMore ? page[page.length - 1].id : null

      return res.json({
        data: page.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          phone: c.phone,
          email: c.email,
          totalVisits: c.totalVisits,
          lastVisitDate: c.lastVisitAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
        })),
        nextCursor,
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/services
  router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!

      const onlineOnly = req.query.onlineOnly === 'true'
      const includeInactive = req.query.includeInactive === 'true'
      const services = await db.service.findMany({
        where: {
          tenantId,
          ...(includeInactive ? {} : { isActive: true }),
          ...(onlineOnly ? { isOnlineBookable: true } : {}),
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, durationMinutes: true, price: true, category: true, isActive: true, isOnlineBookable: true, followUpSchedule: true },
      })

      return res.json({
        data: services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.durationMinutes,
          price: Number(s.price),
          category: s.category,
          isActive: s.isActive,
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
      const tenantId = req.tenantId!

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
    startAt: z.string().trim().min(1),
    notes: noXss(500).optional(),
  })

  router.post('/appointments', appointmentCreateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!

      const parsed = createAppointmentSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz randevu verisi.' } })
      }

      const { customerId, serviceId, staffId, startAt, notes } = parsed.data

      // customerId gövdeden gelir: çağıran kiracıya ait olmalı (aksi halde başka kiracının müşteri verisi okunur/yazılır).
      const customer = await db.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } })
      if (!customer) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

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
        return res.status(409).json(SLOT_TAKEN_BODY)
      }

      // Ön kontrol yarışa açıktır; asıl koruma veritabanı kısıtıdır (S3).
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
        customerName: appointment.customer?.fullName ?? '',
        serviceName: appointment.service.name,
        staffName: appointment.staff.user.fullName,
        startTime: appointment.startAt.toISOString(),
        endTime: appointment.endAt.toISOString(),
        status: appointment.status,
        staffColorCode: appointment.staff.colorCode,
      })
    } catch (err) {
      respondSlotTakenOr(err, res, next)
    }
  })

  // POST /api/v1/tenants/:slug/customers
  const createCustomerSchema = z.object({
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(7).max(20),
    email: z.string().trim().email().optional(),
    birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    // ADR-0038: ayni telefon bilincli olarak paylasilabilir (aile). Bayrak yoksa eski 409 davranisi.
    allowSharedPhone: z.boolean().optional(),
  })

  router.post('/customers', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!

      const parsed = createCustomerSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz müşteri verisi.' } })
      }

      const { fullName, email, birthDate, allowSharedPhone } = parsed.data
      // Telefon her yerde normalize saklanır (ADR-0038); biçimi tanınmayan numara reddedilir.
      const phone = normalizePhoneTR(parsed.data.phone)
      if (!phone) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçerli bir telefon numarası girin.' } })
      }

      if (!allowSharedPhone && (await phoneInUse(db, tenantId, phone))) {
        return res.status(409).json({ error: { code: 'DUPLICATE_PHONE', message: 'Bu telefon numarasıyla kayıtlı müşteri zaten var.' } })
      }

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
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/settings
  router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!

      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, settings: true, onboardingCompleted: true, plan: true, trialEndsAt: true, isActive: true, businessType: true },
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
      const tenantId = req.tenantId!
      const { customerId } = req.params

      const accessFilter = await customerAccessFilter(req)
      if (accessFilter === null) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      const customer = await db.customer.findFirst({
        where: { id: customerId, tenantId, ...accessFilter },
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
          phoneVerifiedAt: true,
          marketingConsentSms: true,
          marketingConsentEmail: true,
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
        // Alerji notu sağlık verisidir (R9): yalnız health.view izni olan rol görür.
        ...(can(req.user!.role, 'health.view') ? { allergyNotes: customer.allergyNotes } : {}),
        preferenceNotes: customer.preferenceNotes,
        totalVisits: customer.totalVisits,
        lifetimeValue: Number(customer.lifetimeValue),
        segment: customer.segment,
        lastVisitAt: customer.lastVisitAt?.toISOString() ?? null,
        phoneVerifiedAt: customer.phoneVerifiedAt?.toISOString() ?? null,
        marketingConsentSms: customer.marketingConsentSms,
        marketingConsentEmail: customer.marketingConsentEmail,
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
    cancellationReason: noXss(500).optional(),
    priceCharged: z.number().positive().optional(),
    paymentMethod: z.enum(['cash', 'card']).optional(),
  })

  router.patch('/appointments/:appointmentId/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const { appointmentId } = req.params

      const parsed = appointmentStatusSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz durum değeri.' } })
      }

      const { status, cancellationReason } = parsed.data
      // R3: uzman fiyati degistiremez; gonderirse sessizce yok sayilir (randevu fiyati gecerli).
      const priceOverride = req.user!.role === 'staff' ? undefined : parsed.data.priceCharged

      const existing = await db.appointment.findFirst({ where: { id: appointmentId, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
      }

      // Staff sadece kendi randevularının durumunu değiştirebilir
      if (req.user!.role === 'staff') {
        const myProfile = await db.staffProfile.findFirst({
          where: { tenantId, userId: req.user!.userId },
          select: { id: true },
        })
        if (!myProfile || myProfile.id !== existing.staffId) {
          return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu randevuyu değiştirme yetkiniz yok.' } })
        }
      }

      const TERMINAL_STATUSES = ['completed', 'cancelled', 'no_show']
      if (TERMINAL_STATUSES.includes(existing.status)) {
        return res.status(409).json({
          error: { code: 'STATUS_LOCKED', message: 'Tamamlanan veya iptal edilen randevunun durumu değiştirilemez.' },
        })
      }

      // Müşterisi henüz eşleşmemiş (doğrulanmamış) online talep: onay/ret yalnız appointment.approve ile ve yeni onay ucundan
      // (müşteri eşleştirmesiyle) yapılır. Eski uçtan yalnız iptal / gelmedi, o da yetkiliyle; aday müşteri adları bu uçta dönmez.
      if (!existing.customerId) {
        if (!can(req.user!.role, 'appointment.approve')) {
          return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
        }
        if (status !== 'cancelled' && status !== 'no_show') {
          return res.status(409).json({ error: { code: 'CUSTOMER_MATCH_REQUIRED', message: 'Bu talep müşteri eşleştirmesiyle onaylanmalı; onay ekranını kullanın.' } })
        }
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
          const gross = priceOverride ?? Number(appt.priceCharged)
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
          if (priceOverride) {
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
            const durationMs = appt.service.durationMinutes * 60 * 1000
            const originalStart = new Date(appt.startAt)

            for (const entry of schedule as Array<{ day: number; label: string }>) {
              // Same time-of-day as original appointment, N days later
              let fuStart = new Date(originalStart.getTime() + entry.day * 24 * 60 * 60 * 1000)

              // Boş ilk saati bul ve oluştur; ön kontrol ile oluşturma arasında saat dolarsa (veritabanı kısıtı, S3) sonraki boşluğa geç.
              let fuAppt: { id: string } | null = null
              for (let attempts = 0; attempts < 24 && !fuAppt; attempts++) {
                const fuEnd = new Date(fuStart.getTime() + durationMs)
                const conflict = await db.appointment.findFirst({
                  where: {
                    tenantId,
                    staffId: appt.staffId,
                    status: { notIn: ['cancelled', 'no_show'] },
                    isDeleted: false,
                    startAt: { lt: fuEnd },
                    endAt: { gt: fuStart },
                  },
                  orderBy: { endAt: 'asc' },
                })
                if (conflict) {
                  fuStart = new Date(conflict.endAt)
                  continue
                }
                try {
                  fuAppt = await db.appointment.create({
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
                    select: { id: true },
                  })
                } catch (err) {
                  if (!isSlotOverlapError(err)) throw err
                }
              }
              if (!fuAppt) continue
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
                  if (appt.customer) await channel.sendText(appt.customer.phone, text)
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
      if (!ensurePermission(req, res, 'appointment.reschedule')) return

      const tenantId = req.tenantId!
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
        return res.status(409).json(SLOT_TAKEN_BODY)
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
        customerName: updated.customer?.fullName ?? updated.requestedName ?? '',
        serviceName: updated.service.name,
        staffName: updated.staff.user.fullName,
        startTime: updated.startAt.toISOString(),
        endTime: updated.endAt.toISOString(),
        status: updated.status,
        staffColorCode: updated.staff.colorCode,
      })
    } catch (err) {
      respondSlotTakenOr(err, res, next)
    }
  })

  // DELETE /api/v1/tenants/:slug/appointments/:appointmentId
  router.delete('/appointments/:appointmentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (role !== 'owner' && role !== 'manager') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Randevu silme yetkisi yok.' } })
      }

      const tenantId = req.tenantId!
      const { appointmentId } = req.params

      const existing = await db.appointment.findFirst({ where: { id: appointmentId, tenantId, isDeleted: false } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
      }

      const TERMINAL_STATUSES = ['completed', 'no_show']
      if (TERMINAL_STATUSES.includes(existing.status)) {
        return res.status(409).json({ error: { code: 'APPOINTMENT_LOCKED', message: 'Tamamlanan veya gelmedi işaretli randevu silinemez.' } })
      }

      await db.appointment.update({ where: { id: appointmentId }, data: { isDeleted: true } })

      return res.status(204).send()
    } catch (err) {
      next(err)
    }
  })

  // PATCH /api/v1/tenants/:slug/appointments/:appointmentId
  const updateAppointmentSchema = z.object({
    notes: noXss(500).nullable().optional(),
  })

  router.patch('/appointments/:appointmentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const { appointmentId } = req.params
      const role = req.user!.role

      const parsed = updateAppointmentSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz randevu verisi.' } })
      }

      const existing = await db.appointment.findFirst({ where: { id: appointmentId, tenantId, isDeleted: false } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
      }

      if (role === 'staff') {
        const staffProfile = await db.staffProfile.findFirst({ where: { userId: req.user!.userId, tenantId } })
        if (!staffProfile || staffProfile.id !== existing.staffId) {
          return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Sadece kendi randevunuzu güncelleyebilirsiniz.' } })
        }
      }

      const { notes } = parsed.data
      const updated = await db.appointment.update({
        where: { id: appointmentId },
        data: { ...(notes !== undefined ? { notes } : {}) },
        select: { id: true, notes: true },
      })

      return res.json(updated)
    } catch (err) {
      next(err)
    }
  })

  // PATCH /api/v1/tenants/:slug/settings
  const settingsSchema = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    address: z.string().trim().min(5).max(255).optional(),
    workingHours: z.union([
      z.string().trim().min(1).max(200),
      z.record(z.string(), z.object({ start: z.string(), end: z.string() }).nullable()),
    ]).optional(),
    onboardingCompleted: z.boolean().optional(),
    businessType: z.nativeEnum(BusinessType).optional(),
    followUpEnabled: z.boolean().optional(),
    botIntro: z.string().trim().max(500).optional(),
    botTone: z.enum(['formal', 'friendly', 'energetic']).optional(),
    botRules: z.string().trim().max(1000).optional(),
    botFaqs: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).max(20).optional(),
    botHidePrices: z.boolean().optional(),
    publicBookingEnabled: z.boolean().optional(),
    // A5 / ADR-0031: terim seti ve özelleştirmeler. Yalnız sahip yazar; değerler arayüzde metin olarak çizildiği için işaretleme reddedilir.
    termSet: z.enum(TERM_SETS).optional(),
    termOverrides: z
      .record(
        z.string().max(40),
        z.string().trim().min(1).max(60).refine((v) => !/[<>]/.test(v), { message: 'Geçersiz karakter içeriyor.' }),
      )
      .refine((o) => Object.keys(o).length <= 30, { message: 'En çok 30 terim.' })
      .refine((o) => validateTermOverrides(o) === null, { message: 'Terim anahtarı geçersiz ya da beş biçim eksik.' })
      .optional(),
    onlineBookingApproval: z.enum(['auto', 'manual']).optional(),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Geçerli bir hex renk (ör. #6B48FF)').optional(),
    logoUrl: httpsOnlyUrl().optional().or(z.literal('')),
    coverUrl: httpsOnlyUrl().optional().or(z.literal('')),
    whatsappNumber: z.string().trim().min(7).max(20).optional().or(z.literal('')),
    mapsUrl: httpsOnlyUrl().optional().or(z.literal('')),
    aboutText: noXss(500).optional().or(z.literal('')),
    activeModules: z
      .array(z.string().trim().min(1).max(50))
      .max(50)
      .refine((arr) => arr.every((k) => isValidModuleKey(k)), {
        message: 'Geçersiz modül anahtarı.',
      })
      .optional(),
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

      // activeModules (R7), businessType (klinik KVKK korumalarını belirler) ve terim ayarları (A5) yalnız sahibe aittir.
      // Rol adı kasıtlı: bu alanlar için izin anahtarı yok; izin tablosu başka dalda değişiyor.
      if (role !== 'owner' && (parsed.data.activeModules !== undefined || parsed.data.businessType !== undefined || parsed.data.termSet !== undefined || parsed.data.termOverrides !== undefined)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu ayarı yalnızca salon sahibi değiştirebilir.' } })
      }

      const { name, onboardingCompleted, businessType, ...settingsPatch } = parsed.data
      const tenantId = req.tenantId!

      const existing = await db.tenant.findUnique({ where: { id: tenantId }, select: { settings: true, businessType: true } })
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
          ...(businessType ? { businessType } : {}),
          settings: mergedSettings,
        },
        select: { id: true, name: true, slug: true, settings: true, onboardingCompleted: true, businessType: true },
      })

      // BusinessType değiştiyse ve henüz hiç anamnez sorusu yoksa, yeni kategoriye göre seed et
      if (businessType && businessType !== existing.businessType) {
        try {
          const { seedDefaultAnamnesisQuestions } = await import('../lib/anamnesis-seeder')
          await seedDefaultAnamnesisQuestions(tenantId, businessType)
        } catch (e) {
          console.error('seedDefaultAnamnesisQuestions failed:', (e as Error).message)
        }
      }

      return res.json(updated)
    } catch (err) {
      next(err)
    }
  })

  // PATCH /api/v1/tenants/:slug/users/:userId/password
  const passwordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: strongPassword,
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

      const newHash = await bcrypt.hash(newPassword, 12)
      await db.user.update({ where: { id: userId }, data: { passwordHash: newHash } })
      // Şifre değişince kullanıcının tüm oturumları kapanır (S6 K2).
      await revokeUserSessions(userId)

      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  // ─── Services CRUD ────────────────────────────────────────────────────────────

  const followUpEntrySchema = z.object({
    day: z.number().int().min(1).max(365),
    label: z.string().trim().max(100),
  })

  const createServiceSchema = z.object({
    name: z.string().trim().min(1).max(100),
    category: z.string().trim().max(50).optional(),
    durationMinutes: z.number().int().min(5),
    price: z.number().min(0),
    bufferMinutes: z.number().int().min(0).optional().default(0),
    followUpSchedule: z.array(followUpEntrySchema).max(10).optional().nullable(),
  })

  const updateServiceSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().max(50).optional(),
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
          tenantId: req.tenantId!,
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
      const tenantId = req.tenantId!

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
      const tenantId = req.tenantId!

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
    email: z.string().trim().email().transform(normalizeEmail),
    password: strongPassword,
    fullName: z.string().trim().min(2).max(100),
    title: z.string().trim().min(1).max(100),
    bio: z.string().trim().max(500).optional(),
    colorCode: z.number().int().optional(),
    // Rol atamak yalnız sahibin işi (A2); verilmezse uzman.
    role: z.enum(['staff', 'manager', 'receptionist']).default('staff'),
  })

  const updateStaffSchema = z.object({
    title: z.string().trim().min(1).max(100).optional(),
    bio: z.string().trim().max(500).optional(),
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

      const { email, password, fullName, title, bio, colorCode, role: newRole } = parsed.data
      const tenantId = req.tenantId!
      if (newRole !== 'staff' && role !== 'owner') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Rol yalnızca salon sahibi tarafından atanabilir.' } })
      }

      // Küresel kontrol: giriş e-postayla yapılır; başka kiracıdaki aynı adres hesap karışmasına yol açar. E-posta küçük harfe normalize edilmiş, tam eşitlikle aranır.
      const existingUser = await db.user.findFirst({ where: { email }, select: { id: true } })
      if (existingUser) {
        return res.status(409).json({ error: { code: 'DUPLICATE_EMAIL', message: 'Bu e-posta adresiyle kayıtlı kullanıcı zaten var.' } })
      }

      const passwordHash = await bcrypt.hash(password, 12)

      const tenantSettings = await db.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } })
      const settingsObj = tenantSettings?.settings as { workingHours?: unknown } | null
      const defaultWorkingHours = resolveTenantWorkingHours(settingsObj?.workingHours)

      // Müdür ve resepsiyon takvimde randevu alan uzman değildir: uzman profili yalnız 'staff' rolüne açılır.
      if (newRole !== 'staff') {
        const user = await db.user.create({
          data: { tenantId, email, passwordHash, fullName, role: newRole },
          select: { id: true, fullName: true, email: true, role: true },
        })
        return res.status(201).json({ id: null, title: null, bio: null, colorCode: null, fullName: user.fullName, email: user.email, userId: user.id, role: user.role })
      }

      const result = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { tenantId, email, passwordHash, fullName, role: 'staff' },
        })
        const staffProfile = await tx.staffProfile.create({
          data: { userId: user.id, tenantId, title, bio, colorCode, workingHours: defaultWorkingHours as Prisma.InputJsonValue },
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
        role: 'staff',
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
      const tenantId = req.tenantId!

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
      const tenantId = req.tenantId!

      const profile = await db.staffProfile.findFirst({
        where: { id: staffId, tenantId },
        select: { userId: true },
      })
      if (!profile) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
      }

      await db.user.update({ where: { id: profile.userId }, data: { isActive: false } })
      // Pasifleştirilen kullanıcının oturumları hemen kapanır (S6 K2).
      await revokeUserSessions(profile.userId)

      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  // ─── Customer PATCH ────────────────────────────────────────────────────────────

  const updateCustomerSchema = z.object({
    fullName: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    email: z.string().trim().email().optional().nullable(),
    birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    allergyNotes: noXss(500).optional().nullable(),
    preferenceNotes: noXss(500).optional().nullable(),
    allowSharedPhone: z.boolean().optional(),
  })

  router.patch('/customers/:customerId', requirePermission('customer.write'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { customerId } = req.params
      const tenantId = req.tenantId!

      const parsed = updateCustomerSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz müşteri verisi.' } })
      }

      const existing = await db.customer.findFirst({ where: { id: customerId, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      const { birthDate, allowSharedPhone, ...rest } = parsed.data
      // Sağlık verisi (alerji notu) yalnız health.write ile yazılır (R9).
      if (rest.allergyNotes !== undefined && !can(req.user!.role, 'health.write')) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }

      // Telefon her yerde normalize saklanır (ADR-0038); biçimi tanınmayan numara reddedilir.
      // Telefon değişmiyorsa (Telegram sohbet no, sabit hat gibi normalize edilemeyen mevcut kayıtlar dahil) doğrulama ve yazma yok.
      if (rest.phone !== undefined && rest.phone === existing.phone) {
        delete rest.phone
      }
      if (rest.phone !== undefined) {
        const normalized = normalizePhoneTR(rest.phone)
        if (!normalized) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçerli bir telefon numarası girin.' } })
        }
        rest.phone = normalized === existing.phone ? undefined : normalized
      }

      if (rest.phone !== undefined && rest.phone !== existing.phone && !allowSharedPhone && (await phoneInUse(db, tenantId, rest.phone, customerId))) {
        return res.status(409).json({ error: { code: 'DUPLICATE_PHONE', message: 'Bu telefon numarasıyla kayıtlı müşteri zaten var.' } })
      }

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

      const { allergyNotes, ...updatedPublic } = updated
      return res.json({
        ...updatedPublic,
        ...(can(req.user!.role, 'health.view') ? { allergyNotes } : {}),
        birthDate: updated.birthDate?.toISOString() ?? null,
        lastVisitAt: updated.lastVisitAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      })
    } catch (err) {
      next(err)
    }
  })

  // POST /api/v1/tenants/:slug/finance/close-day?date=YYYY-MM-DD
  router.post('/finance/close-day', requirePermission('finance.close_day'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const dateStr = (req.query.date as string | undefined) ?? getIstanbulDateStr()

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz tarih formatı. YYYY-MM-DD bekleniyor.' } })
      }
      // Resepsiyon yalnız bugünü kapatır/görür (matris 36); geçmiş gün dökümü sahip ve müdüre aittir.
      if (dateStr !== getIstanbulDateStr() && !can(req.user!.role, 'finance.report.range')) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
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
          customerName: t.appointment?.customer?.fullName ?? null,
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
        // Prim verisi yalnız prim raporu iznine sahip rollere döner (matris 42); resepsiyon kapanış dökümünde görmez.
        ...(can(req.user!.role, 'finance.report.commissions') ? { staffCommissions: [...commissionMap.values()] } : {}),
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/reports/daily?date=YYYY-MM-DD (single day)
  //   or ?from=YYYY-MM-DD&to=YYYY-MM-DD[&groupBy=day] (date range)
  router.get('/reports/daily', requirePermission('finance.report.daily'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
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

      // Resepsiyon yalnız bugünün kasasını görür (matris 36); geçmiş ve aralık raporu sahip ve müdüre aittir.
      if (!can(req.user!.role, 'finance.report.range') && (fromParam !== today || toParam !== today)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
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
        customerName: t.appointment?.customer?.fullName ?? null,
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
  router.get('/reports/staff-commissions', requirePermission('finance.report.commissions'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
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

      const grouped = new Map<string, { staffName: string; completedAppointments: number; revenue: number; commission: number }>()
      for (const t of transactions) {
        if (!t.staffId) continue
        const entry = grouped.get(t.staffId) ?? {
          staffName: staffMap.get(t.staffId) ?? 'Bilinmiyor',
          completedAppointments: 0,
          revenue: 0,
          commission: 0,
        }
        entry.completedAppointments += 1
        entry.revenue += Number(t.grossAmount)
        entry.commission += Number(t.commissionAmount)
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
    description: z.string().trim().min(1),
    amount: z.coerce.number().positive(),
    paymentMethod: z.enum(['cash', 'card']),
    revenueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  })

  router.post('/revenues', requirePermission('finance.revenue.create'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!

      const parsed = createRevenueSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz veri.' } })
      }

      const { description, amount, paymentMethod, revenueDate } = parsed.data
      // Kapanmış güne gelir yazmak gün sonu sayımını bozar: resepsiyon yalnız bugüne yazar (matris 38).
      if (revenueDate !== getIstanbulDateStr() && !can(req.user!.role, 'finance.report.range')) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      }
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
    title: z.string().trim().min(1),
    category: z.string().trim().min(1),
    amount: z.coerce.number().positive(),
    expenseDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
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
          tenantId: req.tenantId!,
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
      const tenantId = req.tenantId!

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
      const tenantId = req.tenantId!
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
      const tenantId = req.tenantId!
      const parsed = assignServiceSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz veri.' } })
      }
      // staffId yoldan, serviceId gövdeden gelir: ikisi de çağıran kiracıya ait olmalı. upsert'in update dalı
      // başka kiracının atamasını da değiştirebileceğinden doğrulama olmadan çağrılmaz.
      const [staffInTenant, serviceInTenant] = await Promise.all([
        db.staffProfile.findFirst({ where: { id: staffId, tenantId }, select: { id: true } }),
        db.service.findFirst({ where: { id: parsed.data.serviceId, tenantId }, select: { id: true } }),
      ])
      if (!staffInTenant) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
      }
      if (!serviceInTenant) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
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
        where: { staffId, serviceId, tenantId: req.tenantId! },
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
      const tenantId = req.tenantId!
      const role = req.user!.role
      // Staff sadece kendi izinlerini görebilir
      if (role === 'staff') {
        const myProfile = await db.staffProfile.findFirst({
          where: { tenantId, userId: req.user!.userId },
          select: { id: true },
        })
        if (!myProfile || myProfile.id !== req.params.staffId) {
          return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
        }
      }
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
      const staffInTenant = await db.staffProfile.findFirst({ where: { id: req.params.staffId, tenantId: req.tenantId! }, select: { id: true } })
      if (!staffInTenant) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
      }
      const leave = await db.staffLeave.create({
        data: {
          staffId: req.params.staffId,
          tenantId: req.tenantId!,
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
      const tenantId = req.tenantId!
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

  // ─── Bot Konuşmaları ──────────────────────────────────────────────────────

  // GET /bot-conversations?page=1&limit=20&outcome=booked&channel=telegram
  router.get('/bot-conversations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'owner') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!
      const page = Math.max(1, parseInt(req.query.page as string) || 1)
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
      const outcome = req.query.outcome as string | undefined
      const channel = req.query.channel as string | undefined

      const where = {
        tenantId,
        ...(outcome ? { outcome } : {}),
        ...(channel ? { channel } : {}),
      }

      const [total, conversations] = await Promise.all([
        db.botConversation.count({ where }),
        db.botConversation.findMany({
          where,
          orderBy: { endedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            channel: true,
            customerRef: true,
            outcome: true,
            referenceCode: true,
            turnCount: true,
            startedAt: true,
            endedAt: true,
          },
        }),
      ])

      return res.json({
        data: conversations,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /bot-conversations/:conversationId — transkript detayı
  router.get('/bot-conversations/:conversationId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'owner') {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!
      const { conversationId } = req.params

      const convo = await db.botConversation.findFirst({
        where: { id: conversationId, tenantId },
      })

      if (!convo) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Konuşma bulunamadı.' } })
      }

      return res.json({ data: convo })
    } catch (err) {
      next(err)
    }
  })

  return router
}
