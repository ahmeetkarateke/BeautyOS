import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { db } from '../lib/db'
import { getSlots } from '../lib/slots'

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Çok fazla istek gönderildi, lütfen 1 dakika sonra tekrar deneyin.' } },
})

export function createPublicRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(publicLimiter)

  // GET /api/v1/tenants/:slug/public/services
  router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params

      const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } })
      if (!tenant) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Salon bulunamadı.' } })
      }

      const services = await db.service.findMany({
        where: { tenantId: tenant.id, isActive: true, isOnlineBookable: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, durationMinutes: true, category: true },
      })

      return res.json({
        data: services.map((s) => ({
          id: s.id,
          name: s.name,
          durationMinutes: s.durationMinutes,
          category: s.category ?? null,
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/v1/tenants/:slug/public/slots?serviceId=UUID&staffId=UUID&date=YYYY-MM-DD
  const slotsQuerySchema = z.object({
    serviceId: z.string().uuid(),
    staffId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })

  router.get('/slots', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = slotsQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'serviceId, staffId ve date (YYYY-MM-DD) zorunludur.' } })
      }

      const { serviceId, staffId, date } = parsed.data
      const { slug } = req.params

      const tenant = await db.tenant.findUnique({ where: { slug }, select: { id: true } })
      if (!tenant) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Salon bulunamadı.' } })
      }

      const slots = await getSlots({ tenantId: tenant.id, serviceId, staffId, date })
      return res.json({ date, slots })
    } catch (err) {
      next(err)
    }
  })

  return router
}
