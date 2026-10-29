import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { authenticateJWT, requireTenantAccess, checkTenantActive } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission'
import { approveOnlineRequest, rejectOnlineRequest, type DecisionResult } from '../lib/online-booking'

const idSchema = z.string().uuid()

function respond(res: Response, id: string, status: 'confirmed' | 'cancelled', result: DecisionResult): void {
  if (result === 'ok') {
    res.json({ id, status })
  } else if (result === 'not_found') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
  } else {
    res.status(409).json({ error: { code: 'NOT_PENDING', message: 'Bu talep artık onay beklemiyor.' } })
  }
}

/** Online talebi onaylama ve reddetme. Kimlik/kiraci/aktiflik kapilari rota basina baglanir (router tum /tenants/:slug yolunu paylasir). */
export function createAppointmentApprovalRouter(): Router {
  const router = Router({ mergeParams: true })
  const guards = [authenticateJWT, requireTenantAccess, checkTenantActive]

  router.patch('/appointments/:id/approve', ...guards, requirePermission('appointment.approve'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = idSchema.safeParse(req.params.id)
      if (!id.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz randevu kimliği.' } })
      respond(res, id.data, 'confirmed', await approveOnlineRequest(req.tenantId!, id.data))
    } catch (err) {
      next(err)
    }
  })

  router.patch('/appointments/:id/reject', ...guards, requirePermission('appointment.approve'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = idSchema.safeParse(req.params.id)
      if (!id.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz randevu kimliği.' } })
      respond(res, id.data, 'cancelled', await rejectOnlineRequest(req.tenantId!, id.data, req.user!.userId))
    } catch (err) {
      next(err)
    }
  })

  return router
}
