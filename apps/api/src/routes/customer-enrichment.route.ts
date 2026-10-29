import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { AnamnesisQuestionType } from '@prisma/client'
import { db } from '../lib/db'
import { ensurePermission } from '../middleware/permission'
import { canAccessCustomer } from '../lib/customer-scope'
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

const ALLOWED_ROLES_QUESTION_MANAGE = new Set(['owner', 'manager'])

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/** Musteri bu kiracida var ve (uzmansa) kendi musterisi mi? Aksi halde 404 doner, varligi sizdirmaz. */
async function ensureCustomerAccess(req: Request, customerId: string): Promise<boolean> {
  if (!isUuid(customerId)) return false
  return canAccessCustomer(req, customerId)
}

/** Cevap değerini soru tipine göre doğrular ve normalize eder. */
function validateAnswerValue(type: AnamnesisQuestionType, raw: unknown, options: unknown): unknown | null {
  if (raw === null || raw === undefined || raw === '') return null
  switch (type) {
    case AnamnesisQuestionType.short_text: {
      if (typeof raw !== 'string') return null
      const v = raw.trim()
      if (v.length === 0 || v.length > 500) return null
      if (XSS_PATTERN.test(v)) return null
      return v
    }
    case AnamnesisQuestionType.long_text: {
      if (typeof raw !== 'string') return null
      const v = raw.trim()
      if (v.length === 0 || v.length > 5000) return null
      if (XSS_PATTERN.test(v)) return null
      return v
    }
    case AnamnesisQuestionType.yes_no: {
      if (typeof raw === 'boolean') return raw
      if (raw === 'true') return true
      if (raw === 'false') return false
      return null
    }
    case AnamnesisQuestionType.number: {
      const n = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(n)) return null
      return n
    }
    case AnamnesisQuestionType.date: {
      if (typeof raw !== 'string') return null
      const d = new Date(raw)
      if (isNaN(d.getTime())) return null
      return d.toISOString()
    }
    case AnamnesisQuestionType.single_choice: {
      if (typeof raw !== 'string') return null
      const opts = Array.isArray(options) ? (options as unknown[]).filter((o): o is string => typeof o === 'string') : []
      if (!opts.includes(raw)) return null
      return raw
    }
    case AnamnesisQuestionType.multi_choice: {
      if (!Array.isArray(raw)) return null
      const opts = Array.isArray(options) ? (options as unknown[]).filter((o): o is string => typeof o === 'string') : []
      const filtered = (raw as unknown[]).filter((v): v is string => typeof v === 'string' && opts.includes(v))
      return filtered
    }
    default:
      return null
  }
}

