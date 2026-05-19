import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, StockMovementType } from '@prisma/client'
import { db } from '../lib/db'
import { authenticateJWT, requireTenantAccess, checkTenantActive } from '../middleware/auth.middleware'
import { applyInventoryDeduction } from '../lib/inventory-deduction'

const UUID = z.string().uuid()

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createInventorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(60).nullable().optional(),
  quantity: z.number().int().min(0).max(1_000_000).optional(),
  lowStockThreshold: z.number().int().min(0).max(1_000_000).optional(),
  unitCost: z.number().min(0),
  sellingPrice: z.number().min(0).nullable().optional(),
  unit: z.string().trim().min(1).max(20).optional(),
})

const updateInventorySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  sku: z.string().trim().max(60).nullable().optional(),
  lowStockThreshold: z.number().int().min(0).max(1_000_000).optional(),
  unitCost: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).nullable().optional(),
  unit: z.string().trim().min(1).max(20).optional(),
})

const createMovementSchema = z.object({
  type: z.nativeEnum(StockMovementType),
  quantity: z.number().int().positive().max(1_000_000),
  unitCost: z.number().min(0).optional(),
  supplierId: UUID.nullable().optional(),
  notes: z.string().trim().max(500).optional(),
})

const createSupplierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
})

const updateSupplierSchema = createSupplierSchema.partial().extend({
  isActive: z.boolean().optional(),
})

const createRecipeSchema = z.object({
  inventoryId: UUID,
  quantityPerUse: z.number().positive().max(1_000_000),
  notes: z.string().trim().max(500).nullable().optional(),
})

