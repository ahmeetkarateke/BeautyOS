import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// A8: hatirlatma isi duzeltmeleri. db, SMS, kuyruk ve Redis sahte; DB/Redis gerekmez.
const m = vi.hoisted(() => ({
  queueOpts: [] as Array<Record<string, unknown>>,
  appointment: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  sendSms: vi.fn(),
}))

vi.mock('bullmq', () => ({
  Queue: class {
    constructor(_name: string, opts: Record<string, unknown>) { m.queueOpts.push(opts) }
    add = vi.fn().mockResolvedValue({})
  },
  Worker: class { on = vi.fn() },
}))
vi.mock('ioredis', () => ({ default: class { quit = vi.fn(); disconnect = vi.fn() } }))
vi.mock('../lib/db', () => ({ db: { appointment: m.appointment } }))
vi.mock('../lib/sms', () => ({ sendSms: m.sendSms, normalizePhoneTR: (p: string) => p }))
vi.mock('../lib/online-booking', () => ({
  anonymizeStaleRequests: vi.fn(), expireOnlineRequest: vi.fn(), sweepExpiredOnlineRequests: vi.fn(),
}))
vi.mock('../lib/sessions', () => ({ purgeExpiredSessions: vi.fn() }))

import { processReminderJob, remindersQueue } from '../lib/queue'
import { isHealthRegulated } from '../lib/health-regulated'

function appt(over: Record<string, unknown> = {}) {
  return {
    id: 'a1', tenantId: 't1', status: 'confirmed', isDeleted: false,
    startAt: new Date('2026-10-30T09:00:00Z'),
    customer: { id: 'c1', fullName: 'Ayse Yilmaz', phone: '05321234567', marketingConsentSms: true },
    service: { name: 'Dis Beyazlatma' },
    tenant: { id: 't1', name: 'Salon', businessType: 'hair_salon' },
    ...over,
  }
}
const job = { type: 'reminder_24h', appointmentId: 'a1' } as const

beforeEach(() => {
  vi.clearAllMocks()
  m.sendSms.mockResolvedValue({ result: { success: true, providerName: 'mock' } })
})
afterEach(() => vi.useRealTimers())

describe('A8 yeniden deneme ayari', () => {
  it('kuyruk varsayilani: 3 deneme, ustel bekleme 1 dk baslangic, basarisiz is saklanir', () => {
    void remindersQueue
    const opts = m.queueOpts[0].defaultJobOptions as Record<string, unknown>
    expect(opts.attempts).toBe(3)
    expect(opts.backoff).toEqual({ type: 'exponential', delay: 60_000 })
    expect(opts.removeOnFail).toBe(false)
  })
})

describe('A8 hatirlatma hata ve atlama davranisi', () => {
  it('randevu sorgusu hata verirse is hata firlatir (yeniden denensin)', async () => {
    m.appointment.findUnique.mockRejectedValue(new Error('db down'))
    await expect(processReminderJob(job)).rejects.toThrow('db down')
  })

  it('SMS saglayicisi basarisizsa is hata firlatir (yeniden denensin)', async () => {
    m.appointment.findUnique.mockResolvedValue(appt())
    m.sendSms.mockResolvedValue({ result: { success: false, errorMessage: 'saglayici' } })
    await expect(processReminderJob(job)).rejects.toThrow()
  })

  it('isDeleted randevuda SMS gitmez, is sessizce tamamlanir (baska her sey gecerli)', async () => {
    m.appointment.findUnique.mockResolvedValue(appt({ isDeleted: true }))
    await expect(processReminderJob(job)).resolves.toBeUndefined()
    expect(m.sendSms).not.toHaveBeenCalled()
  })

  it('iptal edilmis randevuda SMS gitmez, is sessizce tamamlanir', async () => {
    m.appointment.findUnique.mockResolvedValue(appt({ status: 'cancelled' }))
    await expect(processReminderJob(job)).resolves.toBeUndefined()
    expect(m.sendSms).not.toHaveBeenCalled()
  })

  it('basarili gonderimde is tamamlanir ve SMS bir kez gider', async () => {
    m.appointment.findUnique.mockResolvedValue(appt())
    await processReminderJob(job)
    expect(m.sendSms).toHaveBeenCalledTimes(1)
  })
})

