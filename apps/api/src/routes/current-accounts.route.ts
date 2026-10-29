import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { Prisma, CurrentAccountPartyType, CurrentAccountEntryRefType, FinancialTransactionType } from '@prisma/client'
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

export function createCurrentAccountsRouter(): Router {
  const router = Router({ mergeParams: true })

  router.use(authenticateJWT)
  router.use(requireTenantAccess)
  router.use(checkTenantActive)

  // ─── GET /current-accounts?type=customer|supplier ───────────────────────────
  // Hesap listesi + bakiye + son hareket
  router.get('/current-accounts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'current_account.read')) return
      const tenantId = req.tenantId!
      const partyType = req.query.type === 'supplier' ? 'supplier' : 'customer'
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''

      // Bakiye aggregasyonu (SUM debit - SUM credit, party bazında)
      const grouped = await db.currentAccountEntry.groupBy({
        by: partyType === 'customer' ? ['customerId'] : ['supplierId'],
        where: { tenantId, partyType: partyType as CurrentAccountPartyType },
        _sum: { debit: true, credit: true },
        _max: { date: true },
      })

      const ids = grouped
        .map((g) => (partyType === 'customer' ? g.customerId : g.supplierId))
        .filter((v): v is string => !!v)

      const parties = partyType === 'customer'
        ? await db.customer.findMany({
            where: {
              tenantId,
              ...(search
                ? { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] }
                : {}),
            },
            select: { id: true, fullName: true, phone: true },
            orderBy: { fullName: 'asc' },
            take: 200,
          })
        : await db.supplier.findMany({
            where: {
              tenantId,
              ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
            },
            select: { id: true, name: true, phone: true },
            orderBy: { name: 'asc' },
            take: 200,
          })

      const balanceMap = new Map<string, { debit: number; credit: number; lastDate: Date | null }>()
      for (const g of grouped) {
        const id = (partyType === 'customer' ? g.customerId : g.supplierId)!
        balanceMap.set(id, {
          debit: Number(g._sum.debit ?? 0),
          credit: Number(g._sum.credit ?? 0),
          lastDate: g._max.date,
        })
      }

      const data = parties.map((p) => {
        const b = balanceMap.get(p.id) ?? { debit: 0, credit: 0, lastDate: null }
        const balance = b.debit - b.credit
        return {
          id: p.id,
          name: partyType === 'customer' ? (p as { fullName: string }).fullName : (p as { name: string }).name,
          phone: (p as { phone?: string | null }).phone ?? null,
          debit: b.debit,
          credit: b.credit,
          balance,
          lastEntryDate: b.lastDate?.toISOString() ?? null,
        }
      })

      // Filter: search uygulandıysa zero-balance hesapları da göster; uygulanmadıysa tümü
      return res.json({ data, total: data.length })
    } catch (err) { next(err) }
  })

  // ─── GET /current-accounts/:partyType/:partyId/entries ──────────────────────
  // Ekstre — borç, alacak, yürüyen bakiye
  router.get('/current-accounts/:partyType/:partyId/entries', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'current_account.read')) return
      const tenantId = req.tenantId!
      const { partyType, partyId } = req.params
      if (partyType !== 'customer' && partyType !== 'supplier') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Geçersiz hesap tipi.' } })
      }
      if (!isUuid(partyId)) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hesap bulunamadı.' } })
      }

      // Party'nin tenant'a ait olduğunu doğrula
      let partyName = ''
      let partyPhone: string | null = null
      if (partyType === 'customer') {
        const c = await db.customer.findFirst({ where: { id: partyId, tenantId }, select: { fullName: true, phone: true } })
        if (!c) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
        partyName = c.fullName; partyPhone = c.phone
      } else {
        const s = await db.supplier.findFirst({ where: { id: partyId, tenantId }, select: { name: true, phone: true } })
        if (!s) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tedarikçi bulunamadı.' } })
        partyName = s.name; partyPhone = s.phone
      }

      const entries = await db.currentAccountEntry.findMany({
        where: {
          tenantId,
          partyType: partyType as CurrentAccountPartyType,
          ...(partyType === 'customer' ? { customerId: partyId } : { supplierId: partyId }),
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      })

      let running = 0
      const items = entries.map((e) => {
        const debit = Number(e.debit)
        const credit = Number(e.credit)
        running += debit - credit
        return {
          id: e.id,
          date: e.date.toISOString(),
          debit,
          credit,
          description: e.description,
          referenceType: e.referenceType,
          referenceId: e.referenceId,
          balance: running,
        }
      })

      const totalDebit = items.reduce((s, x) => s + x.debit, 0)
      const totalCredit = items.reduce((s, x) => s + x.credit, 0)

      return res.json({
        party: { id: partyId, type: partyType, name: partyName, phone: partyPhone },
        entries: items,
        summary: { totalDebit, totalCredit, balance: totalDebit - totalCredit },
      })
    } catch (err) { next(err) }
  })

  // ─── POST /current-accounts/entries ─────────────────────────────────────────
  // Manuel hareket: açılış bakiyesi, tahsilat, ödeme, düzeltme
  const createEntrySchema = z.object({
    partyType: z.enum(['customer', 'supplier']),
    partyId: z.string().uuid(),
    date: z.string().datetime().optional(),
    debit: z.number().min(0).max(99999999).default(0),
    credit: z.number().min(0).max(99999999).default(0),
    description: noXss(2, 300),
    referenceType: z.nativeEnum(CurrentAccountEntryRefType).optional(),
    /** Bağlı kasa/banka hesabı — varsa karşılığında income/expense kaydı oluşur */
    accountId: z.string().uuid().optional(),
  }).refine((d) => d.debit > 0 || d.credit > 0, {
    message: 'Borç veya alacak tutarı pozitif olmalıdır.',
  }).refine((d) => !(d.debit > 0 && d.credit > 0), {
    message: 'Aynı kayıtta hem borç hem alacak olamaz.',
  })

  router.post('/current-accounts/entries', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'current_account.write')) return
      const tenantId = req.tenantId!
      const userId = req.user!.userId

      const parsed = createEntrySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Geçersiz veri.' },
        })
      }
      const data = parsed.data

      // Party tenant doğrulaması
      if (data.partyType === 'customer') {
        const c = await db.customer.findFirst({ where: { id: data.partyId, tenantId }, select: { id: true } })
        if (!c) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' } })
      } else {
        const s = await db.supplier.findFirst({ where: { id: data.partyId, tenantId }, select: { id: true } })
        if (!s) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tedarikçi bulunamadı.' } })
      }
      if (data.accountId) {
        const acc = await db.financialAccount.findFirst({ where: { id: data.accountId, tenantId }, select: { id: true } })
        if (!acc) return res.status(400).json({ error: { code: 'INVALID_ACCOUNT', message: 'Hesap bulunamadı.' } })
      }

      const refType = data.referenceType ?? CurrentAccountEntryRefType.manual
      const isPayment = refType === CurrentAccountEntryRefType.payment

      const created = await db.$transaction(async (tx) => {
        const entry = await tx.currentAccountEntry.create({
          data: {
            tenantId,
            partyType: data.partyType,
            customerId: data.partyType === 'customer' ? data.partyId : null,
            supplierId: data.partyType === 'supplier' ? data.partyId : null,
            date: data.date ? new Date(data.date) : new Date(),
            debit: new Prisma.Decimal(data.debit),
            credit: new Prisma.Decimal(data.credit),
            description: data.description,
            referenceType: refType,
            createdBy: userId,
          },
        })

        // Payment + accountId varsa → hesap hareketi
        // Müşteri tahsilatı → income, Tedarikçi ödemesi → expense
        // (credit > 0 olduğunda payment yapılıyor varsayımı)
        if (data.accountId && isPayment && data.credit > 0) {
          const isCustomer = data.partyType === 'customer'
          await tx.financialTransaction.create({
            data: {
              tenantId,
              accountId: data.accountId,
              type: isCustomer ? FinancialTransactionType.income : FinancialTransactionType.expense,
              amount: new Prisma.Decimal(data.credit),
              date: entry.date,
              description: data.description,
              customerId: isCustomer ? data.partyId : null,
              supplierId: !isCustomer ? data.partyId : null,
              referenceType: 'current_account_entry',
              referenceId: entry.id,
              createdBy: userId,
            },
          })
        }

        return entry
      })

      return res.status(201).json({
        id: created.id,
        date: created.date.toISOString(),
        debit: Number(created.debit),
        credit: Number(created.credit),
        description: created.description,
        referenceType: created.referenceType,
      })
    } catch (err) { next(err) }
  })

  // ─── DELETE /current-accounts/entries/:id ───────────────────────────────────
  // Sadece manuel veya opening_balance kayıtları silinebilir
  router.delete('/current-accounts/entries/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!ensurePermission(req, res, 'current_account.write')) return
      const tenantId = req.tenantId!
      const { id } = req.params
      if (!isUuid(id)) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' } })
      }

      const existing = await db.currentAccountEntry.findFirst({
        where: { id, tenantId }, select: { id: true, referenceType: true },
      })
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayıt bulunamadı.' } })
      }
      const deletable: CurrentAccountEntryRefType[] = [
        CurrentAccountEntryRefType.manual,
        CurrentAccountEntryRefType.opening_balance,
        CurrentAccountEntryRefType.adjustment,
        CurrentAccountEntryRefType.payment,
      ]
      if (!deletable.includes(existing.referenceType)) {
        return res.status(400).json({
          error: { code: 'NOT_DELETABLE', message: 'Otomatik oluşturulan kayıtlar silinemez. Önce ilgili işlemi iptal edin.' },
        })
      }

      // Bağlı finansal işlem de silinsin (payment ise)
      await db.$transaction(async (tx) => {
        await tx.financialTransaction.deleteMany({
          where: { tenantId, referenceType: 'current_account_entry', referenceId: id },
        })
        await tx.currentAccountEntry.delete({ where: { id } })
      })
      return res.status(204).send()
    } catch (err) { next(err) }
  })

  return router
}