const updateRecipeSchema = z.object({
  quantityPerUse: z.number().positive().max(1_000_000).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INCOMING_TYPES: StockMovementType[] = [
  StockMovementType.in,
  StockMovementType.adjustment_in,
  StockMovementType.transfer_in,
  StockMovementType.return,
]

function isIncoming(t: StockMovementType): boolean {
  return INCOMING_TYPES.includes(t)
}

function requireOwnerOrManager(req: Request, res: Response): boolean {
  const role = req.user!.role
  if (role !== 'owner' && role !== 'manager') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' } })
    return false
  }
  return true
}

type InventoryRow = {
  id: string
  name: string
  sku: string | null
  quantity: number
  lowStockThreshold: number
  unitCost: Prisma.Decimal
  sellingPrice: Prisma.Decimal | null
  unit: string
  updatedAt: Date
}

function serializeInventory(item: InventoryRow): {
  id: string
  name: string
  sku: string | null
  quantity: number
  currentStock: number
  lowStockThreshold: number
  unitCost: number
  sellingPrice: number | null
  unit: string
  updatedAt: Date
} {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    quantity: item.quantity,
    currentStock: item.quantity,
    lowStockThreshold: item.lowStockThreshold,
    unitCost: Number(item.unitCost),
    sellingPrice: item.sellingPrice !== null ? Number(item.sellingPrice) : null,
    unit: item.unit,
    updatedAt: item.updatedAt,
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function createStockRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  // ═══════════ INVENTORY ITEMS ════════════════════════════════════════════════

  // GET /inventory — list, with currentStock
  router.get('/inventory', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const items = await db.inventoryItem.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      })
      return res.json({ data: items.map(serializeInventory) })
    } catch (err) {
      next(err)
    }
  })

  // GET /inventory/low-stock — items where quantity <= lowStockThreshold
  router.get('/inventory/low-stock', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const rows = await db.$queryRaw<InventoryRow[]>`
        SELECT id, "tenantId", name, sku, quantity, "lowStockThreshold",
               "unitCost", "sellingPrice", unit, "updatedAt"
        FROM inventory
        WHERE "tenantId" = ${tenantId}::uuid
          AND quantity <= "lowStockThreshold"
        ORDER BY (quantity - "lowStockThreshold") ASC, name ASC
      `
      return res.json({ data: rows.map(serializeInventory) })
    } catch (err) {
      next(err)
    }
  })

  // POST /inventory — create item
  router.post('/inventory', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const parsed = createInventorySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz ürün verisi.' } })
      }
      const tenantId = req.tenantId!
      const item = await db.inventoryItem.create({
        data: {
          tenantId,
          name: parsed.data.name,
          sku: parsed.data.sku ?? null,
          quantity: parsed.data.quantity ?? 0,
          lowStockThreshold: parsed.data.lowStockThreshold ?? 5,
          unitCost: new Prisma.Decimal(parsed.data.unitCost),
          sellingPrice: parsed.data.sellingPrice !== undefined && parsed.data.sellingPrice !== null
            ? new Prisma.Decimal(parsed.data.sellingPrice)
            : null,
          unit: parsed.data.unit ?? 'adet',
        },
      })
      return res.status(201).json(serializeInventory(item))
    } catch (err) {
      next(err)
    }
  })

  // PATCH /inventory/:id
  router.patch('/inventory/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const parsed = updateInventorySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz ürün verisi.' } })
      }
      const tenantId = req.tenantId!
      const existing = await db.inventoryItem.findFirst({ where: { id: req.params.id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ürün bulunamadı.' } })
      }
      const data: Prisma.InventoryItemUpdateInput = {}
      if (parsed.data.name !== undefined) data.name = parsed.data.name
      if (parsed.data.sku !== undefined) data.sku = parsed.data.sku
      if (parsed.data.lowStockThreshold !== undefined) data.lowStockThreshold = parsed.data.lowStockThreshold
      if (parsed.data.unitCost !== undefined) data.unitCost = new Prisma.Decimal(parsed.data.unitCost)
      if (parsed.data.sellingPrice !== undefined) {
        data.sellingPrice = parsed.data.sellingPrice === null
          ? null
          : new Prisma.Decimal(parsed.data.sellingPrice)
      }
      if (parsed.data.unit !== undefined) data.unit = parsed.data.unit
      const updated = await db.inventoryItem.update({ where: { id: existing.id }, data })
      return res.json(serializeInventory(updated))
    } catch (err) {
      next(err)
    }
  })

  // DELETE /inventory/:id — hard delete if no movements/recipes, otherwise refuse
  router.delete('/inventory/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const tenantId = req.tenantId!
      const existing = await db.inventoryItem.findFirst({ where: { id: req.params.id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ürün bulunamadı.' } })
      }
      const [movementCount, recipeCount] = await Promise.all([
        db.stockMovement.count({ where: { inventoryId: existing.id } }),
        db.serviceInventoryRecipe.count({ where: { inventoryId: existing.id } }),
      ])
      if (movementCount > 0 || recipeCount > 0) {
        return res.status(409).json({
          error: {
            code: 'CONFLICT',
            message: 'Bu ürünün hareketi veya reçete bağlantısı var, silinemez. Önce hareketleri ve reçeteleri kaldırın.',
          },
        })
      }
      await db.inventoryItem.delete({ where: { id: existing.id } })
      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  // ═══════════ STOCK MOVEMENTS ═════════════════════════════════════════════════

  // GET /inventory/:itemId/movements?type=&from=&to=
  router.get('/inventory/:itemId/movements', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const { itemId } = req.params
      const item = await db.inventoryItem.findFirst({ where: { id: itemId, tenantId } })
      if (!item) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ürün bulunamadı.' } })
      }

      const typeFilter = req.query.type as string | undefined
      const fromStr = req.query.from as string | undefined
      const toStr = req.query.to as string | undefined

      const where: Prisma.StockMovementWhereInput = { tenantId, inventoryId: itemId }
      if (typeFilter) {
        const parsedType = z.nativeEnum(StockMovementType).safeParse(typeFilter)
        if (parsedType.success) where.type = parsedType.data
      }
      if (fromStr || toStr) {
        where.occurredAt = {}
        if (fromStr) where.occurredAt.gte = new Date(fromStr)
        if (toStr) where.occurredAt.lte = new Date(toStr)
      }

      const movements = await db.stockMovement.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
        },
        take: 500,
      })

      return res.json({
        data: movements.map((m) => ({
          id: m.id,
          inventoryId: m.inventoryId,
          type: m.type,
          quantity: m.quantity,
          unitCost: m.unitCost !== null ? Number(m.unitCost) : null,
          totalCost: m.totalCost !== null ? Number(m.totalCost) : null,
          supplierId: m.supplierId,
          supplier: m.supplier,
          appointmentId: m.appointmentId,
          notes: m.notes,
          performedBy: m.performedBy,
          occurredAt: m.occurredAt,
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  // POST /inventory/:itemId/movements — record movement, adjust quantity atomically
  router.post('/inventory/:itemId/movements', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const parsed = createMovementSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz hareket verisi.' } })
      }
      const tenantId = req.tenantId!
      const { itemId } = req.params
      const { type, quantity, unitCost, supplierId, notes } = parsed.data

      const item = await db.inventoryItem.findFirst({ where: { id: itemId, tenantId } })
      if (!item) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ürün bulunamadı.' } })
      }

      if (supplierId) {
        const sup = await db.supplier.findFirst({ where: { id: supplierId, tenantId } })
        if (!sup) {
          return res.status(400).json({ error: { code: 'INVALID_SUPPLIER', message: 'Tedarikçi bulunamadı.' } })
        }
      }

      const delta = isIncoming(type) ? quantity : -quantity
      if (!isIncoming(type) && item.quantity + delta < 0) {
        return res.status(400).json({
          error: { code: 'INSUFFICIENT_STOCK', message: 'Yetersiz stok. Çıkış miktarı mevcut stoktan büyük.' },
        })
      }

      const result = await db.$transaction(async (tx) => {
        const updated = await tx.inventoryItem.update({
          where: { id: itemId },
          data: { quantity: { increment: delta } },
        })
        const movement = await tx.stockMovement.create({
          data: {
            tenantId,
            inventoryId: itemId,
            type,
            quantity,
            unitCost: unitCost !== undefined ? new Prisma.Decimal(unitCost) : null,
            totalCost: unitCost !== undefined ? new Prisma.Decimal(unitCost).mul(quantity) : null,
            supplierId: supplierId ?? null,
            notes: notes ?? null,
            performedBy: req.user!.userId,
          },
        })
        return { movement, updated }
      })

      return res.status(201).json({
        movement: {
          id: result.movement.id,
          type: result.movement.type,
          quantity: result.movement.quantity,
          unitCost: result.movement.unitCost !== null ? Number(result.movement.unitCost) : null,
          totalCost: result.movement.totalCost !== null ? Number(result.movement.totalCost) : null,
          supplierId: result.movement.supplierId,
          notes: result.movement.notes,
          occurredAt: result.movement.occurredAt,
        },
        item: serializeInventory(result.updated),
      })
    } catch (err) {
      next(err)
    }
  })

  // DELETE /movements/:id — only the latest movement for that item
  router.delete('/movements/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const tenantId = req.tenantId!
      const movement = await db.stockMovement.findFirst({ where: { id: req.params.id, tenantId } })
      if (!movement) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hareket bulunamadı.' } })
      }

      const latest = await db.stockMovement.findFirst({
        where: { tenantId, inventoryId: movement.inventoryId },
        orderBy: { occurredAt: 'desc' },
        select: { id: true },
      })
      if (!latest || latest.id !== movement.id) {
        return res.status(409).json({
          error: { code: 'NOT_LATEST', message: 'Yalnızca son hareket silinebilir.' },
        })
      }

      const reverseDelta = isIncoming(movement.type) ? -movement.quantity : movement.quantity

      await db.$transaction(async (tx) => {
        await tx.inventoryItem.update({
          where: { id: movement.inventoryId },
          data: { quantity: { increment: reverseDelta } },
        })
        await tx.stockMovement.delete({ where: { id: movement.id } })
      })

      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  // ═══════════ SUPPLIERS ═══════════════════════════════════════════════════════

  router.get('/suppliers', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const includeInactive = req.query.includeInactive === 'true'
      const suppliers = await db.supplier.findMany({
        where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: { name: 'asc' },
      })
      return res.json({ data: suppliers })
    } catch (err) {
      next(err)
    }
  })

  router.post('/suppliers', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const parsed = createSupplierSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz tedarikçi verisi.' } })
      }
      const tenantId = req.tenantId!
      const supplier = await db.supplier.create({
        data: {
          tenantId,
          name: parsed.data.name,
          phone: parsed.data.phone ?? null,
          email: parsed.data.email ?? null,
          notes: parsed.data.notes ?? null,
        },
      })
      return res.status(201).json(supplier)
    } catch (err) {
      next(err)
    }
  })

  router.patch('/suppliers/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const parsed = updateSupplierSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz tedarikçi verisi.' } })
      }
      const tenantId = req.tenantId!
      const existing = await db.supplier.findFirst({ where: { id: req.params.id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tedarikçi bulunamadı.' } })
      }
      const updated = await db.supplier.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
          ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        },
      })
      return res.json(updated)
    } catch (err) {
      next(err)
    }
  })

  router.delete('/suppliers/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const tenantId = req.tenantId!
      const existing = await db.supplier.findFirst({ where: { id: req.params.id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tedarikçi bulunamadı.' } })
      }
      await db.supplier.update({ where: { id: existing.id }, data: { isActive: false } })
      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  // ═══════════ SERVICE INVENTORY RECIPES ═══════════════════════════════════════

  router.get('/services/:serviceId/inventory-recipes', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.tenantId!
      const { serviceId } = req.params
      const service = await db.service.findFirst({ where: { id: serviceId, tenantId } })
      if (!service) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
      }
      const recipes = await db.serviceInventoryRecipe.findMany({
        where: { tenantId, serviceId },
        include: {
          inventory: { select: { id: true, name: true, unit: true, quantity: true, lowStockThreshold: true } },
        },
        orderBy: { isActive: 'desc' },
      })
      return res.json({
        data: recipes.map((r) => ({
          id: r.id,
          serviceId: r.serviceId,
          inventoryId: r.inventoryId,
          inventory: r.inventory,
          quantityPerUse: Number(r.quantityPerUse),
          notes: r.notes,
          isActive: r.isActive,
          createdAt: r.createdAt,
        })),
      })
    } catch (err) {
      next(err)
    }
  })

  router.post('/services/:serviceId/inventory-recipes', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const parsed = createRecipeSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz reçete verisi.' } })
      }
      const tenantId = req.tenantId!
      const { serviceId } = req.params

      const [service, inventory] = await Promise.all([
        db.service.findFirst({ where: { id: serviceId, tenantId } }),
        db.inventoryItem.findFirst({ where: { id: parsed.data.inventoryId, tenantId } }),
      ])
      if (!service) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hizmet bulunamadı.' } })
      if (!inventory) return res.status(400).json({ error: { code: 'INVALID_INVENTORY', message: 'Ürün bulunamadı.' } })

      try {
        const recipe = await db.serviceInventoryRecipe.create({
          data: {
            tenantId,
            serviceId,
            inventoryId: parsed.data.inventoryId,
            quantityPerUse: new Prisma.Decimal(parsed.data.quantityPerUse),
            notes: parsed.data.notes ?? null,
          },
        })
        return res.status(201).json({
          ...recipe,
          quantityPerUse: Number(recipe.quantityPerUse),
        })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          return res.status(409).json({ error: { code: 'CONFLICT', message: 'Bu ürün zaten hizmete bağlı.' } })
        }
        throw e
      }
    } catch (err) {
      next(err)
    }
  })

  router.patch('/inventory-recipes/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const parsed = updateRecipeSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz reçete verisi.' } })
      }
      const tenantId = req.tenantId!
      const existing = await db.serviceInventoryRecipe.findFirst({ where: { id: req.params.id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reçete bulunamadı.' } })
      }
      const updated = await db.serviceInventoryRecipe.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.quantityPerUse !== undefined
            ? { quantityPerUse: new Prisma.Decimal(parsed.data.quantityPerUse) }
            : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        },
      })
      return res.json({ ...updated, quantityPerUse: Number(updated.quantityPerUse) })
    } catch (err) {
      next(err)
    }
  })

  router.delete('/inventory-recipes/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const tenantId = req.tenantId!
      const existing = await db.serviceInventoryRecipe.findFirst({ where: { id: req.params.id, tenantId } })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reçete bulunamadı.' } })
      }
      await db.serviceInventoryRecipe.update({ where: { id: existing.id }, data: { isActive: false } })
      return res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  // ═══════════ MANUAL DEDUCTION TRIGGER ════════════════════════════════════════

  router.post('/appointments/:appointmentId/deduct-inventory', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireOwnerOrManager(req, res)) return
      const tenantId = req.tenantId!
      const { appointmentId } = req.params
      const appointment = await db.appointment.findFirst({ where: { id: appointmentId, tenantId } })
      if (!appointment) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Randevu bulunamadı.' } })
      }

      const result = await db.$transaction(async (tx) => {
        return applyInventoryDeduction(tx, appointmentId, req.user!.userId)
      })

      return res.json(result)
    } catch (err) {
      next(err)
    }
  })

  return router
}
