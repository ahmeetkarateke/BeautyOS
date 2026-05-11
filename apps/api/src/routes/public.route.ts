import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { db } from '../lib/db'
import { getSlots } from '../lib/slots'

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla istek gönderildi, lütfen 1 dakika sonra tekrar deneyin.' } },
})

const bookLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla rezervasyon denemesi. Lütfen 1 saat sonra tekrar deneyin.' } },
})

async function loadTenant(slug: string) {
  return db.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, settings: true, isActive: true },
  })
}

function isPublicBookingEnabled(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false
  return (settings as { publicBookingEnabled?: boolean }).publicBookingEnabled === true
}

export function createPublicRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(publicLimiter)

  // GET /api/v1/tenants/:slug/public/tenant — basic tenant info
  router.get('/tenant', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params
      const tenant = await loadTenant(slug)
      if (!tenant || !tenant.isActive) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Salon bulunamadı.' } })
      }
      const settings = (tenant.settings ?? {}) as Record<string, unknown>
      return res.json({
        name: tenant.name,
        publicBookingEnabled: isPublicBookingEnabled(tenant.settings),
        address: settings.address ?? null,
        phone: settings.phone ?? null,
        whatsappNumber: settings.whatsappNumber ?? null,
        mapsUrl: settings.mapsUrl ?? null,
        workingHours: settings.workingHours ?? null,
        brandColor: settings.brandColor ?? null,
        logoUrl: settings.logoUrl ?? null,
        coverUrl: settings.coverUrl ?? null,
        aboutText: settings.aboutText ?? null,
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/public/services
  router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params

      const tenant = await loadTenant(slug)
      if (!tenant || !tenant.isActive) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Salon bulunamadı.' } })
      }
      if (!isPublicBookingEnabled(tenant.settings)) {
        return res.status(403).json({ error: { code: 'BOOKING_DISABLED', message: 'Bu salon şu anda online rezervasyon kabul etmiyor.' } })
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

  // GET /api/v1/tenants/:slug/public/staff?serviceId=UUID
  router.get('/staff', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params
      const serviceId = String(req.query.serviceId ?? '')
      if (!/^[0-9a-f-]{36}$/i.test(serviceId)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçerli bir serviceId gerekli.' } })
      }

      const tenant = await loadTenant(slug)
      if (!tenant || !tenant.isActive) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Salon bulunamadı.' } })
      }
      if (!isPublicBookingEnabled(tenant.settings)) {
        return res.status(403).json({ error: { code: 'BOOKING_DISABLED', message: 'Bu salon şu anda online rezervasyon kabul etmiyor.' } })
      }

      const staff = await db.staffProfile.findMany({
        where: {
          tenantId: tenant.id,
          acceptsOnlineBooking: true,
          serviceAssignments: { some: { serviceId, isActive: true } },
        },
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' },
      })

      return res.json({
        data: staff.map((sp) => ({
          id: sp.id,
          fullName: sp.user.fullName,
          title: sp.title,
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/public/slots?serviceId=UUID&staffId=UUID|any&date=YYYY-MM-DD
  const slotsQuerySchema = z.object({
    serviceId: z.string().uuid(),
    staffId: z.union([z.string().uuid(), z.literal('any')]),
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

      const tenant = await loadTenant(slug)
      if (!tenant || !tenant.isActive) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Salon bulunamadı.' } })
      }
      if (!isPublicBookingEnabled(tenant.settings)) {
        return res.status(403).json({ error: { code: 'BOOKING_DISABLED', message: 'Bu salon şu anda online rezervasyon kabul etmiyor.' } })
      }

      if (staffId !== 'any') {
        const slots = await getSlots({ tenantId: tenant.id, serviceId, staffId, date })
        return res.json({ date, slots: slots.map((s) => ({ ...s, staffId })) })
      }

      // staffId=any → bu hizmeti yapan tüm personel için slot topla, zamana göre dedupe et
      const staffList = await db.staffProfile.findMany({
        where: {
          tenantId: tenant.id,
          acceptsOnlineBooking: true,
          serviceAssignments: { some: { serviceId, isActive: true } },
        },
        select: { id: true },
      })

      const allResults = await Promise.all(
        staffList.map(async (sp) => {
          const slots = await getSlots({ tenantId: tenant.id, serviceId, staffId: sp.id, date })
          return slots.map((s) => ({ ...s, staffId: sp.id }))
        }),
      )

      // Aynı zaman dilimi için ilk müsait personeli seç
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

  // POST /api/v1/tenants/:slug/public/book
  const MAX_ACTIVE_PER_PHONE = 2

  const bookSchema = z.object({
    serviceId: z.string().uuid(),
    staffId: z.string().uuid(),
    startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:?\d{2})?$/, 'Geçersiz tarih formatı.'),
    customerName: z.string().trim().min(2).max(100).refine((v) => !/<[^>]*>|javascript:/i.test(v), 'Geçersiz karakter.'),
    customerPhone: z.string().trim().regex(/^[0-9+\s()-]{7,20}$/, 'Geçerli bir telefon girin.'),
    notes: z.string().trim().max(500).refine((v) => !/<[^>]*>|javascript:/i.test(v), 'Geçersiz karakter.').optional(),
    captchaToken: z.string().optional(),
  })

  async function verifyTurnstile(token: string | undefined, remoteIp: string | undefined): Promise<boolean> {
    const secret = process.env.TURNSTILE_SECRET_KEY
    if (!secret) {
      // Production'da CAPTCHA zorunlu — secret yoksa booking reddedilir
      if (process.env.NODE_ENV === 'production') return false
      return true // dev/test ortamında geç
    }
    if (!token) return false
    try {
      const params = new URLSearchParams({ secret, response: token })
      if (remoteIp) params.set('remoteip', remoteIp)
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })
      const data = (await res.json()) as { success?: boolean }
      return data.success === true
    } catch {
      return false
    }
  }

  router.post('/book', bookLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params
      const parsed = bookSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Eksik veya geçersiz alan.' } })
      }

      const tenant = await loadTenant(slug)
      if (!tenant || !tenant.isActive) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Salon bulunamadı.' } })
      }
      if (!isPublicBookingEnabled(tenant.settings)) {
        return res.status(403).json({ error: { code: 'BOOKING_DISABLED', message: 'Bu salon şu anda online rezervasyon kabul etmiyor.' } })
      }

      const { serviceId, staffId, startAt, customerName, customerPhone, notes, captchaToken } = parsed.data

      // CAPTCHA doğrulama
      const captchaOk = await verifyTurnstile(captchaToken, req.ip)
      if (!captchaOk) {
        return res.status(400).json({ error: { code: 'CAPTCHA_FAILED', message: 'Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.' } })
      }

      // Telefon başına aktif gelecek randevu limiti
      const activeCount = await db.appointment.count({
        where: {
          tenantId: tenant.id,
          customer: { phone: customerPhone },
          isDeleted: false,
          status: { in: ['pending', 'confirmed', 'in_progress'] },
          startAt: { gte: new Date() },
        },
      })
      if (activeCount >= MAX_ACTIVE_PER_PHONE) {
        return res.status(429).json({
          error: {
            code: 'TOO_MANY_BOOKINGS',
            message: `Bu telefon için aktif ${MAX_ACTIVE_PER_PHONE} randevu sınırına ulaşıldı. Mevcut randevularınızı tamamladıktan sonra yeni randevu alabilirsiniz.`,
          },
        })
      }

      const service = await db.service.findFirst({
        where: { id: serviceId, tenantId: tenant.id, isActive: true, isOnlineBookable: true },
        select: { id: true, durationMinutes: true, bufferMinutes: true, price: true },
      })
      if (!service) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
      }

      const staff = await db.staffProfile.findFirst({
        where: {
          id: staffId,
          tenantId: tenant.id,
          acceptsOnlineBooking: true,
          serviceAssignments: { some: { serviceId, isActive: true } },
        },
        select: { id: true },
      })
      if (!staff) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Personel bulunamadı.' } })
      }

      const startDate = new Date(startAt.includes('Z') || startAt.includes('+') ? startAt : `${startAt}Z`)
      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz başlangıç zamanı.' } })
      }
      if (startDate.getTime() < Date.now()) {
        return res.status(400).json({ error: { code: 'PAST_TIME', message: 'Geçmiş bir saate randevu alınamaz.' } })
      }

      const endDate = new Date(startDate.getTime() + (service.durationMinutes + service.bufferMinutes) * 60 * 1000)

      // Çakışma kontrolü
      const conflict = await db.appointment.findFirst({
        where: {
          tenantId: tenant.id,
          staffId,
          isDeleted: false,
          status: { in: ['pending', 'confirmed', 'in_progress'] },
          AND: [
            { startAt: { lt: endDate } },
            { endAt: { gt: startDate } },
          ],
        },
        select: { id: true },
      })
      if (conflict) {
        return res.status(409).json({ error: { code: 'SLOT_TAKEN', message: 'Bu saat dolu, lütfen başka bir saat seçin.' } })
      }

      // Müşteri upsert (telefon ile)
      const customer = await db.customer.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone: customerPhone } },
        create: { tenantId: tenant.id, phone: customerPhone, fullName: customerName },
        update: {},
        select: { id: true },
      })

      const referenceCode = `RDV-${Date.now().toString(36).toUpperCase()}`

      const appointment = await db.appointment.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          staffId,
          serviceId,
          referenceCode,
          status: 'pending', // public booking → salon onayı bekler
          bookingChannel: 'web',
          startAt: startDate,
          endAt: endDate,
          priceCharged: service.price,
          notes: notes ?? null,
        },
        select: { id: true, referenceCode: true, startAt: true },
      })

      return res.status(201).json({
        id: appointment.id,
        referenceCode: appointment.referenceCode,
        startAt: appointment.startAt,
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
