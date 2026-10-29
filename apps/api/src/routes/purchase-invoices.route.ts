import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import {
  Prisma,
  PurchaseInvoiceStatus,
  CurrentAccountPartyType,
  CurrentAccountEntryRefType,
  StockMovementType,
} from '@prisma/client'
import { db } from '../lib/db'
import { ensurePermission } from '../middleware/permission'
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


function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

const itemSchema = z.object({
  inventoryId: z.string().uuid().nullable().optional(),
  name: noXss(1, 200),
  quantity: z.number().int().min(1).max(100000),
  unitPrice: z.number().min(0).max(99999999),
  taxRate: z.number().min(0).max(100).default(0),
  discount: z.number().min(0).max(99999999).default(0),
})

const createInvoiceSchema = z.object({
  supplierId: z.string().uuid(),
  invoiceNumber: noXss(1, 50).optional().nullable(),
  invoiceDate: z.string(),
  dueDate: z.string().optional().nullable(),
  notes: noXss(1, 1000).optional().nullable(),
  items: z.array(itemSchema).min(1).max(200),
  post: z.boolean().optional(), // true ise direkt muhasebeleştir
})

function computeItemTotals(item: z.infer<typeof itemSchema>) {
  const gross = item.quantity * item.unitPrice
  const afterDiscount = Math.max(0, gross - item.discount)
  const tax = (afterDiscount * item.taxRate) / 100
  const total = afterDiscount + tax
  return {
    afterDiscount,
    tax,
    total,
  }
}

function aggregateTotals(items: z.infer<typeof itemSchema>[]) {
  let subtotal = 0
  let taxTotal = 0
  let discountTotal = 0
  let total = 0
  for (const item of items) {
    const { afterDiscount, tax, total: lineTotal } = computeItemTotals(item)
    subtotal += afterDiscount
    taxTotal += tax
    discountTotal += item.discount
    total += lineTotal
  }
  return { subtotal, taxTotal, discountTotal, total }
}

/**
 * Bir alış faturasını "post" eder:
 *  - Inventory bağlı kalemler için stok girişi (StockMovement type=in)
 *  - InventoryItem.quantity artırılır
 *  - Ağırlıklı ortalama maliyet güncellenir
 *  - Tedarikçi cari hesabına alacak (credit) kaydı atılır
 * Bu fonksiyon transaction içinde çağrılmalıdır.
 */
async function postInvoiceTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  tenantId: string,
  userId?: string,
) {
  const invoice = await tx.purchaseInvoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { items: true, supplier: { select: { name: true } } },
  })
  if (!invoice) throw new Error('NOT_FOUND')
  if (invoice.status !== PurchaseInvoiceStatus.draft) {
    throw new Error('ALREADY_POSTED')
  }

  // 1) Stok hareketi + inventory güncelle
  for (const item of invoice.items) {
    if (!item.inventoryId) continue
    const inv = await tx.inventoryItem.findFirst({
      where: { id: item.inventoryId, tenantId },
      select: { id: true, quantity: true, unitCost: true },
    })
    if (!inv) continue

    const newQty = inv.quantity + item.quantity
    // Ağırlıklı ortalama maliyet
    const oldValue = Number(inv.unitCost) * inv.quantity
    const newValue = Number(item.unitPrice) * item.quantity
    const avgCost = newQty > 0 ? (oldValue + newValue) / newQty : Number(item.unitPrice)

    await tx.inventoryItem.update({
      where: { id: inv.id },
      data: {
        quantity: newQty,
        unitCost: new Prisma.Decimal(avgCost.toFixed(2)),
      },
    })

    await tx.stockMovement.create({
      data: {
        tenantId,
        inventoryId: inv.id,
        type: StockMovementType.in,
        quantity: item.quantity,
        unitCost: new Prisma.Decimal(item.unitPrice),
        totalCost: new Prisma.Decimal(Number(item.total)),
        supplierId: invoice.supplierId,
        performedBy: userId,
        notes: `Alış faturası ${invoice.invoiceNumber ?? '#' + invoice.id.slice(0, 8)}`,
      },
    })
  }

  // 2) Tedarikçi cari — borç (biz tedarikçiye borçlandık; açık hesap büyür)
  // Konvansiyon: debit = açık hesap artışı (her iki cari tipi için)
  await tx.currentAccountEntry.create({
    data: {
      tenantId,
      partyType: CurrentAccountPartyType.supplier,
      supplierId: invoice.supplierId,
      date: invoice.invoiceDate,
      debit: invoice.total,
      credit: new Prisma.Decimal(0),
      description: `Alış faturası ${invoice.invoiceNumber ?? '#' + invoice.id.slice(0, 8)}`,
      referenceType: CurrentAccountEntryRefType.purchase_invoice,
      referenceId: invoice.id,
      createdBy: userId,
    },
  })

  await tx.purchaseInvoice.update({
    where: { id: invoiceId },
    data: { status: PurchaseInvoiceStatus.posted, postedAt: new Date() },
  })
}

