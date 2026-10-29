import { Router, type Request, type Response, type NextFunction } from 'express'
import { randomBytes } from 'node:crypto'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { db } from '../lib/db'
import { getSlots } from '../lib/slots'
import { sendVerificationCode, verifyCode } from '../lib/phone-verification'
import { normalizePhoneTR } from '../lib/sms'
import { remindersQueue } from '../lib/queue'
import { isTurnstileUnavailable, verifyTurnstile } from '../lib/turnstile'
import { logger } from '../lib/logger'
import { SLOT_TAKEN_BODY, respondSlotTakenOr } from '../lib/slot-conflict'
import { resolveBookingMode } from '../lib/booking-mode'
import { ONLINE_LIMITS, computeExpiryAt, phoneVariants, scheduleOnlineExpiry } from '../lib/online-booking'

const MAX_ACTIVE_PER_PHONE = 2
// Süre dolumu randevudan 2 saat önce olduğundan, bundan yakın talep hemen dolacaktı.
const MIN_LEAD_FOR_APPROVAL_MS = 2.5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Doğrulamasız (none) modda onay için süre dolumu yakın saatleri kapsamaz: slot listesi bu saatleri kapalı gösterir. */
function applyApprovalLead<T extends { id: string; available: boolean }>(slots: T[]): T[] {
  if (resolveBookingMode().phoneVerification === 'sms') return slots
  const limit = Date.now() + MIN_LEAD_FOR_APPROVAL_MS
  return slots.map((s) => (new Date(s.id.includes('Z') || s.id.includes('+') ? s.id : `${s.id}Z`).getTime() < limit ? { ...s, available: false } : s))
}

const MANUAL_BY_DEFAULT: ReadonlySet<string> = new Set(['dentist', 'aesthetic_clinic'])

/** T3: salon ayarı varsa o; yoksa klinik türleri elle onay, diğerleri otomatik. Yalnız sms (doğrulanmış) modunda geçerlidir. */
function resolveApprovalMode(tenant: { settings: unknown; businessType: string }): 'auto' | 'manual' {
  const configured = (tenant.settings as { onlineBookingApproval?: unknown } | null)?.onlineBookingApproval
  if (configured === 'auto' || configured === 'manual') return configured
  return MANUAL_BY_DEFAULT.has(tenant.businessType) ? 'manual' : 'auto'
}

/**
 * Telefon başına aktif randevu tavanı yalnız doğrulanmış (sms) modda uygulanır: telefonun sahibi doğrulamayla kanıtlanmıştır.
 * Doğrulamasız modda telefona özgü hiçbir tavan yoktur; yanıt, süre ve slot davranışı telefon durumundan bağımsızdır (KVKK).
 */
async function isActiveBookingCapReached(tenantId: string, variants: string[]): Promise<boolean> {
  const activeCount = await db.appointment.count({
    where: {
      tenantId,
      OR: [{ customer: { phone: { in: variants } } }, { requestedPhone: { in: variants } }],
      isDeleted: false,
      status: { in: ['pending', 'confirmed', 'in_progress'] },
      startAt: { gte: new Date() },
    },
  })
  return activeCount >= MAX_ACTIVE_PER_PHONE
}

