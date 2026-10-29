import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { db } from '../lib/db'
import { authenticateJWT, requireTenantAccess, checkTenantActive } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission'

const XSS_PATTERN = /<[^>]*>|javascript:/i

function noXss(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .refine((v) => !XSS_PATTERN.test(v), { message: 'Geçersiz karakter içeriyor.' })
}

const VALID_STATUSES = ['waiting', 'notified', 'booked', 'expired', 'cancelled'] as const
type WaitlistStatusLiteral = (typeof VALID_STATUSES)[number]

const createSchema = z.object({
  customerId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferredTimeRange: noXss(60).optional(),
  notes: noXss(500).optional(),
})

const updateSchema = z.object({
  serviceId: z.string().uuid().nullable().optional(),
  staffId: z.string().uuid().nullable().optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  preferredTimeRange: noXss(60).nullable().optional(),
  notes: noXss(500).nullable().optional(),
})

const bookSchema = z.object({
  appointmentId: z.string().uuid(),
})

export function createWaitlistRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  function canMutateOthers(role: string): boolean {
    return role === 'owner' || role === 'manager'
  }

  // GET /waitlist
  router.get('/', requirePermission('waitlist.view'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!

      const querySchema = z.object({
        status: z.enum(VALID_STATUSES).optional(),
        serviceId: z.string().uuid().optional(),
        staffId: z.string().uuid().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })

      const parsed = querySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz sorgu parametresi.' } })
      }
      const { status, serviceId, staffId, date } = parsed.data

      const entries = await db.waitlist.findMany({
        where: {
          tenantId,
          ...(status ? { status } : {}),
          ...(serviceId ? { serviceId } : {}),
          ...(staffId ? { staffId } : {}),
          ...(date ? { preferredDate: new Date(`${date}T00:00:00.000Z`) } : {}),
        },
        orderBy: { createdAt: 'asc' },
        include: {
          customer: { select: { id: true, fullName: true, phone: true, email: true } },
        },
      })

      const serviceIds = Array.from(new Set(entries.map((e) => e.serviceId).filter((s): s is string => !!s)))
      const staffIds = Array.from(new Set(entries.map((e) => e.staffId).filter((s): s is string => !!s)))

      const [services, staffList] = await Promise.all([
        serviceIds.length
          ? db.service.findMany({ where: { tenantId, id: { in: serviceIds } }, select: { id: true, name: true } })
          : Promise.resolve([] as Array<{ id: string; name: string }>),
        staffIds.length
          ? db.staffProfile.findMany({
              where: { tenantId, id: { in: staffIds } },
              select: { id: true, user: { select: { fullName: true } } },
            })
          : Promise.resolve([] as Array<{ id: string; user: { fullName: string } }>),
      ])

      const serviceMap = new Map(services.map((s) => [s.id, s.name]))
      const staffMap = new Map(staffList.map((s) => [s.id, s.user.fullName]))

      return res.json({
        data: entries.map((e) => ({
          id: e.id,
          customerId: e.customerId,
          customerName: e.customer.fullName,
          customerPhone: e.customer.phone,
          customerEmail: e.customer.email ?? null,
          serviceId: e.serviceId,
          serviceName: e.serviceId ? serviceMap.get(e.serviceId) ?? null : null,
          staffId: e.staffId,
          staffName: e.staffId ? staffMap.get(e.staffId) ?? null : null,
          preferredDate: e.preferredDate ? e.preferredDate.toISOString().split('T')[0] : null,
          preferredTimeRange: e.preferredTimeRange,
          status: e.status,
          notes: e.notes,
          notifiedAt: e.notifiedAt?.toISOString() ?? null,
          bookedAppointmentId: e.bookedAppointmentId,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  // POST /waitlist
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!

      const parsed = createSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz bekleme listesi verisi.' } })
      }
      const { customerId, serviceId, staffId, preferredDate, preferredTimeRange, notes } = parsed.data

      const customer = await db.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } })
      if (!customer) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      if (serviceId) {
        const svc = await db.service.findFirst({ where: { id: serviceId, tenantId }, select: { id: true } })
        if (!svc) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
        }
      }

      if (staffId) {
        const staff = await db.staffProfile.findFirst({ where: { id: staffId, tenantId }, select: { id: true } })
        if (!staff) {
          return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
        }
      }

      const entry = await db.waitlist.create({
        data: {
          tenantId,
          customerId,
          serviceId: serviceId ?? null,
          staffId: staffId ?? null,
          preferredDate: preferredDate ? new Date(`${preferredDate}T00:00:00.000Z`) : null,
          preferredTimeRange: preferredTimeRange ?? null,
          notes: notes ?? null,
          status: 'waiting',
        },
      })

      return res.status(201).json({
        id: entry.id,
        status: entry.status,
        createdAt: entry.createdAt.toISOString(),
      })
    } catch (err) {
      next(err)
    }
  })

  // PATCH /waitlist/:id — preferences / notes
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const { id } = req.params

      const parsed = updateSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz güncelleme verisi.' } })
      }

      const existing = await db.waitlist.findFirst({ where: { id, tenantId }, select: { id: true } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' } })
      }

      // Gövdeden gelen hizmet/personel çağıran kiracıya ait olmalı (null = tercihi temizle serbest).
      if (parsed.data.serviceId) {
        const svc = await db.service.findFirst({ where: { id: parsed.data.serviceId, tenantId }, select: { id: true } })
        if (!svc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
      }
      if (parsed.data.staffId) {
        const staff = await db.staffProfile.findFirst({ where: { id: parsed.data.staffId, tenantId }, select: { id: true } })
        if (!staff) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
      }

      const data: Record<string, unknown> = {}
      if (parsed.data.serviceId !== undefined) data.serviceId = parsed.data.serviceId
      if (parsed.data.staffId !== undefined) data.staffId = parsed.data.staffId
      if (parsed.data.preferredDate !== undefined) {
        data.preferredDate = parsed.data.preferredDate
          ? new Date(`${parsed.data.preferredDate}T00:00:00.000Z`)
          : null
      }
      if (parsed.data.preferredTimeRange !== undefined) data.preferredTimeRange = parsed.data.preferredTimeRange
      if (parsed.data.notes !== undefined) data.notes = parsed.data.notes

      const updated = await db.waitlist.update({
        where: { id },
        data,
        select: { id: true, status: true, updatedAt: true },
      })

      return res.json({ id: updated.id, status: updated.status, updatedAt: updated.updatedAt.toISOString() })
    } catch (err) {
      next(err)
    }
  })

  // DELETE /waitlist/:id — soft cancel
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const { id } = req.params

      if (!canMutateOthers(req.user!.role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bekleme kaydı iptal etme yetkiniz yok.' } })
      }

      const existing = await db.waitlist.findFirst({ where: { id, tenantId }, select: { id: true } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' } })
      }

      await db.waitlist.update({ where: { id }, data: { status: 'cancelled' } })
      return res.status(204).send()
    } catch (err) {
      next(err)
    }
  })

  // POST /waitlist/:id/notify
  router.post('/:id/notify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const { id } = req.params

      const entry = await db.waitlist.findFirst({
        where: { id, tenantId },
        include: { customer: { select: { fullName: true, phone: true, email: true } } },
      })
      if (!entry) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' } })
      }

      if (entry.status !== 'waiting' && entry.status !== 'notified') {
        return res.status(409).json({ error: { code: 'STATUS_LOCKED', message: 'Bu kayıt bildirilemez.' } })
      }

      const updated = await db.waitlist.update({
        where: { id },
        data: { status: 'notified', notifiedAt: new Date() },
        select: { id: true, status: true, notifiedAt: true },
      })

      return res.json({
        id: updated.id,
        status: updated.status,
        notifiedAt: updated.notifiedAt?.toISOString() ?? null,
        customer: {
          fullName: entry.customer.fullName,
          phone: entry.customer.phone,
          email: entry.customer.email ?? null,
        },
      })
    } catch (err) {
      next(err)
    }
  })

  // POST /waitlist/:id/book
  router.post('/:id/book', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const { id } = req.params

      const parsed = bookSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz randevu referansı.' } })
      }
      const { appointmentId } = parsed.data

      const entry = await db.waitlist.findFirst({ where: { id, tenantId }, select: { id: true, status: true } })
      if (!entry) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' } })
      }

      const appt = await db.appointment.findFirst({ where: { id: appointmentId, tenantId }, select: { id: true } })
      if (!appt) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
      }

      if (entry.status === 'booked' || entry.status === 'cancelled' || entry.status === 'expired') {
        return res.status(409).json({ error: { code: 'STATUS_LOCKED', message: 'Bu kayıt için işlem yapılamaz.' } })
      }

      const updated = await db.waitlist.update({
        where: { id },
        data: { status: 'booked', bookedAppointmentId: appointmentId },
        select: { id: true, status: true, bookedAppointmentId: true },
      })

      return res.json({ id: updated.id, status: updated.status, bookedAppointmentId: updated.bookedAppointmentId })
    } catch (err) {
      next(err)
    }
  })

  // POST /waitlist/:id/expire
  router.post('/:id/expire', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const { id } = req.params

      if (!canMutateOthers(req.user!.role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Süre dolduruma yetkiniz yok.' } })
      }

      const entry = await db.waitlist.findFirst({ where: { id, tenantId }, select: { id: true, status: true } })
      if (!entry) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' } })
      }

      if (entry.status === 'booked' || entry.status === 'cancelled' || entry.status === 'expired') {
        return res.status(409).json({ error: { code: 'STATUS_LOCKED', message: 'Bu kayıt zaten kapalı.' } })
      }

      const updated = await db.waitlist.update({
        where: { id },
        data: { status: 'expired' },
        select: { id: true, status: true },
      })

      return res.json({ id: updated.id, status: updated.status })
    } catch (err) {
      next(err)
    }
  })

  return router
}

export type { WaitlistStatusLiteral }
