import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// W20-1: hizmet olusturma online randevu ayarini tek istekte alir; sure ve ara sureye ust sinir.
// DB ve kimlik katmani sahte; DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  service: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
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
const BASE = '/api/v1/tenants/salon/services'
const create = (role: string, body: object) => request(app).post(BASE).set('x-role', role).send(body)
const update = (body: object) => request(app).patch(`${BASE}/s1`).set('x-role', 'owner').send(body)
const valid = { name: 'Sac kesimi', durationMinutes: 30, price: 250 }

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.service.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 's1', name: data.name, durationMinutes: data.durationMinutes, price: data.price, category: null,
    bufferMinutes: data.bufferMinutes ?? 0, isActive: true, isOnlineBookable: data.isOnlineBookable ?? true, followUpSchedule: null,
  }))
  dbMock.service.findFirst.mockResolvedValue({ id: 's1', tenantId: 't1' })
  dbMock.service.update.mockResolvedValue({
    id: 's1', name: 'x', durationMinutes: 30, price: 1, category: null, bufferMinutes: 0, isActive: true, isOnlineBookable: true, followUpSchedule: null,
  })
})

describe('POST /services online randevu ayari', () => {
  it('isOnlineBookable:false tek istekte yazilir ve yanitta doner', async () => {
    const res = await create('owner', { ...valid, isOnlineBookable: false })
    expect(res.status).toBe(201)
    expect(dbMock.service.create).toHaveBeenCalledTimes(1)
    expect(dbMock.service.create.mock.calls[0][0].data.isOnlineBookable).toBe(false)
    expect(res.body.isOnlineBookable).toBe(false)
  })

  it('alan gonderilmezse online\'a acik kalir (veritabani varsayilani; veriye alan yazilmaz)', async () => {
    const res = await create('manager', valid)
    expect(res.status).toBe(201)
    expect(dbMock.service.create.mock.calls[0][0].data).not.toHaveProperty('isOnlineBookable')
    expect(res.body.isOnlineBookable).toBe(true)
  })

  it('isOnlineBookable boolean degilse 400 (baska her alan gecerli)', async () => {
    const res = await create('owner', { ...valid, isOnlineBookable: 'false' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(dbMock.service.create).not.toHaveBeenCalled()
  })

  it('kiraci kimligi govdeden alinmaz; yetkisiz rol 403', async () => {
    const forbidden = await create('staff', { ...valid, isOnlineBookable: false })
    expect(forbidden.status).toBe(403)
    await create('owner', { ...valid, tenantId: 'baska-kiraci' })
    expect(dbMock.service.create.mock.calls[0][0].data.tenantId).toBe('t1')
  })
})

describe('hizmet sure ve ara sure ust siniri', () => {
  it('POST: 720 dk sure ve 240 dk ara sure kabul edilir', async () => {
    const res = await create('owner', { ...valid, durationMinutes: 720, bufferMinutes: 240 })
    expect(res.status).toBe(201)
  })

  it('POST: 721 dk sure 400 (ara sure gecerli)', async () => {
    const res = await create('owner', { ...valid, durationMinutes: 721, bufferMinutes: 10 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(dbMock.service.create).not.toHaveBeenCalled()
  })

  it('POST: 241 dk ara sure 400 (sure gecerli)', async () => {
    const res = await create('owner', { ...valid, bufferMinutes: 241 })
    expect(res.status).toBe(400)
    expect(dbMock.service.create).not.toHaveBeenCalled()
  })

  it('PATCH: 720/240 kabul edilir', async () => {
    const res = await update({ durationMinutes: 720, bufferMinutes: 240 })
    expect(res.status).toBe(200)
  })

  it('PATCH: 721 dk sure 400', async () => {
    const res = await update({ durationMinutes: 721 })
    expect(res.status).toBe(400)
    expect(dbMock.service.update).not.toHaveBeenCalled()
  })

  it('PATCH: 241 dk ara sure 400', async () => {
    const res = await update({ bufferMinutes: 241 })
    expect(res.status).toBe(400)
    expect(dbMock.service.update).not.toHaveBeenCalled()
  })
})
