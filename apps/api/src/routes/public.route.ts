import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { db } from '../lib/db'

const TZ_OFFSET_HOURS = 3
const TR_OFFSET_MS = TZ_OFFSET_HOURS * 60 * 60 * 1000

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function parseHours(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + (m ?? 0) / 60
}

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla istek gönderildi, lütfen 1 dakika sonra tekrar deneyin.' } },
})

export function createPublicRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(publicLimiter)

  // GET /api/v1/tenants/:slug/public/services
  router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params

      const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } })
      if (!tenant) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Salon bulunamadı.' } })
      }

      const services = await db.service.findMany({
        where: { tenantId: tenant.id, isActive: true, isOnlineBookable: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, durationMinutes: true, category: true },
      })

      return res.json({
        data: services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.durationMinutes,
          category: s.category ?? null,
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/public/slots?serviceId=UUID&staffId=UUID&date=YYYY-MM-DD
  const slotsQuerySchema = z.object({
    serviceId: z.string().uuid(),
    staffId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })

  router.get('/slots', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = slotsQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'serviceId, staffId ve date (YYYY-MM-DD) zorunludur.' } })
      }

      const { serviceId, staffId, date } = parsed.data
      const { slug } = req.params

      const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } })
      if (!tenant) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Salon bulunamadı.' } })
      }
      const tenantId = tenant.id

      const service = await db.service.findFirst({
        where: { id: serviceId, tenantId, isActive: true, isOnlineBookable: true },
        select: { durationMinutes: true, bufferMinutes: true },
      })
      if (!service) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
      }

      const staffProfile = await db.staffProfile.findFirst({
        where: {
          id: staffId,
          tenantId,
          serviceAssignments: { some: { serviceId, isActive: true } },
        },
        select: { id: true, workingHours: true },
      })
      if (!staffProfile) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı veya bu hizmeti yapamaz.' } })
      }

      // date = YYYY-MM-DD (TR calendar) → midnight UTC of same date
      const dateObj = new Date(`${date}T00:00:00Z`)

      // İzin kontrolü
      const leaveEnd = new Date(dateObj.getTime() + 24 * 60 * 60 * 1000)
      const onLeave = await db.staffLeave.findFirst({
        where: { staffId, tenantId, leaveDate: { gte: dateObj, lt: leaveEnd } },
      })
      if (onLeave) {
        return res.json({ date, slots: [] })
      }

      // O günün mesai saatlerini al
      const wh = staffProfile.workingHours as Record<string, { start: string; end: string } | null>
      const dayKey = DAY_KEYS[dateObj.getUTCDay()]
      const daySchedule = wh[dayKey]

      if (!daySchedule?.start || !daySchedule?.end) {
        return res.json({ date, slots: [] })
      }

      const workStart = parseHours(daySchedule.start)
      const workEnd = parseHours(daySchedule.end)

      // O günkü mevcut randevuları al (UTC aralığı)
      const fullDayStart = new Date(dateObj.getTime() + (0 - TZ_OFFSET_HOURS) * 60 * 60 * 1000)
      const fullDayEnd = new Date(dateObj.getTime() + (24 - TZ_OFFSET_HOURS) * 60 * 60 * 1000)

      const existingAppointments = await db.appointment.findMany({
        where: {
          tenantId,
          staffId,
          isDeleted: false,
          startAt: { gte: fullDayStart, lt: fullDayEnd },
          status: { in: ['pending', 'confirmed', 'in_progress'] },
        },
        select: { startAt: true, endAt: true },
      })

      // Slot üret: mesai başından sonuna hizmet süresi adımlarla
      const slotDuration = service.durationMinutes + service.bufferMinutes
      const cursorStart = new Date(dateObj.getTime() + (workStart - TZ_OFFSET_HOURS) * 60 * 60 * 1000)
      const cursorEnd = new Date(dateObj.getTime() + (workEnd - TZ_OFFSET_HOURS) * 60 * 60 * 1000)

      const slots: Array<{ id: string; label: string; available: boolean }> = []
      let cursor = new Date(cursorStart)

      while (cursor < cursorEnd) {
        const slotEnd = new Date(cursor.getTime() + slotDuration * 60 * 1000)
        if (slotEnd > cursorEnd) break

        const hasConflict = existingAppointments.some(
          (a) => a.startAt < slotEnd && a.endAt > cursor,
        )

        const trCursor = new Date(cursor.getTime() + TR_OFFSET_MS)
        const hh = trCursor.getUTCHours().toString().padStart(2, '0')
        const mm = trCursor.getUTCMinutes().toString().padStart(2, '0')

        slots.push({
          id: cursor.toISOString().slice(0, 19),
          label: `${hh}:${mm}`,
          available: !hasConflict,
        })

        cursor = new Date(cursor.getTime() + slotDuration * 60 * 1000)
      }

      return res.json({ date, slots })
    } catch (err) {
      next(err)
    }
  })

  return router
}
