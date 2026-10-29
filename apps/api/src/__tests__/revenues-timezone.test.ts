import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// W16b-1: POST /revenues gun hesabi Europe/Istanbul'a gore. DB ve kimlik katmani sahte; DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  transaction: { create: vi.fn() },
}))

vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() } }))
vi.mock('../middleware/auth.middleware', () => ({
  authenticateJWT: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'u1', tenantId: 't1', tenantSlug: 'salon', role: String(req.headers['x-role']) } as never
    next()
  },
  requireTenantAccess: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = 't1'
    next()
  },
  checkTenantActive: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

import { createTenantRouter } from '../routes/tenant.route'

const app = express().use(express.json()).use('/api/v1/tenants/:slug', createTenantRouter())
const URL = '/api/v1/tenants/salon/revenues'
const post = (role: string, body: object) => request(app).post(URL).set('x-role', role).send(body)
const valid = { description: 'Saç boyası', amount: 500, paymentMethod: 'cash', revenueDate: '2026-10-30' }

function completedAtOfLastCreate(): Date {
  return dbMock.transaction.create.mock.calls[0][0].data.completedAt as Date
}

const originalTz = process.env.TZ

beforeEach(() => {
  // Uretim konteyneri TZ=UTC (CLAUDE.md kural 3); gelistirici makinesi Istanbul'da olsa da hata burada gorunsun.
  process.env.TZ = 'UTC'
  vi.clearAllMocks()
  dbMock.transaction.create.mockResolvedValue({ id: 'r1', grossAmount: 500, paymentMethod: 'cash' })
})
afterEach(() => {
  vi.useRealTimers()
  if (originalTz === undefined) delete process.env.TZ
  else process.env.TZ = originalTz
})

describe('POST /revenues gun hesabi (Europe/Istanbul)', () => {
  it('Istanbul 01:30 (UTC 22:30, onceki gun): kayit Istanbul gununde kalir, bir sonraki gune kaymaz', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-29T22:30:00Z')) // 30 Ekim 01:30 Istanbul
    const res = await post('owner', valid) // revenueDate 2026-10-30 = Istanbul bugunu
    expect(res.status).toBe(201)
    const at = completedAtOfLastCreate()
    // 30 Ekim Istanbul gunu: 29 Ekim 21:00Z .. 30 Ekim 20:59:59.999Z
    expect(at.getTime()).toBeGreaterThanOrEqual(new Date('2026-10-29T21:00:00.000Z').getTime())
    expect(at.getTime()).toBeLessThanOrEqual(new Date('2026-10-30T20:59:59.999Z').getTime())
  })

  it('bugune yazilan kayit gercek ani tasir (Istanbul 01:30 = UTC 22:30)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-29T22:30:00Z'))
    await post('owner', valid)
    expect(completedAtOfLastCreate().toISOString()).toBe('2026-10-29T22:30:00.000Z')
  })

  it('gecmis tarih (yalniz owner/manager): kayit o Istanbul gunune duser, saat dilimi kaymaz', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-29T22:30:00Z'))
    const res = await post('owner', { ...valid, revenueDate: '2026-10-28' })
    expect(res.status).toBe(201)
    const at = completedAtOfLastCreate()
    expect(at.getTime()).toBeGreaterThanOrEqual(new Date('2026-10-27T21:00:00.000Z').getTime())
    expect(at.getTime()).toBeLessThanOrEqual(new Date('2026-10-28T20:59:59.999Z').getTime())
  })

  it('Istanbul 12:00 (UTC 09:00): gunduz kaydi de dogru gunde', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-30T09:00:00Z'))
    await post('owner', valid)
    expect(completedAtOfLastCreate().toISOString()).toBe('2026-10-30T09:00:00.000Z')
  })
})

describe('POST /revenues aciklama siniri', () => {
  it('200 karakterlik aciklama kabul edilir', async () => {
    const res = await post('owner', { ...valid, description: 'a'.repeat(200) })
    expect(res.status).toBe(201)
  })

  it('201 karakterlik aciklama 400 VALIDATION_ERROR (baska her alan gecerli)', async () => {
    const res = await post('owner', { ...valid, description: 'a'.repeat(201) })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(dbMock.transaction.create).not.toHaveBeenCalled()
  })
})
