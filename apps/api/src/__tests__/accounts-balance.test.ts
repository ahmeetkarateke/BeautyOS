import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// W24-1: eksi acilis bakiyesi dogru yonle saklanir; virman pasif hesaba yapilmaz.
// db sahte ama bellekte tutarli (hareketler toplanir); DB/Redis gerekmez.
type Acc = { id: string; tenantId: string; type: string; name: string; openingBalance: number; isActive: boolean; isDefault: boolean }
type Tx = { accountId: string; type: string; amount: number }

const store = vi.hoisted(() => ({ accounts: [] as unknown[], txs: [] as unknown[] }))
const A = () => store.accounts as Acc[]
const T = () => store.txs as Tx[]

const tx = {
  financialAccount: {
    updateMany: vi.fn(),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const acc = { id: 'a-new', isActive: true, isDefault: false, ...data } as Acc
      A().push({ ...acc, openingBalance: Number(data.openingBalance) })
      return acc
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const a = A().find((x) => x.id === where.id)!
      a.openingBalance = Number(data.openingBalance)
      return a
    }),
  },
  financialTransaction: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      T().push({ accountId: String(data.accountId), type: String(data.type), amount: Number(data.amount) })
      return { id: 'tx1' }
    }),
  },
}
const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  financialAccount: { findMany: vi.fn(), findFirst: vi.fn() },
  financialTransaction: { groupBy: vi.fn() },
}))

vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../middleware/auth.middleware', () => ({
  authenticateJWT: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'u1', tenantId: 't1', tenantSlug: 'salon', role: 'owner' } as never
    next()
  },
  requireTenantAccess: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = 't1'
    next()
  },
  checkTenantActive: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

import { createFinancialAccountsRouter } from '../routes/financial-accounts.route'

const app = express().use(express.json()).use('/api/v1/tenants/:slug', createFinancialAccountsRouter())
const BASE = '/api/v1/tenants/salon'
const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const newAccount = { type: 'bank', name: 'Kredi Karti', currency: 'TRY' }

const SIGN: Record<string, number> = { income: 1, transfer_in: 1, opening_balance: 1, adjustment: 1, expense: -1, transfer_out: -1 }

beforeEach(() => {
  vi.clearAllMocks()
  store.accounts.length = 0
  store.txs.length = 0
  dbMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
  dbMock.financialAccount.findMany.mockImplementation(async () => A())
  dbMock.financialTransaction.groupBy.mockImplementation(async () => {
    const sums = new Map<string, { accountId: string; type: string; _sum: { amount: number } }>()
    for (const t of T()) {
      const k = `${t.accountId}|${t.type}`
      const cur = sums.get(k) ?? { accountId: t.accountId, type: t.type, _sum: { amount: 0 } }
      cur._sum.amount += t.amount
      sums.set(k, cur)
    }
    return [...sums.values()]
  })
  dbMock.financialAccount.findFirst.mockImplementation(async ({ where }: { where: { id: string; isActive?: boolean } }) => {
    const a = A().find((x) => x.id === where.id)
    if (!a) return null
    if (where.isActive !== undefined && a.isActive !== where.isActive) return null
    if (where.tenantId !== undefined && a.tenantId !== where.tenantId) return null
    return a
  })
})

async function balanceOfCreated(openingBalance: number): Promise<number> {
  const created = await request(app).post(`${BASE}/accounts`).send({ ...newAccount, openingBalance })
  expect(created.status).toBe(201)
  const list = await request(app).get(`${BASE}/accounts`)
  const acc = list.body.data.find((a: { id: string }) => a.id === created.body.id)
  return acc.balance
}

describe('POST /accounts acilis bakiyesi yonu', () => {
  it('eksi acilis bakiyesi (-5000) borc olarak -5000 bakiye verir', async () => {
    expect(await balanceOfCreated(-5000)).toBe(-5000)
  })

  it('artı acilis bakiyesi (5000) +5000 bakiye verir', async () => {
    expect(await balanceOfCreated(5000)).toBe(5000)
  })

  it('sifir acilis bakiyesi hareket yazmaz', async () => {
    expect(await balanceOfCreated(0)).toBe(0)
    expect(T()).toHaveLength(0)
  })
})

describe('POST /transactions/transfer pasif hesap', () => {
  const body = { fromAccountId: U1, toAccountId: U2, amount: 100 }
  const seed = (fromActive: boolean, toActive: boolean) => {
    A().push(
      { id: U1, tenantId: 't1', type: 'cash', name: 'Kasa', openingBalance: 0, isActive: fromActive, isDefault: false },
      { id: U2, tenantId: 't1', type: 'bank', name: 'Banka', openingBalance: 0, isActive: toActive, isDefault: false },
    )
  }

  it('iki hesap da aktifse virman yazilir', async () => {
    seed(true, true)
    const res = await request(app).post(`${BASE}/transactions/transfer`).send(body)
    expect(res.status).toBe(201)
    expect(T().map((t) => SIGN[t.type] * t.amount).sort()).toEqual([-100, 100])
  })

  it('pasif kaynak hesap 400 INVALID_ACCOUNT, hareket yazilmaz', async () => {
    seed(false, true)
    const res = await request(app).post(`${BASE}/transactions/transfer`).send(body)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_ACCOUNT')
    expect(T()).toHaveLength(0)
  })

  it('baska kiracinin (aktif, var olan) hesabina virman 400 INVALID_ACCOUNT, hareket yazilmaz', async () => {
    seed(true, true)
    A().find((a) => a.id === U2)!.tenantId = 't2'
    const res = await request(app).post(`${BASE}/transactions/transfer`).send(body)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_ACCOUNT')
    expect(T()).toHaveLength(0)
  })

  it('pasif hedef hesap 400 INVALID_ACCOUNT, hareket yazilmaz', async () => {
    seed(true, false)
    const res = await request(app).post(`${BASE}/transactions/transfer`).send(body)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_ACCOUNT')
    expect(T()).toHaveLength(0)
  })
})