/** Kiracı geneli günlük tavan; telefona özgü bilgi taşımaz, ayrı kodla dönebilir. */
async function isTenantDailyCapReached(tenantId: string): Promise<boolean> {
  const tenantPending = await db.appointment.count({
    where: { tenantId, bookingChannel: 'web', status: 'pending', isDeleted: false, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
  })
  return tenantPending >= ONLINE_LIMITS.pendingPerTenantPerDay
}

function newReferenceCode(nowMs: number): string {
  return `RDV-${nowMs.toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`
}

/** Kayıtlı müşteri farklı telefon biçimiyle bulunur; yoksa normalize telefonla oluşturulur. */
async function resolveCustomerId(
  tenantId: string,
  normalizedPhone: string,
  variants: string[],
  fullName: string,
  verifiedAt: Date | null,
): Promise<string> {
  const existing = await db.customer.findFirst({
    where: { tenantId, phone: { in: variants } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (existing) return existing.id
  const verified = verifiedAt ? { phoneVerifiedAt: verifiedAt } : {}
  const customer = await db.customer.upsert({
    where: { tenantId_phone: { tenantId, phone: normalizedPhone } },
    create: { tenantId, phone: normalizedPhone, fullName, ...verified },
    update: { ...verified },
    select: { id: true },
  })
  return customer.id
}

async function scheduleReminders(appointmentId: string, startDate: Date, nowMs: number): Promise<void> {
  const delay24h = startDate.getTime() - nowMs - 24 * 60 * 60 * 1000
  const delay2h = startDate.getTime() - nowMs - 2 * 60 * 60 * 1000
  try {
    if (delay24h > 0) {
      await remindersQueue.add('reminder-24h', { type: 'reminder_24h', appointmentId }, { delay: delay24h, jobId: `reminder-24h-${appointmentId}` })
    }
    if (delay2h > 0) {
      await remindersQueue.add('reminder-2h', { type: 'reminder_2h', appointmentId }, { delay: delay2h, jobId: `reminder-2h-${appointmentId}` })
    }
  } catch (err) {
    // Randevu oluştu; hatırlatma kurulamadıysa yalnız log (kişisel veri yok).
    logger.error({ err, appointmentId }, 'Hatırlatma zamanlanamadı')
  }
}

async function loadTenant(slug: string) {
  return db.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, settings: true, isActive: true, businessType: true },
  })
}

function isPublicBookingEnabled(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false
  return (settings as { publicBookingEnabled?: boolean }).publicBookingEnabled === true
}

export function createPublicRouter(): Router {
  const router = Router({ mergeParams: true })

  // Sayaçlar router örneğine bağlıdır (modül düzeyinde paylaşılmaz).
  const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla istek gönderildi, lütfen 1 dakika sonra tekrar deneyin.' } },
  })

  const bookLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: ONLINE_LIMITS.ipPerHour,
    // Yalnız 400 (captcha, doğrulama, geçmiş/yakın saat) kotayı tüketmez; tavan, 404, 409 ve 429 yanıtları sayılır.
    skipFailedRequests: true,
    requestWasSuccessful: (_req, res) => res.statusCode !== 400,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla rezervasyon denemesi. Lütfen 1 saat sonra tekrar deneyin.' } },
  })

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
        bookingMode: resolveBookingMode().bookingMode,
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
        return res.json({ date, slots: applyApprovalLead(slots.map((s) => ({ ...s, staffId }))) })
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
      return res.json({ date, slots: applyApprovalLead(merged) })
    } catch (err) {
      next(err)
    }
  })

  // POST /api/v1/tenants/:slug/public/book
  const bookSchema = z.object({
    serviceId: z.string().uuid(),
    staffId: z.string().uuid(),
    startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:?\d{2})?$/, 'Geçersiz tarih formatı.'),
    customerName: z.string().trim().min(2).max(100).refine((v) => !/<[^>]*>|javascript:/i.test(v), 'Geçersiz karakter.'),
    customerPhone: z.string().trim().regex(/^[0-9+\s()-]{7,20}$/, 'Geçerli bir telefon girin.'),
    captchaToken: z.string().optional(),
  })

  // ─── Telefon doğrulama: Kod gönder ────────────────────────────────────────
  const verifySendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 saat
    max: 10,                    // IP başına saatte 10 deneme
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla doğrulama isteği. 1 saat sonra tekrar deneyin.' } },
  })

  router.post('/verify/send', verifySendLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params
      const schema = z.object({ phone: z.string().min(7).max(20) })
      const parsed = schema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Telefon numarası gerekli.' } })
      }

      const tenant = await loadTenant(slug)
      if (!tenant || !tenant.isActive) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Salon bulunamadı.' } })
      }

      const result = await sendVerificationCode({
        phone: parsed.data.phone,
        tenantId: tenant.id,
        ipAddress: req.ip,
      })

      if (!result.ok) {
        const status = result.error === 'TOO_SOON' ? 429 : result.error === 'SMS_UNAVAILABLE' ? 503 : 400
        return res.status(status).json({
          error: { code: result.error, message: result.message },
          retryAfterSec: 'retryAfterSec' in result ? result.retryAfterSec : undefined,
        })
      }

      return res.json({
        ok: true,
        // Dev/mock modunda kod konsoldan da görülebilir; production'da return EDİLMEZ
        devCode: result.devCode,
      })
    } catch (err) { next(err) }
  })

  // ─── Telefon doğrulama: Kod doğrula ───────────────────────────────────────
  // Başarısız denemeler de sayılır (kod tahmini); skipFailedRequests kasıtlı olarak kapalı.
  const verifyConfirmLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla doğrulama denemesi. 15 dakika sonra tekrar deneyin.' } },
  })
  router.post('/verify/confirm', verifyConfirmLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        phone: z.string().min(7).max(20),
        code: z.string().regex(/^\d{6}$/, '6 haneli kod giriniz.'),
      })
      const parsed = schema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Geçersiz veri.' } })
      }

      const result = await verifyCode(parsed.data)
      if (!result.ok) {
        return res.status(400).json({ error: { code: result.error, message: result.message } })
      }

      return res.json({ ok: true, phone: result.phone })
    } catch (err) { next(err) }
  })

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

      const { serviceId, staffId, startAt, customerName, customerPhone, captchaToken } = parsed.data
      const verifiedMode = resolveBookingMode().phoneVerification === 'sms'

      // Üretimde Turnstile anahtarı yoksa doğrulama yapılamaz: açık bırakmak yerine kapat.
      if (isTurnstileUnavailable()) {
        return res.status(503).json({ error: { code: 'CAPTCHA_UNAVAILABLE', message: 'Online randevu şu an kullanılamıyor, lütfen salonu arayın.' } })
      }
      if (!(await verifyTurnstile(captchaToken, req.ip))) {
        return res.status(400).json({ error: { code: 'CAPTCHA_FAILED', message: 'Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.' } })
      }

      const normalizedPhone = normalizePhoneTR(customerPhone)
      if (!normalizedPhone) {
        return res.status(400).json({ error: { code: 'INVALID_PHONE', message: 'Geçersiz telefon numarası.' } })
      }
      const variants = phoneVariants(customerPhone)

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
      const nowMs = Date.now()
      if (startDate.getTime() < nowMs) {
        return res.status(400).json({ error: { code: 'PAST_TIME', message: 'Geçmiş bir saate randevu alınamaz.' } })
      }
      // Onay beklenecekse süre dolumu (randevudan 2 saat önce) anlamlı olacak kadar uzak bir saat gerekir.
      if (!verifiedMode && startDate.getTime() < nowMs + MIN_LEAD_FOR_APPROVAL_MS) {
        return res.status(400).json({
          error: { code: 'TOO_SOON_FOR_APPROVAL', message: 'Onay beklenen randevular için en az 3 saat sonrası seçilmeli. Yakın saatler için lütfen salonu arayın.' },
        })
      }

      const endDate = new Date(startDate.getTime() + (service.durationMinutes + service.bufferMinutes) * 60 * 1000)

      const conflict = await db.appointment.findFirst({
        where: {
          tenantId: tenant.id,
          staffId,
          isDeleted: false,
          status: { in: ['pending', 'confirmed', 'in_progress'] },
          AND: [{ startAt: { lt: endDate } }, { endAt: { gt: startDate } }],
        },
        select: { id: true },
      })
      if (conflict) {
        return res.status(409).json(SLOT_TAKEN_BODY)
      }

      // sms modunda son 30 dakikada doğrulanmış telefon şart; none modunda doğrulama yoktur (ADR-0034).
      let verifiedAt: Date | null = null
      if (verifiedMode) {
        const recent = await db.phoneVerification.findFirst({
          where: { phone: normalizedPhone, consumedAt: { gte: new Date(nowMs - 30 * 60 * 1000) } },
          orderBy: { consumedAt: 'desc' },
          select: { id: true, consumedAt: true },
        })
        if (!recent) {
          return res.status(403).json({ error: { code: 'PHONE_NOT_VERIFIED', message: 'Telefon numaranızı önce doğrulamanız gerekmektedir.' } })
        }
        verifiedAt = recent.consumedAt
      }

      // Tavanlar servis, personel, saat ve (sms modunda) doğrulamadan sonra denetlenir.
      if (await isTenantDailyCapReached(tenant.id)) {
        return res.status(429).json({ error: { code: 'TENANT_DAILY_LIMIT', message: 'Online randevu şu an alınamıyor, lütfen salonu arayın.' } })
      }
      if (verifiedMode && (await isActiveBookingCapReached(tenant.id, variants))) {
        return res.status(429).json({
          error: { code: 'TOO_MANY_BOOKINGS', message: `Bu telefon için aktif ${MAX_ACTIVE_PER_PHONE} randevu sınırına ulaşıldı. Mevcut randevularınızı tamamladıktan sonra yeni randevu alabilirsiniz.` },
        })
      }

      // Doğrulanmamış talep var olan müşteriye bağlanmaz ve müşteri oluşturmaz (KVKK): ad/telefon talepte tutulur, salon onayda eşleştirir.
      const customerId = verifiedMode ? await resolveCustomerId(tenant.id, normalizedPhone, variants, customerName, verifiedAt) : null
      const approvalRequired = !verifiedMode || resolveApprovalMode(tenant) === 'manual'
      const status = approvalRequired ? 'pending' : 'confirmed'
      const referenceCode = newReferenceCode(nowMs)

      const appointment = await db.appointment.create({
        data: {
          tenantId: tenant.id,
          customerId,
          staffId,
          serviceId,
          referenceCode,
          requestedName: verifiedMode ? null : customerName,
          requestedPhone: verifiedMode ? null : normalizedPhone,
          status,
          phoneVerified: verifiedMode,
          bookingChannel: 'web',
          startAt: startDate,
          endAt: endDate,
          priceCharged: service.price,
          notes: null, // Online formda serbest not yok: sağlık verisi riski (hukuk-uyum)
        },
        select: { id: true, referenceCode: true, startAt: true },
      })

      if (approvalRequired) {
        await scheduleOnlineExpiry(appointment.id, computeExpiryAt(new Date(nowMs), startDate), new Date(nowMs))
      }
      if (verifiedMode) await scheduleReminders(appointment.id, startDate, nowMs)

      return res.status(201).json({
        id: appointment.id,
        referenceCode: appointment.referenceCode,
        startAt: appointment.startAt,
        status,
        approvalRequired,
        phoneVerified: verifiedMode,
      })
    } catch (err) {
      respondSlotTakenOr(err, res, next)
    }
  })

  return router
}
