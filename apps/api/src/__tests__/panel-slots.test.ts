import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// W13: panel (oturumlu) slot ucu online'a kapali hizmetlerde de calisir; herkese acik/bot yolu online sartini korur.
const dbMock = vi.hoisted(() => ({
  service: { findFirst: vi.fn() },
  staffProfile: { findFirst: vi.fn(), findMany: vi.fn() },
  staffLeave: { findFirst: vi.fn() },
  tenant: { findUnique: vi.fn() },
  appointment: { findMany: vi.fn() },
}))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() } }))
vi.mock('../middleware/auth.middleware', () => ({
  authenticateJWT: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'u-me', tenantId: 't1', tenantSlug: 'salon', role: String(req.headers['x-role']) } as never
    next()
  },
  requireTenantAccess: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = 't1'
    next()
  },
  checkTenantActive: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

import { getSlots } from '../lib/slots'
import { createTenantRouter } from '../routes/tenant.route'

const SVC = '11111111-1111-4111-8111-111111111111'
const STAFF = '22222222-2222-4222-8222-222222222222'

// Hizmet yalniz where online sartini icermiyorsa bulunur: "online'a kapali hizmet" simulasyonu.
function closedToOnlineService() {
  dbMock.service.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
    where.isOnlineBookable === true ? null : { durationMinutes: 30, bufferMinutes: 0 },
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.staffProfile.findFirst.mockResolvedValue(null)
})

describe('getSlots onlineOnly', () => {
  it('K1: varsayilan (bot/public) online sarti arar; online kapali hizmette bos doner ve personel sorgusuna gecmez', async () => {
    closedToOnlineService()
    expect(await getSlots({ tenantId: 't1', serviceId: SVC, staffId: STAFF, date: '2026-11-02' })).toEqual([])
    expect(dbMock.service.findFirst.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', isActive: true, isOnlineBookable: true })
    expect(dbMock.staffProfile.findFirst).not.toHaveBeenCalled()
  })

  it('K1: onlineOnly=false online sartini aramaz ama kiraci ve aktiflik sartini korur; hizmet bulunur (personel sorgusuna gecer)', async () => {
    closedToOnlineService()
    await getSlots({ tenantId: 't1', serviceId: SVC, staffId: STAFF, date: '2026-11-02', onlineOnly: false })
    const where = dbMock.service.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ id: SVC, tenantId: 't1', isActive: true })
    expect(where).not.toHaveProperty('isOnlineBookable')
    expect(dbMock.staffProfile.findFirst).toHaveBeenCalled()
  })
})

describe('GET /slots (panel)', () => {
  const app = express().use('/api/v1/tenants/:slug', createTenantRouter())
  const url = `/api/v1/tenants/salon/slots?serviceId=${SVC}&staffId=${STAFF}&date=2026-11-02`

  it('K1: panel ucu online kapali hizmet icin hizmeti online sarti olmadan sorgular (kiraci kimligi oturumdan)', async () => {
    closedToOnlineService()
    const res = await request(app).get(url).set({ 'x-role': 'owner' })
    expect(res.status).toBe(200)
    const where = dbMock.service.findFirst.mock.calls[0][0].where
    expect(where).not.toHaveProperty('isOnlineBookable')
    expect(where.tenantId).toBe('t1')
    expect(dbMock.staffProfile.findFirst).toHaveBeenCalled()
  })

  it('K1: staffId=any yolu da ayni sekilde online sartini aramaz', async () => {
    closedToOnlineService()
    dbMock.staffProfile.findMany.mockResolvedValue([{ id: STAFF }])
    const res = await request(app).get(url.replace(STAFF, 'any')).set({ 'x-role': 'owner' })
    expect(res.status).toBe(200)
    expect(dbMock.service.findFirst.mock.calls[0][0].where).not.toHaveProperty('isOnlineBookable')
  })
})
