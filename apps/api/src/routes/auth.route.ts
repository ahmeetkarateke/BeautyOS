import { Router, type Request, type Response, type NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { BusinessType } from '@prisma/client'
import { db } from '../lib/db'
import { sendWelcomeEmail, sendPasswordResetEmail } from '../lib/email'
import { seedDefaultAnamnesisQuestions } from '../lib/anamnesis-seeder'
import crypto from 'crypto'
import { comparePassword, normalizeEmail } from '../lib/credentials'
import { strongPassword } from '../lib/password-policy'
import { acceptanceRows } from '../lib/legal-acceptance'
import { createSession, rotateSession, revokeByToken, revokeFamily, revokeUserSessions, SESSION_TTL_MS } from '../lib/sessions'

// E-posta şemada küçük harfe çevrilir ve TAM eşitlikle aranır. 'insensitive' (ILIKE) kullanılmaz: '_' ve '%' joker olur,
// a_b@x.com adresi a.b@x.com hesabına eşleşirdi. Eski karışık harfli kayıtlar migration ile küçük harfe çevrildi.
const emailField = z.string().email().transform(normalizeEmail)

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
})

const slugField = z.string().trim().regex(/^[a-z0-9-]{3,30}$/, 'Slug sadece küçük harf, rakam ve tire içerebilir (3-30 karakter).')

// Yeni arayüz rızaları (ADR-0048). Alan yoksa eski arayüz yoludur ve kabul kaydı oluşmaz; varsa terms true olmalıdır (K1).
const consentsSchema = z.object({
  terms: z.literal(true, { errorMap: () => ({ message: "Devam etmek için Kullanım Şartları'nı ve Veri İşleme Sözleşmesi'ni kabul etmeniz gerekir." }) }),
  marketingEmail: z.boolean().optional(),
})

const registerSchema = z.object({
  salonName: z.string().trim().min(2).max(100),
  slug: slugField,
  consents: consentsSchema.optional(),
  ownerFullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[0-9+\s()-]{7,20}$/, 'Geçerli bir telefon numarası girin.').optional(),
  email: emailField,
  password: strongPassword,
  businessType: z.nativeEnum(BusinessType).optional(),
})

// Erişim token'ı herkes için (süper yönetici dahil) 15 dakika; oturumu `sid` (aile kimliği) taşır ve sunucuda iptal edilebilir (S6).
const ACCESS_EXPIRY = '15m'
const COOKIE_MAX_AGE = SESSION_TTL_MS

export function requireJwtSecret(): string {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET env variable is missing or too short (min 32 chars). Refusing to sign tokens.')
  }
  return s
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map((c) => {
      const idx = c.indexOf('=')
      return [c.slice(0, idx).trim(), decodeURIComponent(c.slice(idx + 1).trim())]
    }),
  )
}

// SameSite=Lax: web (app.) ve API (api.) aynı site olduğundan çapraz site gönderimi gerekmez (S6 K4); yol yalnız /api/v1/auth.
function refreshCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/v1/auth' }
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, { ...refreshCookieOptions(), maxAge: COOKIE_MAX_AGE })
}

export function signAccessToken(secret: string, claims: { userId: string; tenantId?: string; tenantSlug?: string; role: string }, sid: string): string {
  return jwt.sign({ ...claims, sid }, secret, { expiresIn: ACCESS_EXPIRY })
}

