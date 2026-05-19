import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { db } from '../lib/db'
import { authenticateJWT, requireTenantAccess, checkTenantActive } from '../middleware/auth.middleware'

const XSS_PATTERN = /<[^>]*>|javascript:/i

function noXss(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((v) => !XSS_PATTERN.test(v), { message: 'Geçersiz karakter içeriyor.' })
}

const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .url()
  .refine((v) => /^https:\/\//i.test(v), { message: 'Yalnızca https URL kabul edilir.' })

const ALLOWED_ROLES_READ = new Set(['owner', 'manager', 'staff'])
const ALLOWED_ROLES_WRITE = new Set(['owner', 'manager', 'staff'])

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

async function ensureCustomerInTenant(customerId: string, tenantId: string): Promise<boolean> {
  if (!isUuid(customerId)) return false
  const c = await db.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } })
  return !!c
}

export function createCustomerEnrichmentRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  // ─── HAIR FORMULAS ────────────────────────────────────────────────────────

  // GET /customers/:customerId/hair-formulas
  router.get('/customers/:customerId/hair-formulas', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!ALLOWED_ROLES_READ.has(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!
      const { customerId } = req.params

      if (!(await ensureCustomerInTenant(customerId, tenantId))) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      const items = await db.customerHairFormula.findMany({
        where: { tenantId, customerId },
        orderBy: { date: 'desc' },
      })

      const staffIds = items.map((i) => i.staffId).filter((v): v is string => !!v)
      const staffMap = new Map<string, string>()
      if (staffIds.length > 0) {
        const staff = await db.staffProfile.findMany({
          where: { id: { in: staffIds }, tenantId },
          select: { id: true, user: { select: { fullName: true } } },
        })
        for (const s of staff) staffMap.set(s.id, s.user.fullName)
      }

      return res.json(
        items.map((i) => ({
          id: i.id,
          date: i.date.toISOString(),
          formula: i.formula,
          brand: i.brand,
          processTime: i.processTime,
          result: i.result,
          staffId: i.staffId,
          staffName: i.staffId ? staffMap.get(i.staffId) ?? null : null,
        })),
      )
    } catch (err) {
      next(err)
    }
  })

  const createHairFormulaSchema = z.object({
    date: z.string().datetime().optional(),
    formula: noXss(1, 300),
    brand: noXss(1, 100).optional().nullable(),
    processTime: z.number().int().min(1).max(360).optional().nullable(),
    result: noXss(1, 500).optional().nullable(),
    staffId: z.string().uuid().optional().nullable(),
  })

  // POST /customers/:customerId/hair-formulas
  router.post('/customers/:customerId/hair-formulas', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!ALLOWED_ROLES_WRITE.has(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!
      const { customerId } = req.params

      if (!(await ensureCustomerInTenant(customerId, tenantId))) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      const parsed = createHairFormulaSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz formül verisi.' } })
      }

      const data = parsed.data

      if (data.staffId) {
        const staff = await db.staffProfile.findFirst({ where: { id: data.staffId, tenantId }, select: { id: true } })
        if (!staff) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Personel bulunamadı.' } })
        }
      }

      const created = await db.customerHairFormula.create({
        data: {
          tenantId,
          customerId,
          formula: data.formula,
          brand: data.brand ?? null,
          processTime: data.processTime ?? null,
          result: data.result ?? null,
          staffId: data.staffId ?? null,
          ...(data.date ? { date: new Date(data.date) } : {}),
        },
      })

      return res.status(201).json({
        id: created.id,
        date: created.date.toISOString(),
        formula: created.formula,
        brand: created.brand,
        processTime: created.processTime,
        result: created.result,
        staffId: created.staffId,
      })
    } catch (err) {
      next(err)
    }
  })

  const updateHairFormulaSchema = z.object({
    date: z.string().datetime().optional(),
    formula: noXss(1, 300).optional(),
    brand: noXss(1, 100).optional().nullable(),
    processTime: z.number().int().min(1).max(360).optional().nullable(),
    result: noXss(1, 500).optional().nullable(),
    staffId: z.string().uuid().optional().nullable(),
  })

  // PATCH /hair-formulas/:id
  router.patch('/hair-formulas/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!ALLOWED_ROLES_WRITE.has(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' } })
      }

      const existing = await db.customerHairFormula.findFirst({ where: { id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' } })
      }

      const parsed = updateHairFormulaSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz veri.' } })
      }
      const data = parsed.data

      if (data.staffId) {
        const staff = await db.staffProfile.findFirst({ where: { id: data.staffId, tenantId }, select: { id: true } })
        if (!staff) {
          return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Personel bulunamadı.' } })
        }
      }

      const updated = await db.customerHairFormula.update({
        where: { id },
        data: {
          ...(data.formula !== undefined ? { formula: data.formula } : {}),
          ...(data.brand !== undefined ? { brand: data.brand } : {}),
          ...(data.processTime !== undefined ? { processTime: data.processTime } : {}),
          ...(data.result !== undefined ? { result: data.result } : {}),
          ...(data.staffId !== undefined ? { staffId: data.staffId } : {}),
          ...(data.date ? { date: new Date(data.date) } : {}),
        },
      })

      return res.json({
        id: updated.id,
        date: updated.date.toISOString(),
        formula: updated.formula,
        brand: updated.brand,
        processTime: updated.processTime,
        result: updated.result,
        staffId: updated.staffId,
      })
    } catch (err) {
      next(err)
    }
  })

  // DELETE /hair-formulas/:id
  router.delete('/hair-formulas/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!ALLOWED_ROLES_WRITE.has(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' } })
      }

      const existing = await db.customerHairFormula.findFirst({ where: { id, tenantId }, select: { id: true } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' } })
      }

      await db.customerHairFormula.delete({ where: { id } })
      return res.status(204).send()
    } catch (err) {
      next(err)
    }
  })

  // ─── PHOTOS ───────────────────────────────────────────────────────────────

  // GET /customers/:customerId/photos?category=
  router.get('/customers/:customerId/photos', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!ALLOWED_ROLES_READ.has(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!
      const { customerId } = req.params

      if (!(await ensureCustomerInTenant(customerId, tenantId))) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      const categoryParam = typeof req.query.category === 'string' ? req.query.category.trim() : undefined
      const where = {
        tenantId,
        customerId,
        ...(categoryParam ? { category: categoryParam } : {}),
      }

      const items = await db.customerPhoto.findMany({
        where,
        orderBy: { takenAt: 'desc' },
      })

      return res.json(
        items.map((p) => ({
          id: p.id,
          url: p.url,
          caption: p.caption,
          category: p.category,
          takenAt: p.takenAt.toISOString(),
        })),
      )
    } catch (err) {
      next(err)
    }
  })

  const createPhotoSchema = z.object({
    url: httpsUrl,
    caption: noXss(1, 200).optional().nullable(),
    category: noXss(1, 50).optional().nullable(),
    takenAt: z.string().datetime().optional(),
  })

  // POST /customers/:customerId/photos
  router.post('/customers/:customerId/photos', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!ALLOWED_ROLES_WRITE.has(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!
      const { customerId } = req.params

      if (!(await ensureCustomerInTenant(customerId, tenantId))) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      const parsed = createPhotoSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz fotoğraf verisi.' } })
      }
      const data = parsed.data

      const created = await db.customerPhoto.create({
        data: {
          tenantId,
          customerId,
          url: data.url,
          caption: data.caption ?? null,
          category: data.category ?? null,
          ...(data.takenAt ? { takenAt: new Date(data.takenAt) } : {}),
        },
      })

      return res.status(201).json({
        id: created.id,
        url: created.url,
        caption: created.caption,
        category: created.category,
        takenAt: created.takenAt.toISOString(),
      })
    } catch (err) {
      next(err)
    }
  })

  // DELETE /photos/:id
  router.delete('/photos/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!ALLOWED_ROLES_WRITE.has(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Yetkiniz yok.' } })
      }
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fotoğraf bulunamadı.' } })
      }

      const existing = await db.customerPhoto.findFirst({ where: { id, tenantId }, select: { id: true } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fotoğraf bulunamadı.' } })
      }

      await db.customerPhoto.delete({ where: { id } })
      return res.status(204).send()
    } catch (err) {
      next(err)
    }
  })

  return router
}
