import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Bot konusma listesi/detayi ham telefon ya da sohbet no donmez (customerRef maskeli); yalniz owner okur. db ve kimlik katmani sahte.
const dbMock = vi.hoisted(() => ({ botConversation: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() } }))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() }, scheduleReminders: vi.fn(), cancelReminders: vi.fn() }))
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
const get = (role: string, path: string) => request(app).get(`/api/v1/tenants/salon${path}`).set('x-role', role)
const row = (customerRef: string) => ({ id: 'b1', channel: 'whatsapp', customerRef, outcome: 'booked', messages: [], turnCount: 2 })

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.botConversation.count.mockResolvedValue(1)
})

describe('bot konusmalari: customerRef maskeli', () => {
  it('liste: telefon maskeli doner, ham numara yanitta yok', async () => {
    dbMock.botConversation.findMany.mockResolvedValue([row('+905321234567')])
    const res = await get('owner', '/bot-conversations')
    expect(res.status).toBe(200)
    expect(res.body.data[0].customerRef).toBe('0532 *** ** 67')
    expect(JSON.stringify(res.body)).not.toContain('5321234567')
  })

  it('detay: ham numara yok; kisa sohbet no *** olur', async () => {
    dbMock.botConversation.findFirst.mockResolvedValue(row('123456'))
    const res = await get('owner', '/bot-conversations/b1')
    expect(res.status).toBe(200)
    expect(res.body.data.customerRef).toBe('***')
  })

  it('owner disindaki rol 403 (liste ve detay), veri okunmaz', async () => {
    for (const path of ['/bot-conversations', '/bot-conversations/b1']) {
      expect((await get('manager', path)).status).toBe(403)
    }
    expect(dbMock.botConversation.findMany).not.toHaveBeenCalled()
    expect(dbMock.botConversation.findFirst).not.toHaveBeenCalled()
  })
})
