import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { can, type PermissionKey } from '@beautyos/shared'

/** Kimligi dogrulanmis kullanicinin rolunun bu izne sahip olmasini zorunlu kilar; degilse 403. */
export function requirePermission(key: PermissionKey): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!can(req.user?.role, key)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
      return
    }
    next()
  }
}

/** Handler icinde kullanilan es deger: izin yoksa yaniti yazar ve false doner. */
export function ensurePermission(req: Request, res: Response, key: PermissionKey): boolean {
  if (can(req.user?.role, key)) return true
  res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
  return false
}
