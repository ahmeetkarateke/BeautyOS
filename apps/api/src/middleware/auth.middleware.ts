import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { db } from '../lib/db'
import { isRole, type Role } from '@beautyos/shared'
import { isSessionLive } from '../lib/sessions'

export interface JwtPayload {
  userId: string
  tenantId?: string
  tenantSlug?: string
  role: Role
  /** Oturum ailesi (S6). Geçiş döneminde eski token'larda yoktur. */
  sid?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
      tenantId?: string
    }
  }
}

/**
 * Erişim token'ı imzayla birlikte her istekte durumla doğrulanır (S6 K3): kullanıcı hâlâ aktif mi ve (sid varsa) oturum ailesi iptal edilmemiş mi.
 * sid taşımayan (geçiş dönemi) token yalnız kullanıcı aktifliğine bakılarak geçer; en çok 15 dakika yaşar.
 */
export async function authenticateJWT(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token gerekli.' } })
    return
  }

  const token = authHeader.slice(7)
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    res.status(500).json({ error: { code: 'CONFIG_ERROR', message: 'Sunucu yapılandırma hatası.' } })
    return
  }
  let verified: JwtPayload
  try {
    const payload = jwt.verify(token, secret) as JwtPayload
    // Bilinmeyen rol iddia eden token (ornegin eski/elle uretilmis) izin tablosuna hic ulasmadan reddedilir.
    if (!isRole(payload.role)) {
      res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token geçersiz veya süresi dolmuş.' } })
      return
    }
    verified = payload
  } catch {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token geçersiz veya süresi dolmuş.' } })
    return
  }

  try {
    const [user, live] = await Promise.all([
      db.user.findFirst({
        where: { id: verified.userId, isActive: true, ...(verified.tenantId ? { tenantId: verified.tenantId } : {}) },
        select: { id: true },
      }),
      verified.sid ? isSessionLive(verified.sid) : Promise.resolve(true),
    ])
    if (!user) {
      res.status(401).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'Hesap aktif değil, lütfen yeniden giriş yapın.' } })
      return
    }
    if (!live) {
      res.status(401).json({ error: { code: 'SESSION_REVOKED', message: 'Oturum sonlandırıldı, lütfen yeniden giriş yapın.' } })
      return
    }
    req.user = verified
    next()
  } catch (err) {
    next(err)
  }
}

export function requireTenantAccess(req: Request, res: Response, next: NextFunction): void {
  const { slug } = req.params
  if (!req.user || req.user.tenantSlug !== slug || !req.user.tenantId) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu tenant\'a erişim yetkiniz yok.' } })
    return
  }
  req.tenantId = req.user.tenantId
  next()
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'superadmin') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Süper admin yetkisi gerekli.' } })
    return
  }
  next()
}

export async function checkTenantActive(req: Request, res: Response, next: NextFunction): Promise<void> {
  // GET /settings is exempt so owners can still see account status
  if (req.method === 'GET' && req.path === '/settings') {
    next()
    return
  }

  const tenantId = req.user!.tenantId
  if (!tenantId) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Tenant erişimi gerekli.' } })
    return
  }
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { isActive: true, trialEndsAt: true },
  })

  if (!tenant) {
    // Token'daki tenantId DB'de yoksa (tenant silinmiş vb.) — 401 dön ki
    // frontend auto-logout/refresh denesin. 404 dönmek sonsuz retry'a sebep
    // oluyordu (donma sebebi).
    res.status(401).json({ error: { code: 'TENANT_DELETED', message: 'Hesap aktif değil, lütfen yeniden giriş yapın.' } })
    return
  }

  const now = new Date()

  if (tenant.trialEndsAt && tenant.trialEndsAt < now && tenant.isActive) {
    await db.tenant.update({ where: { id: tenantId }, data: { isActive: false } })
    res.status(402).json({ error: { code: 'SUBSCRIPTION_REQUIRED', message: 'Trial süreniz dolmuş. Lütfen bir plan seçin.' } })
    return
  }

  if (!tenant.isActive) {
    res.status(402).json({ error: { code: 'SUBSCRIPTION_REQUIRED', message: 'Aboneliğiniz aktif değil. Lütfen bir plan seçin.' } })
    return
  }

  next()
}
