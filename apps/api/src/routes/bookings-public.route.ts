import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { db } from '../lib/db'
import { logger } from '../lib/logger'
import { scheduleReminders, cancelReminders } from '../lib/queue'
import { computeExpiryAt, removeExpiryJob, scheduleOnlineExpiry } from '../lib/online-booking'
import { resolveApprovalMode, resolveBookingMode } from '../lib/booking-mode'
import { initialAppointmentStatus } from '../lib/appointment-status'
import { SLOT_TAKEN_BODY, isSlotOverlapError } from '../lib/slot-conflict'
import { buildIcs, canModify, hashManageToken, modifyDeadline, showPricesOnline } from '../lib/booking-link'

// A7 / ADR-0043 + ADR-0046: müşterinin randevu bağlantısı uçları. Token yalnız POST gövdesinde gelir (yolda ve sorguda değil);
// hata iletileri ve log'lar token taşımaz. Kiracı slug'ı yoktur: token hash'i randevuyu ve kiracısını belirler.
const NOT_FOUND = { error: { code: 'BOOKING_NOT_FOUND', message: 'Randevu bağlantısı geçersiz ya da süresi dolmuş.' } }
const WINDOW_CLOSED = { error: { code: 'MODIFY_WINDOW_CLOSED', message: 'Randevuya 2 saatten az kaldı. Lütfen salonu arayın.' } }
const NOT_MODIFIABLE = { error: { code: 'BOOKING_NOT_MODIFIABLE', message: 'Bu randevu değiştirilemez.' } }
const BAD_BODY = { error: { code: 'VALIDATION_ERROR', message: 'Geçersiz istek.' } }
// Doğrulamasız (sms olmayan) modda onay beklenecek randevu en az bu kadar ilerideki bir saate taşınır (/book ile aynı mantık).
const MIN_LEAD_FOR_APPROVAL_MS = 3 * 60 * 60 * 1000

const tokenSchema = z.object({ token: z.string().min(20).max(200) })
const rescheduleSchema = tokenSchema.extend({
  startAt: z.string().trim().min(1).max(40),
  staffId: z.string().uuid().optional(),
})

