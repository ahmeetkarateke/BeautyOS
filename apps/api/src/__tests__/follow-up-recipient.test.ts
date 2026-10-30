import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// TG1 / denetim TG1-1: takip mesajının alıcısı telefon değil telegramChatId'dir. Telefonu olan Telegram dışı müşteriye mesaj gitmez.
const sendText = vi.hoisted(() => vi.fn(async () => undefined))
const dbMock = vi.hoisted(() => {
  const tx = {
    appointment: { updateMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    transaction: { create: vi.fn() },
    cashDayClosure: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
  }
  return {
    ...tx,
    staffProfile: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    _tx: tx,
  }
})
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ scheduleReminders: vi.fn(async () => undefined), cancelReminders: vi.fn(async () => undefined), remindersQueue: { add: vi.fn(), remove: vi.fn() } }))
vi.mock('../channels/telegram.channel', () => ({ TelegramChannel: vi.fn().mockImplementation(() => ({ sendText })) }))
vi.mock('../middleware/auth.middleware', () => ({
  authenticateJWT: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'u-me', tenantId: 't1', tenantSlug: 'salon', role: 'owner' } as never
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
const URL = '/api/v1/tenants/salon/appointments/a1/status'

const existing = { id: 'a1', tenantId: 't1', staffId: 'sp1', customerId: 'c1', status: 'confirmed', startAt: new Date('2026-11-20T10:00:00Z') }
const full = (customer: Record<string, unknown>) => ({
  id: 'a1', staffId: 'sp1', serviceId: 's1', customerId: 'c1', priceCharged: 100, startAt: new Date('2026-11-20T10:00:00Z'),
  service: { name: 'Kesim', commissionRate: 0.3, durationMinutes: 30, followUpSchedule: [{ day: 7, label: 'Kontrol' }] },
  customer,
  tenant: { settings: { followUpEnabled: true }, telegramBotToken: 'bot-token' },
})

function arrange(customer: Record<string, unknown>) {
  const tx = dbMock._tx
  let calls = 0
  tx.appointment.findFirst.mockImplementation(async (args: { where: Record<string, unknown> }) => {
    if (args.where.startAt) return null // takip randevusu için çakışma yok
    calls += 1
    return calls === 1 ? existing : full(customer)
  })
  tx.appointment.create.mockResolvedValue({ id: 'fu1' })
}

beforeEach(() => {
  vi.clearAllMocks()
  const tx = dbMock._tx
  dbMock.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx))
  dbMock.staffProfile.findFirst.mockResolvedValue({ id: 'sp1' })
  tx.appointment.updateMany.mockResolvedValue({ count: 1 })
  tx.cashDayClosure.findUnique.mockResolvedValue(null)
  tx.$queryRaw.mockResolvedValue([])
  tx.transaction.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'tx1', completedAt: new Date(), ...data }))
})

describe('takip mesajı alıcısı', () => {
  it('Telegram müşterisinde mesaj telegramChatId sohbetine gider (telefona değil)', async () => {
    arrange({ fullName: 'A', telegramChatId: 'chat-777', phone: '5321112233' })
    const res = await request(app).patch(URL).send({ status: 'completed' })
    expect(res.status).toBe(200)
    expect(res.body.followUpAppointments).toHaveLength(1)
    await vi.waitFor(() => expect(sendText).toHaveBeenCalledTimes(1))
    expect((sendText.mock.calls[0] as unknown[])[0]).toBe('chat-777')
  })

  it('telefonu olan ama Telegram sohbeti olmayan müşteriye takip mesajı gönderilmez', async () => {
    arrange({ fullName: 'B', telegramChatId: null, phone: '5321112233' })
    const res = await request(app).patch(URL).send({ status: 'completed' })
    expect(res.status).toBe(200)
    expect(res.body.followUpAppointments).toHaveLength(1)
    await new Promise((r) => setTimeout(r, 50))
    expect(sendText).not.toHaveBeenCalled()
  })
})
