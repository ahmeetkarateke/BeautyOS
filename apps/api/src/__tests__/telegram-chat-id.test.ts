import { describe, it, expect, vi, beforeEach } from 'vitest'

// ADR-0039: Telegram sohbet no customer.phone'da degil telegramChatId'de tutulur. db/kuyruk/sms sahte; DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  customer: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  service: { findFirst: vi.fn() },
  appointment: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  messageDelivery: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
}))
const smsMock = vi.hoisted(() => ({ sendSms: vi.fn() }))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('bullmq', () => ({ Queue: vi.fn(() => ({ add: vi.fn(), remove: vi.fn() })), Worker: vi.fn(() => ({ on: vi.fn() })) }))
vi.mock('ioredis', () => ({ default: vi.fn(() => ({ quit: vi.fn(), disconnect: vi.fn(), on: vi.fn() })) }))
vi.mock('../lib/sms', async (orig) => ({ ...(await orig<typeof import('../lib/sms')>()), sendSms: smsMock.sendSms }))
vi.mock('../lib/online-booking', async (orig) => ({
  ...(await orig<typeof import('../lib/online-booking')>()),
  scheduleOnlineExpiry: vi.fn(),
  sweepExpiredOnlineRequests: vi.fn(),
  anonymizeStaleRequests: vi.fn(),
}))
vi.mock('../lib/sessions', () => ({ purgeExpiredSessions: vi.fn() }))
vi.mock('../lib/invitations', () => ({ purgeStaleInvitations: vi.fn() }))

import { createAppointment, cancelAppointmentByRef } from '../bot/booking.service'
import { processReminderJob } from '../lib/queue'
import { maskPhone } from '../lib/customer-privacy'

const SLOT = `${new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString()}__sp1`
const tgInput = { tenantId: 't1', customerPhone: '5321234567', customerName: 'Ayse', serviceName: 'Saç Kesimi', slotId: SLOT, channel: 'telegram' as const }

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.service.findFirst.mockResolvedValue({ id: 'sv1', durationMinutes: 30, bufferMinutes: 0, price: 250 })
  dbMock.appointment.create.mockResolvedValue({ id: 'appt-1' })
  dbMock.customer.create.mockResolvedValue({ id: 'c-new' })
})

describe('K1: bot Telegram musterisini telegramChatId ile cozer', () => {
  it('K1: arama telegramChatId + tenantId ile yapilir; phone kosulu yoktur (telefon biciminde sohbet no gercek telefonla eslesmez)', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    await createAppointment(tgInput)
    const where = dbMock.customer.findMany.mock.calls[0][0].where
    expect(where).toEqual({ tenantId: 't1', telegramChatId: '5321234567' })
    expect(where).not.toHaveProperty('phone')
  })

  it('K1: kayit yoksa yeni kart telegramChatId ile acilir, phone yazilmaz', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    const r = await createAppointment(tgInput)
    expect(r.status).toBe('confirmed')
    const data = dbMock.customer.create.mock.calls[0][0].data
    expect(data).toMatchObject({ tenantId: 't1', telegramChatId: '5321234567', fullName: 'Ayse' })
    expect(data.phone ?? null).toBeNull()
  })

  it('K1: tek eslesme karta baglanir, yeni kart acilmaz; randevu musteriye bagli', async () => {
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c-old' }])
    const r = await createAppointment(tgInput)
    expect(r.status).toBe('confirmed')
    expect(dbMock.customer.create).not.toHaveBeenCalled()
    expect(dbMock.appointment.create.mock.calls[0][0].data).toMatchObject({ customerId: 'c-old', status: 'confirmed' })
  })

  it('K1: WhatsApp yolu telefonla cozmeyi surdurur (telegramChatId kosulu yok)', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    await createAppointment({ ...tgInput, customerPhone: '905320000001', channel: 'whatsapp' })
    const where = dbMock.customer.findMany.mock.calls[0][0].where
    expect(where.phone.in).toContain('+905320000001')
    expect(where).not.toHaveProperty('telegramChatId')
  })
})

describe('K2: iptal sahipligi kanal kimligine gore', () => {
  const later = new Date(Date.now() + 5 * 3600 * 1000)

  it('K2: Telegram iptali telegramChatId / requestedChatId ile eslesir; phone/requestedPhone ile degil', async () => {
    dbMock.appointment.findFirst.mockResolvedValue({ id: 'a1', startAt: later })
    dbMock.appointment.update.mockResolvedValue({})
    expect(await cancelAppointmentByRef('t1', 'RDV-1', '5321234567', { exact: true })).toEqual({ ok: true })
    const where = dbMock.appointment.findFirst.mock.calls[0][0].where
    expect(where.tenantId).toBe('t1')
    expect(where.OR).toEqual([{ customer: { telegramChatId: '5321234567' } }, { requestedChatId: '5321234567' }])
  })

  it('K2: WhatsApp iptali telefon bicimlerini arar', async () => {
    dbMock.appointment.findFirst.mockResolvedValue(null)
    await cancelAppointmentByRef('t1', 'RDV-1', '905320000001')
    const or = dbMock.appointment.findFirst.mock.calls[0][0].where.OR
    expect(or[0].customer.phone.in).toContain('+905320000001')
    expect(JSON.stringify(or)).not.toContain('telegramChatId')
  })
})

describe('K3: phone bos kartta gonderim denenmez ve hata vermez', () => {
  it('K3: hatirlatma isi telefonsuz (Telegram) musteri icin SMS gondermez, hata atmaz', async () => {
    dbMock.appointment.findFirst.mockResolvedValue({
      id: 'a1', tenantId: 't1', status: 'confirmed', isDeleted: false, updatedAt: new Date(Date.now() - 3600_000), startAt: new Date(Date.now() + 3600_000),
      customer: { id: 'c1', fullName: 'Ayse', phone: null, email: null, telegramChatId: '5321234567' },
      service: { name: 'Saç Kesimi' }, tenant: { id: 't1', name: 'Salon', businessType: 'hair_salon' },
    })
    dbMock.messageDelivery.findFirst.mockResolvedValue(null)
    await expect(processReminderJob({ type: 'reminder_24h', appointmentId: 'a1', tenantId: 't1' })).resolves.toBeUndefined()
    expect(smsMock.sendSms).not.toHaveBeenCalled()
    // Veri gercekten islendi (erken donus degil): kayit okundu.
    expect(dbMock.appointment.findFirst).toHaveBeenCalled()
  })

  it('K3: gece gelmedi taramasi telefonsuz kartta da calisir ve hicbir musteriye SMS gondermez (A8 sonrasi tarama yalniz durumu gunceller)', async () => {
    dbMock.appointment.findMany.mockResolvedValue([{ id: 'a1', tenantId: 't1' }, { id: 'a2', tenantId: 't1' }])
    dbMock.appointment.updateMany.mockResolvedValue({ count: 1 })
    dbMock.messageDelivery.updateMany.mockResolvedValue({ count: 0 })
    await processReminderJob({ type: 'nightly_noshow' })
    expect(dbMock.appointment.updateMany.mock.calls.filter((c) => c[0].data?.status === 'no_show')).toHaveLength(2)
    expect(smsMock.sendSms).not.toHaveBeenCalled()
  })

  it('K3: maskPhone bos degerde "***" doner (panel listesi null phone ile patlamaz)', () => {
    expect(maskPhone(null)).toBe('***')
  })
})
