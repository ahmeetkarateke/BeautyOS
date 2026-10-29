import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { db } from '../lib/db'
import { authenticateJWT, requireTenantAccess, checkTenantActive } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/permission'
import {
  approveOnlineRequest,
  findCustomerCandidates,
  rejectOnlineRequest,
  type ApproveResult,
  type DecisionResult,
} from '../lib/online-booking'

const idSchema = z.string().uuid()

// 'link' için customerId zorunlu; gövde yoksa eski davranış ('create').
const approveBodySchema = z
  .object({ customerAction: z.enum(['create', 'link']).optional(), customerId: z.string().uuid().optional() })
  .refine((v) => v.customerAction !== 'link' || v.customerId !== undefined, { message: 'link için customerId gerekli.' })

const MATCH_REQUIRED_MESSAGE = 'Bu telefonla kayıtlı bir müşteri var; eşleştirmeyi yeni panelden yapın.'

function respond(res: Response, id: string, status: 'confirmed' | 'cancelled', result: ApproveResult): void {
  if (result === 'ok') {
    res.json({ id, status })
  } else if (result === 'not_found') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
  } else if (result === 'not_pending') {
    res.status(409).json({ error: { code: 'NOT_PENDING', message: 'Bu talep artık onay beklemiyor.' } })
  } else if (result.result === 'match_required') {
    res.status(409).json({ error: { code: 'CUSTOMER_MATCH_REQUIRED', message: MATCH_REQUIRED_MESSAGE }, candidates: result.candidates })
  } else if (result.result === 'customer_not_found') {
    res.status(404).json({ error: { code: 'CUSTOMER_NOT_FOUND', message: 'Müşteri bulunamadı.' } })
  } else {
    res.status(409).json({ error: { code: 'CUSTOMER_PHONE_MISMATCH', message: 'Seçilen müşterinin telefonu talepteki telefonla eşleşmiyor.' } })
  }
}

/** Online talebi onaylama ve reddetme. Kimlik/kiraci/aktiflik kapilari rota basina baglanir (router tum /tenants/:slug yolunu paylasir). */
export function createAppointmentApprovalRouter(): Router {
  const router = Router({ mergeParams: true })
  const guards = [authenticateJWT, requireTenantAccess, checkTenantActive]

  router.patch('/appointments/:id/approve', ...guards, requirePermission('appointment.approve'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = idSchema.safeParse(req.params.id)
      const body = approveBodySchema.safeParse(req.body ?? {})
      if (!id.success || !body.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz randevu kimliği ya da müşteri seçimi.' } })
      }
      respond(res, id.data, 'confirmed', await approveOnlineRequest(req.tenantId!, id.data, body.data))
    } catch (err) {
      next(err)
    }
  })

  router.patch('/appointments/:id/reject', ...guards, requirePermission('appointment.approve'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = idSchema.safeParse(req.params.id)
      if (!id.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz randevu kimliği.' } })
      const result: DecisionResult = await rejectOnlineRequest(req.tenantId!, id.data, req.user!.userId)
      respond(res, id.data, 'cancelled', result)
    } catch (err) {
      next(err)
    }
  })

  // Doğrulanmamış talepte salonun bilinçli eşleştirme yapabilmesi için aday müşteriler (en çok 5).
  router.get('/appointments/:id/customer-candidates', ...guards, requirePermission('appointment.approve'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = idSchema.safeParse(req.params.id)
      if (!id.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz randevu kimliği.' } })
      const appointment = await db.appointment.findFirst({
        where: { id: id.data, tenantId: req.tenantId!, isDeleted: false },
        select: { customerId: true, requestedPhone: true },
      })
      if (!appointment) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
      const data = appointment.customerId || !appointment.requestedPhone ? [] : await findCustomerCandidates(req.tenantId!, appointment.requestedPhone)
      return res.json({ data })
    } catch (err) {
      next(err)
    }
  })

  return router
}