describe('A8 saat Europe/Istanbul', () => {
  it('SMS metnindeki saat Istanbul saatidir (UTC 09:00 = 12:00)', async () => {
    m.appointment.findUnique.mockResolvedValue(appt())
    await processReminderJob(job)
    expect(m.sendSms.mock.calls[0][0].body).toContain('12:00')
  })

  it('gece no-show taramasi Istanbul gununu kullanir (UTC 21:30 = Istanbul ertesi gun 00:30)', async () => {
    const tz = process.env.TZ
    process.env.TZ = 'UTC'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-29T21:30:00Z'))
    m.appointment.findMany.mockResolvedValue([])
    await processReminderJob({ type: 'nightly_noshow' })
    const where = m.appointment.findMany.mock.calls[0][0].where
    expect(where.startAt.gte.toISOString()).toBe('2026-10-29T21:00:00.000Z')
    expect(where.startAt.lte.toISOString()).toBe('2026-10-30T20:59:59.999Z')
    if (tz === undefined) delete process.env.TZ
    else process.env.TZ = tz
  })
})

describe('A8 klinik turlerinde hizmet adi mesajda yok (hukuk-uyum 10.7)', () => {
  it('dentist: 24 saat hatirlatmasinda hizmet adi gecmez ama saat ve salon gecer', async () => {
    m.appointment.findUnique.mockResolvedValue(appt({ tenant: { id: 't1', name: 'Salon', businessType: 'dentist' } }))
    await processReminderJob(job)
    const body = m.sendSms.mock.calls[0][0].body as string
    expect(body).not.toContain('Dis Beyazlatma')
    expect(body).toContain('12:00')
    expect(body).toContain('Salon')
  })

  it('aesthetic_clinic: 2 saat hatirlatmasinda hizmet adi gecmez', async () => {
    m.appointment.findUnique.mockResolvedValue(appt({ tenant: { id: 't1', name: 'Salon', businessType: 'aesthetic_clinic' } }))
    await processReminderJob({ type: 'reminder_2h', appointmentId: 'a1' })
    expect(m.sendSms.mock.calls[0][0].body).not.toContain('Dis Beyazlatma')
  })

  it('hair_salon: hizmet adi gecer (klinik degil)', async () => {
    m.appointment.findUnique.mockResolvedValue(appt())
    await processReminderJob(job)
    expect(m.sendSms.mock.calls[0][0].body).toContain('Dis Beyazlatma')
  })

  it('no-show mesajinda da klinikte hizmet adi gecmez', async () => {
    m.appointment.findMany.mockResolvedValue([
      { ...appt({ tenant: { id: 't1', name: 'Salon', businessType: 'dentist' } }), customer: { id: 'c1', fullName: 'Ayse Yilmaz', phone: '05321234567' } },
    ])
    m.appointment.update.mockResolvedValue({})
    await processReminderJob({ type: 'nightly_noshow' })
    expect(m.sendSms).toHaveBeenCalledTimes(1)
    expect(m.sendSms.mock.calls[0][0].body).not.toContain('Dis Beyazlatma')
  })
})

describe('isHealthRegulated', () => {
  it.each(['aesthetic_clinic', 'dentist', 'hair_transplant'])('%s saglik duzenlemeli', (t) => {
    expect(isHealthRegulated(t)).toBe(true)
  })
  it.each(['hair_salon', 'barbershop', 'beauty_center', 'spa', 'nail_studio', 'massage', 'tattoo_piercing', 'other', 'DENTIST', 'HAIR_TRANSPLANT', null, undefined])(
    '%s saglik duzenlemeli degil (buyuk harf dahil, harf donusumu yapilmaz)',
    (t) => {
      expect(isHealthRegulated(t as string | null | undefined)).toBe(false)
    },
  )
})
