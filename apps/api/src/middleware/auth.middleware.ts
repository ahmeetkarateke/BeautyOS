import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

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
