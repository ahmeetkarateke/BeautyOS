import { Router, type Request, type Response, type NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { Prisma, UserRole } from '@prisma/client'
import { db } from '../lib/db'
import { logger } from '../lib/logger'
import { normalizeEmail } from '../lib/credentials'
import { strongPassword } from '../lib/password-policy'
import { createSession } from '../lib/sessions'
import { sendInvitationEmail, isEmailConfigured } from '../lib/email'
import { INVITE_TTL_MS, INVITES_PER_DAY, hashInviteToken, newInviteToken, inviteLink } from '../lib/invitations'
import { ensurePermission } from '../middleware/permission'
import { authenticateJWT, requireTenantAccess, checkTenantActive } from '../middleware/auth.middleware'
import { requireJwtSecret, setRefreshCookie, signAccessToken } from './auth.route'
import { resolveTenantWorkingHours } from './tenant.route'

const INVALID = { error: { code: 'INVITATION_INVALID', message: 'Davet bağlantısı geçersiz ya da süresi dolmuş.' } }
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

const createSchema = z.object({
  email: z.string().email().transform(normalizeEmail),
  fullName: z.string().trim().min(2).max(100),
  // owner ve superadmin davet edilemez (ADR-0042); yalnız bu üç rol.
  role: z.enum(['manager', 'receptionist', 'staff']),
  title: z.string().trim().min(1).max(100).optional(),
})

/** Sahip uçları (kiracı içi): davet oluştur, listele, yeniden gönder, iptal et. */
export function createInvitationsRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  async function deliverLink(tenantId: string, invite: { email: string; fullName: string; expiresAt: Date }, link: string): Promise<boolean> {
    if (!isEmailConfigured()) return false
    try {
      const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
      return await sendInvitationEmail({ to: invite.email, salonName: tenant?.name ?? 'Salon', fullName: invite.fullName, link, expiresAt: invite.expiresAt })
    } catch (err) {
      // Bağlantı ve adres log'a yazılmaz.
      logger.error({ err, tenantId }, 'Davet e-postası gönderilemedi')
      return false
    }
  }

  router.post('/invitations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'staff.invite')) return
      const tenantId = req.tenantId!

      const parsed = createSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz davet verisi.' } })
      }
      const { email, fullName, role, title } = parsed.data
      const now = new Date()

      const [existingUser, pending, sentToday] = await Promise.all([
        db.user.findFirst({ where: { tenantId, email }, select: { id: true } }),
        db.invitation.findFirst({
          where: { tenantId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
          select: { id: true },
        }),
        db.invitation.count({ where: { tenantId, createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
      ])
      if (existingUser || pending) {
        return res.status(409).json({ error: { code: 'DUPLICATE_EMAIL', message: 'Bu e-posta için kullanıcı ya da bekleyen davet zaten var.' } })
      }
      if (sentToday >= INVITES_PER_DAY) {
        return res.status(429).json({ error: { code: 'INVITE_LIMIT', message: 'Günlük davet sınırına ulaşıldı. Yarın tekrar deneyin.' } })
      }

      const { token, tokenHash } = newInviteToken()
      const expiresAt = new Date(now.getTime() + INVITE_TTL_MS)
      const invitation = await db.invitation.create({
        data: { tenantId, email, fullName, role: role as UserRole, title: title ?? null, invitedById: req.user!.userId, tokenHash, expiresAt },
        select: { id: true },
      })

      const link = inviteLink(token)
      const emailSent = await deliverLink(tenantId, { email, fullName, expiresAt }, link)
      return res.status(201).json({ id: invitation.id, link, expiresAt, emailSent })
    } catch (err) {
      next(err)
    }
  })

  router.get('/invitations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'staff.invite')) return
      const now = Date.now()
      const rows = await db.invitation.findMany({
        where: { tenantId: req.tenantId!, acceptedAt: null, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, fullName: true, role: true, title: true, expiresAt: true, createdAt: true },
      })
      return res.json({ data: rows.map((r) => ({ ...r, expired: r.expiresAt.getTime() <= now })) })
    } catch (err) {
      next(err)
    }
  })

  router.post('/invitations/:id/resend', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'staff.invite')) return
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Davet bulunamadı.' } })

      const existing = await db.invitation.findFirst({
        where: { id, tenantId, acceptedAt: null, revokedAt: null },
        select: { id: true, email: true, fullName: true },
      })
      if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Davet bulunamadı.' } })

      // Yeni token eskisini geçersiz kılar (hash değişir); süre yeniden 7 gün.
      const { token, tokenHash } = newInviteToken()
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
      await db.invitation.update({ where: { id: existing.id }, data: { tokenHash, expiresAt } })

      const link = inviteLink(token)
      const emailSent = await deliverLink(tenantId, { email: existing.email, fullName: existing.fullName, expiresAt }, link)
      return res.json({ id: existing.id, link, expiresAt, emailSent })
    } catch (err) {
      next(err)
    }
  })

  router.delete('/invitations/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'staff.invite')) return
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Davet bulunamadı.' } })

      const result = await db.invitation.updateMany({
        where: { id, tenantId: req.tenantId!, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      if (result.count === 0) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Davet bulunamadı.' } })
      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  return router
}

const acceptSchema = z.object({
  password: strongPassword,
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().regex(/^[0-9+\s()-]{7,20}$/, 'Geçerli bir telefon numarası girin.').optional(),
})

class InvitationGoneError extends Error {}

/** Herkese açık uçlar: bağlantıyı doğrula ve kabul et. IP başına 15 dakikada 20 istek. */
export function createPublicInvitationsRouter(options?: { limitMax?: number }): Router {
  const router = Router({ mergeParams: true })

  router.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: options?.limitMax ?? 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla istek gönderildi, lütfen biraz sonra tekrar deneyin.' } },
    }),
  )
  // Bağlantı adreste token taşır: yönlendirme başlığı ve önbellek kapalı.
  router.use((_req, res, next) => {
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  const findValid = (token: string) =>
    db.invitation.findFirst({
      where: { tokenHash: hashInviteToken(token), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { tenant: { select: { name: true, slug: true, settings: true } } },
    })

  router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invite = await findValid(req.params.token)
      if (!invite) return res.status(404).json(INVALID)
      return res.json({ tenantName: invite.tenant.name, role: invite.role, email: invite.email, fullName: invite.fullName, expiresAt: invite.expiresAt })
    } catch (err) {
      next(err)
    }
  })

  router.post('/:token/accept', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = acceptSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Geçersiz veri.' } })
      }
      const invite = await findValid(req.params.token)
      if (!invite) return res.status(404).json(INVALID)

      // Giriş e-postayla ve kiracısız yapılır: başka kiracıdaki aynı adres hesap karışmasına yol açar (S7).
      const taken = await db.user.findFirst({ where: { email: invite.email }, select: { id: true } })
      if (taken) {
        return res.status(409).json({ error: { code: 'INVITATION_EMAIL_IN_USE', message: 'Bu e-posta adresi başka bir hesapta kayıtlı.' } })
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 12)
      const tokenHash = hashInviteToken(req.params.token)
      const settings = invite.tenant.settings as { workingHours?: unknown } | null

      let user
      try {
        user = await db.$transaction(async (tx) => {
          // Koşullu kabul: yarışı kaybeden (count 0) kullanıcı oluşturamaz.
          const claimed = await tx.invitation.updateMany({
            where: { id: invite.id, tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
            data: { acceptedAt: new Date() },
          })
          if (claimed.count !== 1) throw new InvitationGoneError()

          // Rol, e-posta ve kiracı davetten gelir; gövdeden alınmaz.
          const created = await tx.user.create({
            data: {
              tenantId: invite.tenantId,
              email: invite.email,
              passwordHash,
              fullName: parsed.data.fullName ?? invite.fullName,
              phone: parsed.data.phone ?? null,
              role: invite.role,
            },
          })
          // Müdür ve resepsiyon takvimde randevu alan uzman değildir (A2): uzman profili yalnız 'staff' rolüne.
          if (invite.role === 'staff') {
            await tx.staffProfile.create({
              data: {
                userId: created.id,
                tenantId: invite.tenantId,
                title: invite.title ?? 'Uzman',
                workingHours: resolveTenantWorkingHours(settings?.workingHours) as Prisma.InputJsonValue,
              },
            })
          }
          await tx.invitation.update({ where: { id: invite.id }, data: { acceptedUserId: created.id } })
          return created
        })
      } catch (err) {
        if (err instanceof InvitationGoneError) return res.status(404).json(INVALID)
        if ((err as { code?: string }).code === 'P2002') {
          return res.status(409).json({ error: { code: 'INVITATION_EMAIL_IN_USE', message: 'Bu e-posta adresi başka bir hesapta kayıtlı.' } })
        }
        throw err
      }

      // Kabul oturumu açar; yanıt girişle aynıdır (S6).
      const session = await createSession(user.id, user.tenantId)
      const token = signAccessToken(
        requireJwtSecret(),
        { userId: user.id, tenantId: user.tenantId ?? undefined, tenantSlug: invite.tenant.slug, role: user.role },
        session.familyId,
      )
      setRefreshCookie(res, session.refreshToken)
      return res.json({ token, user: { id: user.id, email: user.email, name: user.fullName, role: user.role, tenantSlug: invite.tenant.slug } })
    } catch (err) {
      next(err)
    }
  })

  return router
}