export function createAuthRouter(options?: { registerLimitMax?: number; resetLimitMax?: number; slugCheckLimitMax?: number }): Router {
  const router = Router()

  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: options?.registerLimitMax ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla kayıt denemesi. 1 saat sonra tekrar deneyin.' } },
  })

  // Login için daha sıkı: IP başına 5/15dk
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.' } },
  })

  const resetRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: options?.resetLimitMax ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' } },
  })
  const resetConfirmLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: options?.resetLimitMax ?? 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' } },
  })
  const slugLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: options?.slugCheckLimitMax ?? 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla deneme. Biraz sonra tekrar deneyin.' } },
  })

  router.post('/register', registerLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = registerSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Geçersiz kayıt verisi.' } })
      }

      const { salonName, slug, ownerFullName, phone, email, password, businessType, consents } = parsed.data

      const slugExists = await db.tenant.findUnique({ where: { slug }, select: { id: true } })
      if (slugExists) {
        return res.status(409).json({ error: { code: 'DUPLICATE_SLUG', message: 'Bu slug zaten kullanılıyor.' } })
      }

      const emailExists = await db.user.findFirst({ where: { email }, select: { id: true } })
      if (emailExists) {
        return res.status(409).json({ error: { code: 'DUPLICATE_EMAIL', message: 'Bu e-posta adresi zaten kullanılıyor.' } })
      }

      const passwordHash = await bcrypt.hash(password, 12)
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      const resolvedBusinessType = businessType ?? BusinessType.beauty_center
      const { tenant, user } = await db.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: salonName,
            slug,
            plan: 'trial',
            isActive: true,
            trialEndsAt,
            businessType: resolvedBusinessType,
          },
        })
        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email,
            passwordHash,
            fullName: ownerFullName,
            phone: phone ?? null,
            role: 'owner',
            isActive: true,
          },
        })
        if (consents) {
          await tx.legalAcceptance.createMany({ data: acceptanceRows(tenant.id, user.id, consents) })
        }
        return { tenant, user }
      })

      // Default anamnez sorularını seed et (fail-safe — kayıt etkilenmesin)
      try {
        await seedDefaultAnamnesisQuestions(tenant.id, resolvedBusinessType)
      } catch (e) {
        console.error('seedDefaultAnamnesisQuestions failed:', (e as Error).message)
      }

      const jwtSecret = requireJwtSecret()
      const session = await createSession(user.id, tenant.id)
      const token = signAccessToken(jwtSecret, { userId: user.id, tenantId: tenant.id, tenantSlug: tenant.slug, role: user.role }, session.familyId)

      setRefreshCookie(res, session.refreshToken)

      void sendWelcomeEmail(email, salonName, trialEndsAt)

      return res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          tenantSlug: tenant.slug,
        },
        trialEndsAt: trialEndsAt.toISOString(),
      })
    } catch (err) {
      next(err)
    }
  })

  router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz e-posta veya şifre formatı.' } })
      }

      const { email, password } = parsed.data

      const user = await db.user.findFirst({
        where: { email, isActive: true },
        include: { tenant: { select: { slug: true } } },
      })

      // Hesap varlığı sızmasın: kullanıcı yoksa da gerçek maliyette (geçerli sahte hash) bcrypt karşılaştırması çalışır.
      const passwordMatch = await comparePassword(password, user?.passwordHash)
      if (!user || !passwordMatch) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.' } })
      }

      const jwtSecret = requireJwtSecret()

      if (!user.tenant) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tenant bulunamadı.' } })
      }

      const session = await createSession(user.id, user.tenantId)
      const token = signAccessToken(
        jwtSecret,
        { userId: user.id, tenantId: user.tenantId ?? undefined, tenantSlug: user.tenant.slug, role: user.role },
        session.familyId,
      )

      setRefreshCookie(res, session.refreshToken)

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          tenantSlug: user.tenant.slug,
        },
      })
    } catch (err) {
      next(err)
    }
  })

  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = parseCookies(req.headers.cookie)['refreshToken']
      if (!refreshToken) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Refresh token bulunamadı.' } })
      }

      const jwtSecret = requireJwtSecret()

      // Opak token döndürülür; kullanılmış token tekrar gelirse aile iptal edilir (S6 K1). Eski imzalı JWT çerezleri geçersizdir.
      const rotated = await rotateSession(refreshToken)
      if (!rotated.ok) {
        return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Refresh token geçersiz veya süresi dolmuş.' } })
      }

      // Pasifleştirilmiş kullanıcı yenileyemez (K3): ailesi de kapatılır.
      const user = await db.user.findFirst({
        where: { id: rotated.userId, isActive: true },
        include: { tenant: { select: { slug: true } } },
      })
      if (!user) {
        await revokeFamily(rotated.familyId)
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Kullanıcı bulunamadı veya devre dışı.' } })
      }

      const newToken = signAccessToken(
        jwtSecret,
        user.role === 'superadmin'
          ? { userId: user.id, role: user.role }
          : { userId: user.id, tenantId: user.tenantId ?? undefined, tenantSlug: user.tenant?.slug, role: user.role },
        rotated.familyId,
      )

      setRefreshCookie(res, rotated.refreshToken)

      return res.json({ token: newToken })
    } catch (err) {
      next(err)
    }
  })

  router.post('/admin-login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz e-posta veya şifre formatı.' } })
      }

      const { email, password } = parsed.data

      const user = await db.user.findFirst({
        where: { email, role: 'superadmin', isActive: true },
      })

      const passwordMatch = await comparePassword(password, user?.passwordHash)
      if (!user || !passwordMatch) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.' } })
      }

      const jwtSecret = requireJwtSecret()
      // Süper yönetici erişimi de 15 dakika (K5); yenileme çerezi ve iptal edilebilir oturum ile.
      const session = await createSession(user.id, null)
      const token = signAccessToken(jwtSecret, { userId: user.id, role: 'superadmin' }, session.familyId)

      setRefreshCookie(res, session.refreshToken)

      return res.json({
        token,
        user: { id: user.id, email: user.email, name: user.fullName, role: user.role },
      })
    } catch (err) {
      next(err)
    }
  })

  // Eski arayüz bağlantıyı ?token= ile, yeni arayüz #token= ile alır (ADR-0046); iş mantığı ortaktır.
  const handleForgot = (buildLink: (frontendUrl: string, rawToken: string) => string) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ email: emailField }).safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçerli bir e-posta adresi girin.' } })
      }

      const user = await db.user.findFirst({
        where: { email: parsed.data.email, isActive: true, role: { not: 'superadmin' } },
        select: { id: true, email: true },
      })

      // Always return 200 to avoid email enumeration
      if (!user) return res.json({ ok: true })

      // Önceki aktif token'ları geçersiz kıl (sadece son token kullanılabilir)
      await db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      })

      const rawToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

      await db.passwordResetToken.create({
        data: { token: tokenHash, userId: user.id, expiresAt },
      })

      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
      // Adres isteğe değil kayıtlı hesaba gönderilir: eşleşme ne olursa olsun bağlantı yalnız hesap sahibine gider.
      void sendPasswordResetEmail(user.email, buildLink(frontendUrl, rawToken))

      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  }

  const handleReset = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({
        token: z.string().min(1).max(128),
        password: strongPassword,
      }).safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Geçersiz veri.' } })
      }

      const now = new Date()
      const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex')
      const resetToken = await db.passwordResetToken.findUnique({
        where: { token: tokenHash },
        select: { id: true, userId: true, expiresAt: true, usedAt: true },
      })

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt < now) {
        return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Geçersiz veya süresi dolmuş token.' } })
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 12)

      await db.$transaction([
        db.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
        db.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: now } }),
      ])
      // Şifre sıfırlanınca tüm cihazlardaki oturumlar kapanır (K2).
      await revokeUserSessions(resetToken.userId)

      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  }

  router.post('/forgot-password', handleForgot((base, raw) => `${base}/reset-password?token=${raw}`))
  router.post('/reset-password', handleReset)
  // Yeni arayüz: token URL'nin # parçasında gider (sunucu günlüklerine ve Referer'a düşmez), API'ye gövdede gelir.
  router.post('/password-reset/request', resetRequestLimiter, handleForgot((base, raw) => `${base}/reset-password#token=${raw}`))
  router.post('/password-reset/confirm', resetConfirmLimiter, handleReset)

  // Kimliksiz uygunluk kontrolü (kayıt formu önizlemesi). Yalnız var/yok döner; başka alan sızdırmaz.
  router.get('/slug-available', slugLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = slugField.safeParse(req.query.slug)
      if (!parsed.success) return res.json({ available: false, reason: 'invalid' })
      const taken = await db.tenant.findUnique({ where: { slug: parsed.data }, select: { id: true } })
      return res.json(taken ? { available: false, reason: 'taken' } : { available: true })
    } catch (err) {
      next(err)
    }
  })

  router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = parseCookies(req.headers.cookie)['refreshToken']
      if (refreshToken) await revokeByToken(refreshToken)
      res.clearCookie('refreshToken', refreshCookieOptions())
      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  return router
}