/** Posted faturayı tersine çevirir: stoğu geri al, cari hareketini iptal kaydıyla kapat. */
async function cancelPostedInvoiceTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  tenantId: string,
  userId?: string,
) {
  const invoice = await tx.purchaseInvoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { items: true },
  })
  if (!invoice) throw new Error('NOT_FOUND')
  if (invoice.status !== PurchaseInvoiceStatus.posted) throw new Error('NOT_POSTED')

  // 1) Stok geri çekimi
  for (const item of invoice.items) {
    if (!item.inventoryId) continue
    const inv = await tx.inventoryItem.findFirst({
      where: { id: item.inventoryId, tenantId },
      select: { id: true, quantity: true },
    })
    if (!inv) continue
    const newQty = Math.max(0, inv.quantity - item.quantity)
    await tx.inventoryItem.update({
      where: { id: inv.id },
      data: { quantity: newQty },
    })
    await tx.stockMovement.create({
      data: {
        tenantId,
        inventoryId: inv.id,
        type: StockMovementType.return,
        quantity: item.quantity,
        unitCost: new Prisma.Decimal(item.unitPrice),
        totalCost: new Prisma.Decimal(Number(item.total)),
        supplierId: invoice.supplierId,
        performedBy: userId,
        notes: `Alış faturası iptali ${invoice.invoiceNumber ?? '#' + invoice.id.slice(0, 8)}`,
      },
    })
  }

  // 2) Cari hesap iptal kaydı (alacak tarafına yaz → orijinal borçu kapatır)
  await tx.currentAccountEntry.create({
    data: {
      tenantId,
      partyType: CurrentAccountPartyType.supplier,
      supplierId: invoice.supplierId,
      date: new Date(),
      debit: new Prisma.Decimal(0),
      credit: invoice.total,
      description: `Alış faturası iptali ${invoice.invoiceNumber ?? '#' + invoice.id.slice(0, 8)}`,
      referenceType: CurrentAccountEntryRefType.adjustment,
      referenceId: invoice.id,
      createdBy: userId,
    },
  })

  await tx.purchaseInvoice.update({
    where: { id: invoiceId },
    data: { status: PurchaseInvoiceStatus.cancelled },
  })
}

