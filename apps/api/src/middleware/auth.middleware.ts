import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { db } from '../lib/db'

export interface JwtPayload {
  userId: string
  tenantId: string
  tenantSlug: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Token gerekli.' } })
    return
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token geçersiz veya süresi dolmuş.' } })
  }
}

export function requireTenantAccess(req: Request, res: Response, next: NextFunction): void {
  const { slug } = req.params
  if (!req.user || req.user.tenantSlug !== slug) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu tenant\'a erişim yetkiniz yok.' } })
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
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { isActive: true, trialEndsAt: true },
  })

  if (!tenant) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tenant bulunamadı.' } })
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