export function createCustomerEnrichmentRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  // ═══ ANAMNESIS QUESTIONS (tenant-level definitions) ════════════════════════

  // GET /anamnesis-questions
  router.get('/anamnesis-questions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'health.view')) return
      const tenantId = req.tenantId!
      const includeInactive = req.query.includeInactive === 'true'
      const items = await db.anamnesisQuestion.findMany({
        where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: { order: 'asc' },
      })
      return res.json(items)
    } catch (err) { next(err) }
  })

  const createQuestionSchema = z.object({
    label: noXss(2, 300),
    type: z.nativeEnum(AnamnesisQuestionType),
    options: z.array(noXss(1, 100)).max(20).optional(),
    helperText: noXss(1, 500).optional().nullable(),
    isRequired: z.boolean().optional(),
    order: z.number().int().min(0).max(9999).optional(),
  })

  // POST /anamnesis-questions
  router.post('/anamnesis-questions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!ALLOWED_ROLES_QUESTION_MANAGE.has(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Sadece yönetici ekleyebilir.' } })
      }
      const tenantId = req.tenantId!
      const parsed = createQuestionSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz soru verisi.' } })
      }
      const data = parsed.data

      const choiceTypes: AnamnesisQuestionType[] = [AnamnesisQuestionType.single_choice, AnamnesisQuestionType.multi_choice]
      if (choiceTypes.includes(data.type) && (!data.options || data.options.length < 2)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Çoktan seçmeli sorular için en az 2 seçenek gerekli.' } })
      }

      // Order yoksa en sona ekle
      let order = data.order
      if (order === undefined) {
        const last = await db.anamnesisQuestion.findFirst({
          where: { tenantId }, orderBy: { order: 'desc' }, select: { order: true },
        })
        order = (last?.order ?? -1) + 1
      }

      const created = await db.anamnesisQuestion.create({
        data: {
          tenantId,
          label: data.label,
          type: data.type,
          options: data.options ?? undefined,
          helperText: data.helperText ?? null,
          isRequired: data.isRequired ?? false,
          isCustom: true,
          order,
        },
      })
      return res.status(201).json(created)
    } catch (err) { next(err) }
  })

  const updateQuestionSchema = z.object({
    label: noXss(2, 300).optional(),
    options: z.array(noXss(1, 100)).max(20).optional().nullable(),
    helperText: noXss(1, 500).optional().nullable(),
    isRequired: z.boolean().optional(),
    isActive: z.boolean().optional(),
    order: z.number().int().min(0).max(9999).optional(),
  })

  // PATCH /anamnesis-questions/:id
  router.patch('/anamnesis-questions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!ALLOWED_ROLES_QUESTION_MANAGE.has(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Sadece yönetici düzenleyebilir.' } })
      }
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Soru bulunamadı.' } })

      const existing = await db.anamnesisQuestion.findFirst({ where: { id, tenantId } })
      if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Soru bulunamadı.' } })

      const parsed = updateQuestionSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz veri.' } })
      }
      const data = parsed.data

      const updated = await db.anamnesisQuestion.update({
        where: { id },
        data: {
          ...(data.label !== undefined ? { label: data.label } : {}),
          ...(data.options !== undefined ? { options: data.options ?? undefined } : {}),
          ...(data.helperText !== undefined ? { helperText: data.helperText } : {}),
          ...(data.isRequired !== undefined ? { isRequired: data.isRequired } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.order !== undefined ? { order: data.order } : {}),
        },
      })
      return res.json(updated)
    } catch (err) { next(err) }
  })

  // DELETE /anamnesis-questions/:id (custom soruları siler; default ise sadece pasifleştirilir)
  router.delete('/anamnesis-questions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.user!.role
      if (!ALLOWED_ROLES_QUESTION_MANAGE.has(role)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Sadece yönetici silebilir.' } })
      }
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Soru bulunamadı.' } })

      const existing = await db.anamnesisQuestion.findFirst({ where: { id, tenantId }, select: { id: true, isCustom: true } })
      if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Soru bulunamadı.' } })

      if (existing.isCustom) {
        await db.anamnesisQuestion.delete({ where: { id } })
      } else {
        await db.anamnesisQuestion.update({ where: { id }, data: { isActive: false } })
      }
      return res.status(204).send()
    } catch (err) { next(err) }
  })

  // ═══ CUSTOMER ANAMNESIS ANSWERS ════════════════════════════════════════════

  // GET /customers/:customerId/anamnesis
  router.get('/customers/:customerId/anamnesis', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'health.view')) return
      const tenantId = req.tenantId!
      const { customerId } = req.params
      if (!(await ensureCustomerAccess(req, customerId))) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      const [questions, answers] = await Promise.all([
        db.anamnesisQuestion.findMany({
          where: { tenantId, isActive: true },
          orderBy: { order: 'asc' },
        }),
        db.customerAnamnesisAnswer.findMany({ where: { tenantId, customerId } }),
      ])

      const answerMap = new Map(answers.map((a) => [a.questionId, a]))

      return res.json({
        questions,
        answers: questions.map((q) => {
          const a = answerMap.get(q.id)
          return { questionId: q.id, value: a?.value ?? null, updatedAt: a?.updatedAt ?? null }
        }),
      })
    } catch (err) { next(err) }
  })

  const upsertAnswersSchema = z.object({
    answers: z.array(z.object({
      questionId: z.string().uuid(),
      value: z.unknown().nullable(),
    })).max(200),
  })

  // PUT /customers/:customerId/anamnesis
  router.put('/customers/:customerId/anamnesis', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'health.write')) return
      const tenantId = req.tenantId!
      const { customerId } = req.params
      if (!(await ensureCustomerAccess(req, customerId))) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      const parsed = upsertAnswersSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz cevap verisi.' } })
      }

      const questions = await db.anamnesisQuestion.findMany({
        where: { tenantId, id: { in: parsed.data.answers.map((a) => a.questionId) } },
      })
      const qMap = new Map(questions.map((q) => [q.id, q]))

      await db.$transaction(async (tx) => {
        for (const a of parsed.data.answers) {
          const q = qMap.get(a.questionId)
          if (!q) continue
          const normalized = validateAnswerValue(q.type, a.value, q.options)
          if (normalized === null) {
            // Boş/geçersiz → cevabı sil
            await tx.customerAnamnesisAnswer.deleteMany({ where: { tenantId, customerId, questionId: a.questionId } })
            continue
          }
          await tx.customerAnamnesisAnswer.upsert({
            where: { customerId_questionId: { customerId, questionId: a.questionId } },
            create: { tenantId, customerId, questionId: a.questionId, value: normalized as any },
            update: { value: normalized as any },
          })
        }
      })

      return res.status(204).send()
    } catch (err) { next(err) }
  })

  // ═══ PHOTOS ════════════════════════════════════════════════════════════════

  // GET /customers/:customerId/photos?category=
  router.get('/customers/:customerId/photos', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'customer.photo.view')) return
      const tenantId = req.tenantId!
      const { customerId } = req.params

      if (!(await ensureCustomerAccess(req, customerId))) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      }

      const categoryParam = typeof req.query.category === 'string' ? req.query.category.trim() : undefined
      const where = {
        tenantId,
        customerId,
        ...(categoryParam ? { category: categoryParam } : {}),
      }

      const items = await db.customerPhoto.findMany({ where, orderBy: { takenAt: 'desc' } })

      return res.json(
        items.map((p) => ({
          id: p.id,
          url: p.url,
          caption: p.caption,
          category: p.category,
          takenAt: p.takenAt.toISOString(),
        })),
      )
    } catch (err) { next(err) }
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
      if (!ensurePermission(req, res, 'customer.photo.write')) return
      const tenantId = req.tenantId!
      const { customerId } = req.params

      if (!(await ensureCustomerAccess(req, customerId))) {
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
    } catch (err) { next(err) }
  })

  // DELETE /photos/:id
  router.delete('/photos/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'customer.photo.write')) return
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fotoğraf bulunamadı.' } })
      }

      const existing = await db.customerPhoto.findFirst({ where: { id, tenantId }, select: { id: true, customerId: true } })
      if (!existing || !(await canAccessCustomer(req, existing.customerId))) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fotoğraf bulunamadı.' } })
      }

      await db.customerPhoto.delete({ where: { id } })
      return res.status(204).send()
    } catch (err) { next(err) }
  })

  return router
}