export function createPurchaseInvoicesRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  // ─── GET /purchase-invoices ─────────────────────────────────────────────────
  router.get('/purchase-invoices', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'purchase_invoice.read')) return
      const tenantId = req.tenantId!

      const status = typeof req.query.status === 'string' ? req.query.status : undefined
      const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined
      const from = typeof req.query.from === 'string' ? req.query.from : undefined
      const to = typeof req.query.to === 'string' ? req.query.to : undefined

      const items = await db.purchaseInvoice.findMany({
        where: {
          tenantId,
          ...(status && ['draft', 'posted', 'cancelled'].includes(status)
            ? { status: status as PurchaseInvoiceStatus }
            : {}),
          ...(supplierId && isUuid(supplierId) ? { supplierId } : {}),
          ...(from || to
            ? {
                invoiceDate: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to) } : {}),
                },
              }
            : {}),
        },
        include: { supplier: { select: { name: true } } },
        orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      })

      return res.json({
        data: items.map((i) => ({
          id: i.id,
          supplierId: i.supplierId,
          supplierName: i.supplier.name,
          invoiceNumber: i.invoiceNumber,
          invoiceDate: i.invoiceDate.toISOString(),
          dueDate: i.dueDate?.toISOString() ?? null,
          status: i.status,
          subtotal: Number(i.subtotal),
          taxTotal: Number(i.taxTotal),
          discountTotal: Number(i.discountTotal),
          total: Number(i.total),
        })),
      })
    } catch (err) { next(err) }
  })

  // ─── GET /purchase-invoices/:id ─────────────────────────────────────────────
  router.get('/purchase-invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'purchase_invoice.read')) return
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fatura bulunamadı.' } })

      const invoice = await db.purchaseInvoice.findFirst({
        where: { id, tenantId },
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          items: { include: { inventory: { select: { id: true, name: true, unit: true } } } },
        },
      })
      if (!invoice) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fatura bulunamadı.' } })

      return res.json({
        id: invoice.id,
        supplier: invoice.supplier,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate.toISOString(),
        dueDate: invoice.dueDate?.toISOString() ?? null,
        status: invoice.status,
        subtotal: Number(invoice.subtotal),
        taxTotal: Number(invoice.taxTotal),
        discountTotal: Number(invoice.discountTotal),
        total: Number(invoice.total),
        notes: invoice.notes,
        postedAt: invoice.postedAt?.toISOString() ?? null,
        items: invoice.items.map((it) => ({
          id: it.id,
          inventoryId: it.inventoryId,
          inventoryName: it.inventory?.name ?? null,
          inventoryUnit: it.inventory?.unit ?? null,
          name: it.name,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          taxRate: Number(it.taxRate),
          discount: Number(it.discount),
          total: Number(it.total),
        })),
      })
    } catch (err) { next(err) }
  })

  // ─── POST /purchase-invoices ────────────────────────────────────────────────
  router.post('/purchase-invoices', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'purchase_invoice.write')) return
      const tenantId = req.tenantId!
      const userId = req.user!.userId

      const parsed = createInvoiceSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Geçersiz fatura verisi.' },
        })
      }
      const data = parsed.data

      const supplier = await db.supplier.findFirst({
        where: { id: data.supplierId, tenantId }, select: { id: true },
      })
      if (!supplier) return res.status(400).json({ error: { code: 'INVALID_SUPPLIER', message: 'Tedarikçi bulunamadı.' } })

      // Inventory id'leri doğrula
      const invIds = Array.from(new Set(data.items.map((i) => i.inventoryId).filter((v): v is string => !!v)))
      if (invIds.length > 0) {
        const found = await db.inventoryItem.findMany({
          where: { id: { in: invIds }, tenantId }, select: { id: true },
        })
        if (found.length !== invIds.length) {
          return res.status(400).json({ error: { code: 'INVALID_INVENTORY', message: 'Bir veya daha fazla stok kalemi bulunamadı.' } })
        }
      }

      const totals = aggregateTotals(data.items)

      const created = await db.$transaction(async (tx) => {
        const invoice = await tx.purchaseInvoice.create({
          data: {
            tenantId,
            supplierId: data.supplierId,
            invoiceNumber: data.invoiceNumber ?? null,
            invoiceDate: new Date(data.invoiceDate),
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            status: PurchaseInvoiceStatus.draft,
            subtotal: new Prisma.Decimal(totals.subtotal.toFixed(2)),
            taxTotal: new Prisma.Decimal(totals.taxTotal.toFixed(2)),
            discountTotal: new Prisma.Decimal(totals.discountTotal.toFixed(2)),
            total: new Prisma.Decimal(totals.total.toFixed(2)),
            notes: data.notes ?? null,
            createdBy: userId,
          },
        })

        await tx.purchaseInvoiceItem.createMany({
          data: data.items.map((item) => {
            const t = computeItemTotals(item)
            return {
              invoiceId: invoice.id,
              inventoryId: item.inventoryId ?? null,
              name: item.name,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice),
              taxRate: new Prisma.Decimal(item.taxRate),
              discount: new Prisma.Decimal(item.discount),
              total: new Prisma.Decimal(t.total.toFixed(2)),
            }
          }),
        })

        if (data.post) {
          await postInvoiceTx(tx, invoice.id, tenantId, userId)
        }

        return invoice
      })

      return res.status(201).json({ id: created.id })
    } catch (err) { next(err) }
  })

  // ─── POST /purchase-invoices/:id/post ───────────────────────────────────────
  router.post('/purchase-invoices/:id/post', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'purchase_invoice.write')) return
      const tenantId = req.tenantId!
      const userId = req.user!.userId
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fatura bulunamadı.' } })

      try {
        await db.$transaction((tx) => postInvoiceTx(tx, id, tenantId, userId))
      } catch (e) {
        const msg = (e as Error).message
        if (msg === 'NOT_FOUND') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fatura bulunamadı.' } })
        if (msg === 'ALREADY_POSTED') return res.status(400).json({ error: { code: 'ALREADY_POSTED', message: 'Bu fatura zaten muhasebeleşmiş.' } })
        throw e
      }

      return res.status(204).send()
    } catch (err) { next(err) }
  })

  // ─── POST /purchase-invoices/:id/cancel ─────────────────────────────────────
  router.post('/purchase-invoices/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'purchase_invoice.write')) return
      const tenantId = req.tenantId!
      const userId = req.user!.userId
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fatura bulunamadı.' } })

      try {
        await db.$transaction((tx) => cancelPostedInvoiceTx(tx, id, tenantId, userId))
      } catch (e) {
        const msg = (e as Error).message
        if (msg === 'NOT_FOUND') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fatura bulunamadı.' } })
        if (msg === 'NOT_POSTED') return res.status(400).json({ error: { code: 'NOT_POSTED', message: 'Sadece muhasebeleşmiş faturalar iptal edilebilir.' } })
        throw e
      }
      return res.status(204).send()
    } catch (err) { next(err) }
  })

  // ─── DELETE /purchase-invoices/:id ──────────────────────────────────────────
  // Sadece draft silinebilir
  router.delete('/purchase-invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'purchase_invoice.write')) return
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fatura bulunamadı.' } })

      const existing = await db.purchaseInvoice.findFirst({
        where: { id, tenantId }, select: { id: true, status: true },
      })
      if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Fatura bulunamadı.' } })
      if (existing.status !== PurchaseInvoiceStatus.draft) {
        return res.status(400).json({
          error: { code: 'NOT_DELETABLE', message: 'Sadece taslak faturalar silinebilir. Önce iptal edin.' },
        })
      }

      await db.purchaseInvoice.delete({ where: { id } })
      return res.status(204).send()
    } catch (err) { next(err) }
  })

  return router
}
