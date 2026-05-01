import { Router, type Request, type Response, type NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { db } from '../lib/db'
import { sendWelcomeEmail } from '../lib/email'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const registerSchema = z.object({
  salonName: z.string().trim().min(2).max(100),
  slug: z.string().trim().regex(/^[a-z0-9-]{3,30}$/, 'Slug sadece küçük harf, rakam ve tire içerebilir (3-30 karakter).'),
  ownerFullName: z.string().trim().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  businessType: z.enum(['barbershop', 'beauty_center', 'nail_studio', 'aesthetic', 'other']).optional(),
})

const ACCESS_EXPIRY = '15m'
const REFRESH_EXPIRY = '30d'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map((c) => {
      const idx = c.indexOf('=')
      return [c.slice(0, idx).trim(), decodeURIComponent(c.slice(idx + 1).trim())]
    }),
  )
}

function setRefreshCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production'
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/api/v1/auth',
  })
}

export function createAuthRouter(options?: { registerLimitMax?: number }): Router {
  const router = Router()

  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: options?.registerLimitMax ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla kayıt denemesi. 1 saat sonra tekrar deneyin.' } },
  })

  router.post('/register', registerLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = registerSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Geçersiz kayıt verisi.' } })
      }

      const { salonName, slug, ownerFullName, email, password, businessType } = parsed.data

      const slugExists = await db.tenant.findUnique({ where: { slug }, select: { id: true } })
      if (slugExists) {
        return res.status(409).json({ error: { code: 'DUPLICATE_SLUG', message: 'Bu slug zaten kullanılıyor.' } })
      }

      const emailExists = await db.user.findFirst({ where: { email }, select: { id: true } })
      if (emailExists) {
        return res.status(409).json({ error: { code: 'DUPLICATE_EMAIL', message: 'Bu e-posta adresi zaten kullanılıyor.' } })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      const { tenant, user } = await db.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: salonName,
            slug,
            plan: 'trial',
            isActive: true,
            trialEndsAt,
            ...(businessType ? { settings: { businessType } } : {}),
          },
        })
        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email,
            passwordHash,
            fullName: ownerFullName,
            role: 'owner',
            isActive: true,
          },
        })
        return { tenant, user }
      })

      const jwtSecret = process.env.JWT_SECRET ?? 'dev-secret'
      const payload = { userId: user.id, tenantId: tenant.id, tenantSlug: tenant.slug, role: user.role }
      const token = jwt.sign(payload, jwtSecret, { expiresIn: ACCESS_EXPIRY })
      const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, jwtSecret, { expiresIn: REFRESH_EXPIRY })

      setRefreshCookie(res, refreshToken)

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

  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
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

      if (!user) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.' } })
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash)
      if (!passwordMatch) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.' } })
      }

      const jwtSecret = process.env.JWT_SECRET ?? 'dev-secret'

      if (!user.tenant) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tenant bulunamadı.' } })
      }

      const payload = {
        userId: user.id,
        tenantId: user.tenantId ?? undefined,
        tenantSlug: user.tenant.slug,
        role: user.role,
      }

      const token = jwt.sign(payload, jwtSecret, { expiresIn: ACCESS_EXPIRY })
      const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, jwtSecret, { expiresIn: REFRESH_EXPIRY })

      setRefreshCookie(res, refreshToken)

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
      const cookies = parseCookies(req.headers.cookie)
      const refreshToken = cookies['refreshToken']

      if (!refreshToken) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Refresh token bulunamadı.' } })
      }

      const jwtSecret = process.env.JWT_SECRET ?? 'dev-secret'

      let decoded: { userId: string; type: string }
      try {
        decoded = jwt.verify(refreshToken, jwtSecret) as { userId: string; type: string }
      } catch {
        return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Refresh token geçersiz veya süresi dolmuş.' } })
      }

      if (decoded.type !== 'refresh') {
        return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Geçersiz token türü.' } })
      }

      const user = await db.user.findFirst({
        where: { id: decoded.userId, isActive: true },
        include: { tenant: { select: { slug: true } } },
      })

      if (!user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Kullanıcı bulunamadı veya devre dışı.' } })
      }

      const payload = {
        userId: user.id,
        tenantId: user.tenantId ?? undefined,
        tenantSlug: user.tenant?.slug,
        role: user.role,
      }

      const newToken = jwt.sign(payload, jwtSecret, { expiresIn: ACCESS_EXPIRY })
      const newRefreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, jwtSecret, { expiresIn: REFRESH_EXPIRY })

      setRefreshCookie(res, newRefreshToken)

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

      if (!user) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.' } })
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash)
      if (!passwordMatch) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.' } })
      }

      const jwtSecret = process.env.JWT_SECRET ?? 'dev-secret'
      const payload = { userId: user.id, role: 'superadmin' }
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '7d' })
      const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, jwtSecret, { expiresIn: REFRESH_EXPIRY })

      setRefreshCookie(res, refreshToken)

      return res.json({
        token,
        user: { id: user.id, email: user.email, name: user.fullName, role: user.role },
      })
    } catch (err) {
      next(err)
    }
  })

  router.post('/logout', (req: Request, res: Response) => {
    const isProd = process.env.NODE_ENV === 'production'
    res.clearCookie('refreshToken', {
      path: '/api/v1/auth',
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    })
    return res.json({ ok: true })
  })

  return router
}