export function createBookingManageRouter(options?: { limitMax?: number }): Router {
  const router = Router()

  router.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: options?.limitMax ?? 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla istek gönderildi, lütfen biraz sonra tekrar deneyin.' } },
    }),
  )
  router.use((_req, res, next) => {
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  // Süresi dolmuş (başlamış) randevu da "bulunamadı" sayılır: bağlantı randevu başlangıcına kadar geçerlidir.
  const findBooking = (token: string) =>
    db.appointment.findFirst({
      where: { manageTokenHash: hashManageToken(token), isDeleted: false, startAt: { gt: new Date() } },
      include: {
        service: { select: { name: true, durationMinutes: true, bufferMinutes: true } },
        staff: { select: { user: { select: { fullName: true } } } },
        tenant: { select: { name: true, slug: true, businessType: true, settings: true } },
      },
    })

  const settingText = (settings: unknown, key: string): string | null => {
    const v = (settings as Record<string, unknown> | null)?.[key]
    return typeof v === 'string' && v ? v : null
  }

  router.post('/lookup', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = tokenSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json(BAD_BODY)
      const booking = await findBooking(parsed.data.token)
      if (!booking) return res.status(404).json(NOT_FOUND)

      return res.json({
        tenant: {
          name: booking.tenant.name,
          slug: booking.tenant.slug,
          phone: settingText(booking.tenant.settings, 'phone'),
          address: settingText(booking.tenant.settings, 'address'),
        },
        appointment: {
          referenceCode: booking.referenceCode,
          status: booking.status,
          startAt: booking.startAt,
          endAt: booking.endAt,
          serviceName: booking.service.name,
          staffName: booking.staff.user.fullName,
          // Kapalıyken alan hiç bulunmaz (null da dönmez).
          ...(showPricesOnline(booking.tenant.settings, booking.tenant.businessType) ? { price: Number(booking.priceCharged) } : {}),
        },
        canModify: canModify(booking.status, booking.startAt),
        modifyDeadline: modifyDeadline(booking.startAt),
      })
    } catch (err) {
      next(err)
    }
  })

  router.post('/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = tokenSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json(BAD_BODY)
      const booking = await findBooking(parsed.data.token)
      if (!booking) return res.status(404).json(NOT_FOUND)
      if (booking.status !== 'pending' && booking.status !== 'confirmed') return res.status(409).json(NOT_MODIFIABLE)
      if (!canModify(booking.status, booking.startAt)) return res.status(409).json(WINDOW_CLOSED)

      // Koşullu yazım: araya giren onay/iptal/başlama ezilmez, 2 saat sınırı yazım anında da sınanır.
      const result = await db.appointment.updateMany({
        where: {
          manageTokenHash: hashManageToken(parsed.data.token),
          isDeleted: false,
          status: { in: ['pending', 'confirmed'] },
          startAt: { gt: modifyDeadline(new Date(Date.now() + 2 * 60 * 60 * 1000)) },
        },
        data: { status: 'cancelled', cancelReason: 'cancelled_by_customer' },
      })
      if (result.count === 0) return res.status(409).json(NOT_MODIFIABLE)

      await removeExpiryJob(booking.id)
      await cancelReminders(booking.id)
      return res.json({ status: 'cancelled' })
    } catch (err) {
      next(err)
    }
  })

  router.post('/reschedule', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = rescheduleSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json(BAD_BODY)
      const { token, startAt, staffId } = parsed.data

      const booking = await findBooking(token)
      if (!booking) return res.status(404).json(NOT_FOUND)
      if (booking.status !== 'pending' && booking.status !== 'confirmed') return res.status(409).json(NOT_MODIFIABLE)
      if (!canModify(booking.status, booking.startAt)) return res.status(409).json(WINDOW_CLOSED)

      const newStart = new Date(startAt.includes('Z') || startAt.includes('+') ? startAt : `${startAt}Z`)
      if (Number.isNaN(newStart.getTime())) return res.status(400).json(BAD_BODY)
      const nowMs = Date.now()
      const verified = resolveBookingMode().phoneVerification === 'sms'
      if (newStart.getTime() < nowMs || (!verified && newStart.getTime() < nowMs + MIN_LEAD_FOR_APPROVAL_MS)) {
        return res.status(400).json({ error: { code: 'TOO_SOON', message: 'Seçilen saat çok yakın ya da geçmiş. Lütfen daha ileri bir saat seçin.' } })
      }

      let targetStaffId = booking.staffId
      if (staffId && staffId !== booking.staffId) {
        const staff = await db.staffProfile.findFirst({
          where: { id: staffId, tenantId: booking.tenantId, acceptsOnlineBooking: true, serviceAssignments: { some: { serviceId: booking.serviceId, isActive: true } } },
          select: { id: true },
        })
        if (!staff) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
        targetStaffId = staff.id
      }

      const newEnd = new Date(newStart.getTime() + (booking.service.durationMinutes + booking.service.bufferMinutes) * 60 * 1000)
      const conflict = await db.appointment.findFirst({
        where: {
          tenantId: booking.tenantId,
          staffId: targetStaffId,
          id: { not: booking.id },
          isDeleted: false,
          status: { in: ['pending', 'confirmed', 'in_progress'] },
          AND: [{ startAt: { lt: newEnd } }, { endAt: { gt: newStart } }],
        },
        select: { id: true },
      })
      if (conflict) return res.status(409).json(SLOT_TAKEN_BODY)

      // Durum yeni online talep kuralıyla yeniden belirlenir: müşteri bağlı değilse ya da elle onay modundaysa pending.
      const approvalRequired = booking.customerId === null || resolveApprovalMode(booking.tenant) === 'manual'
      const status = initialAppointmentStatus('web', { approvalRequired })

      try {
        await db.appointment.update({
          where: { id: booking.id },
          data: { startAt: newStart, endAt: newEnd, staffId: targetStaffId, status },
        })
      } catch (err) {
        // Ön kontrol yarışa açıktır; asıl koruma veritabanı kısıtıdır (S3).
        if (isSlotOverlapError(err)) return res.status(409).json(SLOT_TAKEN_BODY)
        throw err
      }

      // İşler yeni saate göre yeniden kurulur; kuyruk hatası taşımayı bozmaz (gece uzlaştırması telafi eder).
      try {
        await removeExpiryJob(booking.id)
        await cancelReminders(booking.id)
        if (status === 'pending') {
          await scheduleOnlineExpiry(booking.id, computeExpiryAt(new Date(nowMs), newStart), new Date(nowMs))
        } else {
          await scheduleReminders({ appointmentId: booking.id, tenantId: booking.tenantId, startAt: newStart })
        }
      } catch (err) {
        logger.warn({ err, appointmentId: booking.id }, 'Taşıma sonrası randevu işleri güncellenemedi')
      }

      return res.json({ status, startAt: newStart, endAt: newEnd, approvalRequired })
    } catch (err) {
      next(err)
    }
  })

  router.post('/calendar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = tokenSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json(BAD_BODY)
      const booking = await findBooking(parsed.data.token)
      if (!booking) return res.status(404).json(NOT_FOUND)

      const ics = buildIcs({
        appointmentId: booking.id,
        salonName: booking.tenant.name,
        serviceName: booking.service.name,
        businessType: booking.tenant.businessType,
        address: settingText(booking.tenant.settings, 'address'),
        startAt: booking.startAt,
        endAt: booking.endAt,
      })
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="randevu.ics"')
      return res.send(ics)
    } catch (err) {
      next(err)
    }
  })

  return router
}
