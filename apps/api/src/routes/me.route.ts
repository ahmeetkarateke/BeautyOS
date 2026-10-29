import { Router, type Request, type Response, type NextFunction } from 'express'
import { isRole } from '@beautyos/shared'
import { db } from '../lib/db'
import { authenticateJWT } from '../middleware/auth.middleware'
import { buildMeProfile } from '../lib/me-profile'
import { resolveBookingMode } from '../lib/booking-mode'

/**
 * GET /api/v1/auth/me — oturumdaki kullanicinin rolu, etkin izinleri ve kiraci bilgisi (A1).
 * Kiraci bilgisi yalniz kullanicinin DB'deki kendi kiracisindan okunur; JWT'deki tenantId kullanici kaydiyla
 * uyusmuyorsa 401 doner. Kimlik dogrulama hiz siniri (authLimiter) disinda baglanir: arayuz her sayfa acilisinda cagirir.
 */
export function createMeRouter(): Router {
  const router = Router()

  router.get('/', authenticateJWT, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, tenantId } = req.user!
      const user = tenantId
        ? await db.user.findFirst({
            where: { id: userId, tenantId, isActive: true },
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
              staffProfile: { select: { id: true } },
              tenant: { select: { slug: true, name: true, businessType: true, settings: true } },
            },
          })
        : null

      if (!user || !user.tenant || !isRole(user.role)) {
        return res.status(401).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'Hesap aktif değil, lütfen yeniden giriş yapın.' } })
      }

      return res.json(
        buildMeProfile({
          user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
          tenant: user.tenant,
          staffId: user.staffProfile?.id ?? null,
          bookingMode: resolveBookingMode().bookingMode,
        }),
      )
    } catch (err) {
      next(err)
    }
  })

  return router
}
