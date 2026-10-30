import { describe, it, expect, vi, beforeEach } from 'vitest'

// Bot randevusu confirmed acilir ve hatirlatma isleri kurulur (ADR-0044/0045). db, kuyruk ve yardimcilar sahte.
const m = vi.hoisted(() => ({
  db: {
    service: { findFirst: vi.fn(), findMany: vi.fn() },
    appointment: { create: vi.fn() },
    customer: { create: vi.fn(), update: vi.fn() },
  },
  scheduleReminders: vi.fn(),
  resolve: vi.fn(),
}))

vi.mock('../lib/db', () => ({ db: m.db }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() }, scheduleReminders: m.scheduleReminders }))
vi.mock('../lib/slots', () => ({ getSlots: vi.fn() }))
vi.mock('../lib/customer-phone', () => ({ resolveCustomerByPhone: m.resolve, lookupValues: vi.fn() }))

import { createAppointment } from '../bot/booking.service'

const START = new Date(Date.now() + 72 * 3_600_000)
const input = { tenantId: 't1', customerPhone: '05321234567', customerName: 'Ayse', serviceName: 'Sac', slotId: `${START.toISOString()}__staff1`, channel: 'whatsapp' as const }

beforeEach(() => {
  vi.clearAllMocks()
  m.db.service.findFirst.mockResolvedValue({ id: 's1', durationMinutes: 60, bufferMinutes: 0, price: 100 })
  m.db.appointment.create.mockResolvedValue({ id: 'a1' })
  m.db.customer.update.mockResolvedValue({})
  m.scheduleReminders.mockResolvedValue(undefined)
})

describe('bot randevusu hatirlatma', () => {
  it('musteri bagliysa confirmed acilir ve hatirlatma isleri kiraci ve baslangicla kurulur', async () => {
    m.resolve.mockResolvedValue({ kind: 'single', id: 'c1' })
    const res = await createAppointment(input)
    expect(res.status).toBe('confirmed')
    expect(m.scheduleReminders).toHaveBeenCalledTimes(1)
    const arg = m.scheduleReminders.mock.calls[0][0]
    expect(arg).toMatchObject({ appointmentId: 'a1', tenantId: 't1' })
    expect(arg.startAt.getTime()).toBe(START.getTime())
  })

  it('hatirlatma kurulamazsa randevu yine olusur (ikincil is)', async () => {
    m.resolve.mockResolvedValue({ kind: 'single', id: 'c1' })
    m.scheduleReminders.mockRejectedValue(new Error('redis down'))
    await expect(createAppointment(input)).resolves.toMatchObject({ status: 'confirmed' })
  })
})
