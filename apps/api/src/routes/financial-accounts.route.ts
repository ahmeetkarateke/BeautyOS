import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import {
  Prisma,
  FinancialAccountType,
  FinancialTransactionType,
  CurrentAccountPartyType,
  CurrentAccountEntryRefType,
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


function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

/** Hesap bakiyesini hesaplar: openingBalance + Σ(income+transfer_in+opening_balance+adjustment_pos)
 *  − Σ(expense+transfer_out+adjustment_neg)
 *  Burada adjustment'ı işaretli kabul edebiliriz; basitlik için: income/transfer_in/opening = +,
 *  expense/transfer_out = −, adjustment kullanıcının verdiği amount yön belirler (negatif olabilir).
 *  amount alanı her zaman pozitif; type yön belirler. Adjustment için kullanıcı negatif girmek
 *  isterse "düzeltme: gider" gibi expense kullansın. Burada adjustment her zaman + sayılır.
 */
function signedAmount(type: FinancialTransactionType, amount: number): number {
  switch (type) {
    case FinancialTransactionType.income:
    case FinancialTransactionType.transfer_in:
    case FinancialTransactionType.opening_balance:
      return amount
    case FinancialTransactionType.expense:
    case FinancialTransactionType.transfer_out:
      return -amount
    case FinancialTransactionType.adjustment:
      return amount // pozitif olarak girilir; düzeltme negatif gerekiyorsa expense kullanılmalı
    default:
      return 0
  }
}

export function createFinancialAccountsRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  // ═══ ACCOUNTS CRUD ═════════════════════════════════════════════════════════

  // GET /accounts — bakiye ile birlikte hesap listesi
  router.get('/accounts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'finance.account.read')) return
      const tenantId = req.tenantId!
      const includeInactive = req.query.includeInactive === 'true'

      const accounts = await db.financialAccount.findMany({
        where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: [{ isDefault: 'desc' }, { type: 'asc' }, { name: 'asc' }],
      })

      // Bakiye aggregasyon (tüm tx'ler)
      const grouped = await db.financialTransaction.groupBy({
        by: ['accountId', 'type'],
        where: { tenantId },
        _sum: { amount: true },
      })

      const balanceMap = new Map<string, number>()
      for (const g of grouped) {
        const signed = signedAmount(g.type, Number(g._sum.amount ?? 0))
        balanceMap.set(g.accountId, (balanceMap.get(g.accountId) ?? 0) + signed)
      }

      const data = accounts.map((a) => {
        const txBalance = balanceMap.get(a.id) ?? 0
        const balance = Number(a.openingBalance) + txBalance
        return {
          id: a.id,
          type: a.type,
          name: a.name,
          bankName: a.bankName,
          accountHolder: a.accountHolder,
          iban: a.iban,
          currency: a.currency,
          openingBalance: Number(a.openingBalance),
          isActive: a.isActive,
          isDefault: a.isDefault,
          notes: a.notes,
          balance,
        }
      })

      return res.json({ data })
    } catch (err) { next(err) }
  })

  // GET /accounts/:id — hesap detayı + son hareketler
  router.get('/accounts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'finance.account.read')) return
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hesap bulunamadı.' } })

      const account = await db.financialAccount.findFirst({ where: { id, tenantId } })
      if (!account) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hesap bulunamadı.' } })

      const from = typeof req.query.from === 'string' ? req.query.from : undefined
      const to = typeof req.query.to === 'string' ? req.query.to : undefined

      const txs = await db.financialTransaction.findMany({
        where: {
          tenantId,
          accountId: id,
          ...(from || to
            ? {
                date: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to) } : {}),
                },
              }
            : {}),
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 300,
        include: {
          customer: { select: { id: true, fullName: true } },
          supplier: { select: { id: true, name: true } },
          counterpartyAccount: { select: { id: true, name: true, type: true } },
        },
      })

      // Toplam bakiye
      const grouped = await db.financialTransaction.groupBy({
        by: ['type'],
        where: { tenantId, accountId: id },
        _sum: { amount: true },
      })
      let txBalance = 0
      for (const g of grouped) txBalance += signedAmount(g.type, Number(g._sum.amount ?? 0))

      return res.json({
        account: {
          id: account.id,
          type: account.type,
          name: account.name,
          bankName: account.bankName,
          accountHolder: account.accountHolder,
          iban: account.iban,
          currency: account.currency,
          openingBalance: Number(account.openingBalance),
          isActive: account.isActive,
          isDefault: account.isDefault,
          notes: account.notes,
          balance: Number(account.openingBalance) + txBalance,
        },
        transactions: txs.map((t) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          date: t.date.toISOString(),
          description: t.description,
          category: t.category,
          customer: t.customer,
          supplier: t.supplier,
          counterpartyAccount: t.counterpartyAccount,
          referenceType: t.referenceType,
          referenceId: t.referenceId,
        })),
      })
    } catch (err) { next(err) }
  })

  // POST /accounts
  const createAccountSchema = z.object({
    type: z.nativeEnum(FinancialAccountType),
    name: noXss(2, 100),
    bankName: noXss(1, 100).optional().nullable(),
    accountHolder: noXss(1, 100).optional().nullable(),
    iban: noXss(1, 50).optional().nullable(),
    currency: z.string().length(3).optional(),
    openingBalance: z.number().min(-99999999).max(99999999).default(0),
    isDefault: z.boolean().optional(),
    notes: noXss(1, 500).optional().nullable(),
  })

  router.post('/accounts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'finance.account.write')) return
      const tenantId = req.tenantId!
      const userId = req.user!.userId

      const parsed = createAccountSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Geçersiz hesap verisi.' } })
      }
      const data = parsed.data

      const created = await db.$transaction(async (tx) => {
        // Default ise diğerleri default değil yap
        if (data.isDefault) {
          await tx.financialAccount.updateMany({
            where: { tenantId, type: data.type, isDefault: true },
            data: { isDefault: false },
          })
        }
        const account = await tx.financialAccount.create({
          data: {
            tenantId,
            type: data.type,
            name: data.name,
            bankName: data.bankName ?? null,
            accountHolder: data.accountHolder ?? null,
            iban: data.iban ?? null,
            currency: data.currency ?? 'TRY',
            openingBalance: new Prisma.Decimal(data.openingBalance),
            isDefault: data.isDefault ?? false,
            notes: data.notes ?? null,
          },
        })
        // Opening balance varsa açılış hareketi olarak da kaydet (görünür olsun)
        if (data.openingBalance !== 0) {
          await tx.financialTransaction.create({
            data: {
              tenantId,
              accountId: account.id,
              // amount her zaman pozitiftir, yönü type belirler: eksi açılış (borç) gider yönünde kaydedilir.
              type: data.openingBalance > 0 ? FinancialTransactionType.opening_balance : FinancialTransactionType.expense,
              amount: new Prisma.Decimal(Math.abs(data.openingBalance)),
              date: new Date(),
              description: data.openingBalance > 0 ? 'Açılış bakiyesi' : 'Açılış bakiyesi (borç)',
              createdBy: userId,
            },
          })
          // openingBalance alanını sıfırla — bakiye sadece tx'lerden hesaplansın
          await tx.financialAccount.update({
            where: { id: account.id },
            data: { openingBalance: new Prisma.Decimal(0) },
          })
        }
        return account
      })

      return res.status(201).json({ id: created.id })
    } catch (err) { next(err) }
  })

  const updateAccountSchema = z.object({
    name: noXss(2, 100).optional(),
    bankName: noXss(1, 100).optional().nullable(),
    accountHolder: noXss(1, 100).optional().nullable(),
    iban: noXss(1, 50).optional().nullable(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    notes: noXss(1, 500).optional().nullable(),
  })

  router.patch('/accounts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'finance.account.write')) return
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hesap bulunamadı.' } })

      const existing = await db.financialAccount.findFirst({ where: { id, tenantId } })
      if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hesap bulunamadı.' } })

      const parsed = updateAccountSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz veri.' } })
      const data = parsed.data

      const updated = await db.$transaction(async (tx) => {
        if (data.isDefault) {
          await tx.financialAccount.updateMany({
            where: { tenantId, type: existing.type, isDefault: true, NOT: { id } },
            data: { isDefault: false },
          })
        }
        return tx.financialAccount.update({
          where: { id },
          data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.bankName !== undefined ? { bankName: data.bankName } : {}),
            ...(data.accountHolder !== undefined ? { accountHolder: data.accountHolder } : {}),
            ...(data.iban !== undefined ? { iban: data.iban } : {}),
            ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            ...(data.notes !== undefined ? { notes: data.notes } : {}),
          },
        })
      })
      return res.json(updated)
    } catch (err) { next(err) }
  })

  // DELETE: hareketsiz hesabı sil, aksi halde pasifleştir
  router.delete('/accounts/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'finance.account.write')) return
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hesap bulunamadı.' } })

      const existing = await db.financialAccount.findFirst({ where: { id, tenantId } })
      if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hesap bulunamadı.' } })

      const txCount = await db.financialTransaction.count({ where: { tenantId, accountId: id } })
      if (txCount > 0) {
        await db.financialAccount.update({ where: { id }, data: { isActive: false } })
        return res.json({ deactivated: true })
      }
      await db.financialAccount.delete({ where: { id } })
      return res.status(204).send()
    } catch (err) { next(err) }
  })

  // ═══ TRANSACTIONS ═════════════════════════════════════════════════════════

  // POST /transactions — manuel gelir/gider
  const createTxSchema = z.object({
    accountId: z.string().uuid(),
    type: z.enum(['income', 'expense', 'adjustment']),
    amount: z.number().positive().max(99999999),
    date: z.string().datetime().optional(),
    description: noXss(2, 300),
    category: noXss(1, 50).optional().nullable(),
    customerId: z.string().uuid().optional().nullable(),
    supplierId: z.string().uuid().optional().nullable(),
    /** true ise: customer/supplier cari hesabına 'payment' kaydı düşülür ve bağlanır */
    linkToCurrentAccount: z.boolean().optional(),
  })

  router.post('/transactions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'finance.account.write')) return
      const tenantId = req.tenantId!
      const userId = req.user!.userId

      const parsed = createTxSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Geçersiz veri.' } })
      }
      const data = parsed.data

      const account = await db.financialAccount.findFirst({
        where: { id: data.accountId, tenantId }, select: { id: true },
      })
      if (!account) return res.status(400).json({ error: { code: 'INVALID_ACCOUNT', message: 'Hesap bulunamadı.' } })

      if (data.customerId) {
        const c = await db.customer.findFirst({ where: { id: data.customerId, tenantId }, select: { id: true } })
        if (!c) return res.status(400).json({ error: { code: 'INVALID_CUSTOMER', message: 'Müşteri bulunamadı.' } })
      }
      if (data.supplierId) {
        const s = await db.supplier.findFirst({ where: { id: data.supplierId, tenantId }, select: { id: true } })
        if (!s) return res.status(400).json({ error: { code: 'INVALID_SUPPLIER', message: 'Tedarikçi bulunamadı.' } })
      }

      const created = await db.$transaction(async (tx) => {
        const fin = await tx.financialTransaction.create({
          data: {
            tenantId,
            accountId: data.accountId,
            type: data.type as FinancialTransactionType,
            amount: new Prisma.Decimal(data.amount),
            date: data.date ? new Date(data.date) : new Date(),
            description: data.description,
            category: data.category ?? null,
            customerId: data.customerId ?? null,
            supplierId: data.supplierId ?? null,
            createdBy: userId,
          },
        })

        // Cari hesap bağı: payment olarak işle
        if (data.linkToCurrentAccount && (data.customerId || data.supplierId)) {
          const isCustomer = !!data.customerId
          await tx.currentAccountEntry.create({
            data: {
              tenantId,
              partyType: isCustomer ? CurrentAccountPartyType.customer : CurrentAccountPartyType.supplier,
              customerId: data.customerId ?? null,
              supplierId: data.supplierId ?? null,
              date: fin.date,
              // Payment = alacak (açık hesabı kapatır), her iki yön için
              debit: new Prisma.Decimal(0),
              credit: new Prisma.Decimal(data.amount),
              description: data.description,
              referenceType: CurrentAccountEntryRefType.payment,
              referenceId: fin.id,
              createdBy: userId,
            },
          })
        }

        return fin
      })

      return res.status(201).json({ id: created.id })
    } catch (err) { next(err) }
  })

  // POST /transactions/transfer — virman (iki hesap arası)
  const transferSchema = z.object({
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    amount: z.number().positive().max(99999999),
    date: z.string().datetime().optional(),
    description: noXss(2, 300).optional(),
  }).refine((d) => d.fromAccountId !== d.toAccountId, {
    message: 'Aynı hesaba virman yapamazsınız.',
  })

  router.post('/transactions/transfer', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'finance.account.write')) return
      const tenantId = req.tenantId!
      const userId = req.user!.userId

      const parsed = transferSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Geçersiz veri.' } })
      }
      const data = parsed.data

      const [from, to] = await Promise.all([
        db.financialAccount.findFirst({ where: { id: data.fromAccountId, tenantId, isActive: true }, select: { id: true, name: true } }),
        db.financialAccount.findFirst({ where: { id: data.toAccountId, tenantId, isActive: true }, select: { id: true, name: true } }),
      ])
      if (!from || !to) {
        return res.status(400).json({ error: { code: 'INVALID_ACCOUNT', message: 'Hesap(lar) bulunamadı.' } })
      }

      const date = data.date ? new Date(data.date) : new Date()
      const desc = data.description ?? `Virman: ${from.name} → ${to.name}`

      await db.$transaction(async (tx) => {
        await tx.financialTransaction.create({
          data: {
            tenantId,
            accountId: data.fromAccountId,
            type: FinancialTransactionType.transfer_out,
            amount: new Prisma.Decimal(data.amount),
            date,
            description: desc,
            counterpartyAccountId: data.toAccountId,
            createdBy: userId,
          },
        })
        await tx.financialTransaction.create({
          data: {
            tenantId,
            accountId: data.toAccountId,
            type: FinancialTransactionType.transfer_in,
            amount: new Prisma.Decimal(data.amount),
            date,
            description: desc,
            counterpartyAccountId: data.fromAccountId,
            createdBy: userId,
          },
        })
      })

      return res.status(201).json({ ok: true })
    } catch (err) { next(err) }
  })

  // DELETE /transactions/:id — sadece manuel; bağlı cari kaydı varsa o da silinir
  router.delete('/transactions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'finance.account.write')) return
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hareket bulunamadı.' } })

      const existing = await db.financialTransaction.findFirst({
        where: { id, tenantId },
        select: { id: true, type: true, amount: true, date: true, accountId: true, counterpartyAccountId: true, referenceType: true },
      })
      if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hareket bulunamadı.' } })

      // Otomatik oluşturulmuş kayıt (referenceType varsa: purchase_invoice, appointment vb.) silinemez
      if (existing.referenceType && existing.referenceType !== 'manual') {
        return res.status(400).json({
          error: { code: 'NOT_DELETABLE', message: 'Otomatik oluşturulan hareket silinemez. Önce kaynak işlemi iptal edin.' },
        })
      }

      await db.$transaction(async (tx) => {
        // Virman ise karşı kayıt da silinmeli
        if (
          (existing.type === FinancialTransactionType.transfer_in || existing.type === FinancialTransactionType.transfer_out)
          && existing.counterpartyAccountId
        ) {
          const oppositeType = existing.type === FinancialTransactionType.transfer_out
            ? FinancialTransactionType.transfer_in
            : FinancialTransactionType.transfer_out
          await tx.financialTransaction.deleteMany({
            where: {
              tenantId,
              accountId: existing.counterpartyAccountId,
              counterpartyAccountId: existing.accountId,
              type: oppositeType,
              amount: existing.amount,
              date: existing.date,
            },
          })
        }
        // Bağlı cari hesap kaydını da sil (payment referansı)
        await tx.currentAccountEntry.deleteMany({
          where: { tenantId, referenceId: id, referenceType: CurrentAccountEntryRefType.payment },
        })
        await tx.financialTransaction.delete({ where: { id } })
      })

      return res.status(204).send()
    } catch (err) { next(err) }
  })

  return router
}
