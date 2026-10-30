import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// W25-faturalar-1: KDV kalem basina kurusa (yarim yukari) yuvarlanir; fatura toplami yuvarlanmis kalemlerin toplamidir.
const dbMock = vi.hoisted(() => ({
  supplier: { findFirst: vi.fn() },
  inventoryItem: { findMany: vi.fn() },
  purchaseInvoice: { create: vi.fn() },
  purchaseInvoiceItem: { createMany: vi.fn() },
  $transaction: vi.fn(),
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

import { createPurchaseInvoicesRouter } from '../routes/purchase-invoices.route'

const app = express().use(express.json()).use('/api/v1/tenants/:slug', createPurchaseInvoicesRouter())
const URL = '/api/v1/tenants/salon/purchase-invoices'
const SUPPLIER = '44444444-4444-4444-8444-444444444444'

const item = (over: Record<string, unknown> = {}) => ({ name: 'Boya', quantity: 1, unitPrice: 12.35, taxRate: 10, discount: 0, ...over })
const send = (items: object[]) => request(app).post(URL).send({ supplierId: SUPPLIER, invoiceDate: '2026-10-30', items })
const savedInvoice = () => dbMock.purchaseInvoice.create.mock.calls[0][0].data
const savedItems = () => dbMock.purchaseInvoiceItem.createMany.mock.calls[0][0].data as Array<{ total: { toString(): string } }>

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.supplier.findFirst.mockResolvedValue({ id: SUPPLIER })
  dbMock.inventoryItem.findMany.mockResolvedValue([])
  dbMock.purchaseInvoice.create.mockResolvedValue({ id: 'inv1' })
  dbMock.$transaction.mockImplementation(async (fn: (t: typeof dbMock) => unknown) => fn(dbMock))
})

describe('alis faturasi yuvarlama', () => {
  it('iki kalem x 12,35 %10 KDV: her kalem 13,59, toplam kalemlerin toplami 27,18', async () => {
    const res = await send([item(), item()])
    expect(res.status).toBe(201)
    expect(savedItems().map((i) => i.total.toString())).toEqual(['13.59', '13.59'])
    expect(savedInvoice().total.toString()).toBe('27.18')
    expect(savedInvoice().taxTotal.toString()).toBe('2.48')
    expect(savedInvoice().subtotal.toString()).toBe('24.7')
  })

  it('fatura toplami her zaman kaydedilen kalem toplamlarinin toplamina esittir', async () => {
    const items = [item({ quantity: 3, unitPrice: 3.33, taxRate: 18 }), item({ unitPrice: 0.05, taxRate: 8 }), item({ quantity: 7, unitPrice: 9.99, taxRate: 20, discount: 1.1 })]
    await send(items)
    const sum = savedItems().reduce((s, i) => s + Math.round(Number(i.total.toString()) * 100), 0)
    expect(Math.round(Number(savedInvoice().total.toString()) * 100)).toBe(sum)
  })

  it('indirim bruttan buyukse kalem 0 olur, eksiye dusmez', async () => {
    await send([item({ discount: 100 })])
    expect(savedItems()[0].total.toString()).toBe('0')
  })
})
