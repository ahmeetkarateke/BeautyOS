import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// A8 / ADR-0044: hatirlatma isi. db, SMS, e-posta, kuyruk ve Redis sahte; DB/Redis gerekmez.
const m = vi.hoisted(() => ({
  queues: [] as Array<{ opts: Record<string, unknown>; add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }>,
  appointment: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  messageDelivery: { findFirst: vi.fn(), create: vi.fn() },
  sendSms: vi.fn(),
  smsProvider: { name: 'netgsm' },
  sendReminderEmail: vi.fn(),
  emailConfigured: { value: true },
}))

vi.mock('bullmq', () => ({
  Queue: class {
    opts: Record<string, unknown>
    add = vi.fn().mockResolvedValue({})
    remove = vi.fn().mockResolvedValue(1)
    constructor(_name: string, opts: Record<string, unknown>) {
      this.opts = opts
      m.queues.push(this)
    }
  },
  Worker: class { on = vi.fn() },
  UnrecoverableError: class UnrecoverableError extends Error {},
}))
vi.mock('ioredis', () => ({ default: class { quit = vi.fn(); disconnect = vi.fn() } }))
vi.mock('../lib/db', () => ({ db: { appointment: m.appointment, messageDelivery: m.messageDelivery } }))
vi.mock('../lib/sms', () => ({
  sendSms: m.sendSms,
  normalizePhoneTR: (p: string) => (/^05\d{9}$/.test(p) ? `+90${p.slice(1)}` : null),
  getSmsProvider: () => m.smsProvider,
}))
vi.mock('../lib/email', () => ({
  sendReminderEmail: m.sendReminderEmail,
  isEmailConfigured: () => m.emailConfigured.value,
}))
vi.mock('../lib/online-booking', () => ({
  anonymizeStaleRequests: vi.fn(), expireOnlineRequest: vi.fn(), sweepExpiredOnlineRequests: vi.fn(),
}))
vi.mock('../lib/sessions', () => ({ purgeExpiredSessions: vi.fn() }))
vi.mock('../lib/invitations', () => ({ purgeStaleInvitations: vi.fn() }))

import { UnrecoverableError } from 'bullmq'
import { processReminderJob, remindersQueue, scheduleReminders, cancelReminders } from '../lib/queue'
import { isHealthRegulated } from '@beautyos/shared'

function appt(over: Record<string, unknown> = {}) {
  return {
    id: 'a1', tenantId: 't1', status: 'confirmed', isDeleted: false, updatedAt: new Date('2026-10-29T10:00:00Z'),
    startAt: new Date('2026-10-30T09:00:00Z'),
    customer: { id: 'c1', fullName: 'Ayse Yilmaz', phone: '05321234567', email: 'ayse@example.com', marketingConsentSms: true },
    service: { name: 'Dis Beyazlatma' },
    tenant: { id: 't1', name: 'Salon', businessType: 'hair_salon' },
    ...over,
  }
}
const job = { type: 'reminder_24h', appointmentId: 'a1', tenantId: 't1' } as const
const smsOk = { result: { success: true, providerName: 'netgsm' } }

beforeEach(() => {
  vi.clearAllMocks()
  m.smsProvider.name = 'netgsm'
  m.emailConfigured.value = true
  m.sendSms.mockResolvedValue(smsOk)
  m.sendReminderEmail.mockResolvedValue(true)
  m.appointment.findMany.mockResolvedValue([])
  m.messageDelivery.findFirst.mockResolvedValue(null)
  m.messageDelivery.create.mockResolvedValue({})
})
afterEach(() => vi.useRealTimers())

describe('A8 kuyruk ayari', () => {
  it('varsayilan: 5 deneme, ustel bekleme 60 sn baslangic, basarisiz is saklanir', () => {
    void remindersQueue
    const opts = m.queues[0].opts.defaultJobOptions as Record<string, unknown>
    expect(opts.attempts).toBe(5)
    expect(opts.backoff).toEqual({ type: 'exponential', delay: 60_000 })
    expect(opts.removeOnFail).toBe(false)
  })
})

describe('A8 islemeden once kontrol', () => {
  it('randevu kiraci ve isDeleted:false filtresiyle okunur', async () => {
    m.appointment.findFirst.mockResolvedValue(appt())
    await processReminderJob(job)
    expect(m.appointment.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'a1', tenantId: 't1', isDeleted: false })
  })

  it('sorgu hatasi yutulmaz (yeniden denensin)', async () => {
    m.appointment.findFirst.mockRejectedValue(new Error('db down'))
    await expect(processReminderJob(job)).rejects.toThrow('db down')
  })

  it('randevu bulunamazsa (silinmis ya da baska kiraci) is sessizce tamamlanir', async () => {
    m.appointment.findFirst.mockResolvedValue(null)
    await expect(processReminderJob(job)).resolves.toBeUndefined()
    expect(m.sendSms).not.toHaveBeenCalled()
  })

  it.each(['pending', 'cancelled', 'completed', 'no_show', 'in_progress'])('%s durumundaki randevuya gonderim yok', async (status) => {
    m.appointment.findFirst.mockResolvedValue(appt({ status }))
    await expect(processReminderJob(job)).resolves.toBeUndefined()
    expect(m.sendSms).not.toHaveBeenCalled()
    expect(m.sendReminderEmail).not.toHaveBeenCalled()
  })

  it('confirmed randevuda SMS bir kez gider', async () => {
    m.appointment.findFirst.mockResolvedValue(appt())
    await processReminderJob(job)
    expect(m.sendSms).toHaveBeenCalledTimes(1)
  })
})

describe('A8 gecici ve kalici hata', () => {
  it('ag hatasi (NETWORK_ERROR) duz Error firlatir: yeniden denenir', async () => {
    m.appointment.findFirst.mockResolvedValue(appt())
    m.sendSms.mockResolvedValue({ result: { success: false, errorCode: 'NETWORK_ERROR', errorMessage: 'x' } })
    const err = await processReminderJob(job).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(UnrecoverableError)
  })

  it('saglayici gecici hatasi (99 genel hata) yeniden denenir', async () => {
    m.appointment.findFirst.mockResolvedValue(appt())
    m.sendSms.mockResolvedValue({ result: { success: false, errorCode: '99', errorMessage: 'x' } })
    const err = await processReminderJob(job).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(UnrecoverableError)
  })

  it('saglayici kalici kodu (40 baslik onaysiz) UnrecoverableError: yeniden denenmez', async () => {
    m.appointment.findFirst.mockResolvedValue(appt())
    m.sendSms.mockResolvedValue({ result: { success: false, errorCode: '40', errorMessage: 'x' } })
    await expect(processReminderJob(job)).rejects.toBeInstanceOf(UnrecoverableError)
  })
})

describe('A8 kanal secimi (SMS, e-posta yedegi, atla)', () => {
  it('SMS saglayicisi yok (mock) + e-posta var ve yapilandirilmis: e-posta gider, SMS gitmez', async () => {
    m.smsProvider.name = 'mock'
    m.appointment.findFirst.mockResolvedValue(appt())
    await processReminderJob(job)
    expect(m.sendSms).not.toHaveBeenCalled()
    expect(m.sendReminderEmail).toHaveBeenCalledTimes(1)
    expect(m.sendReminderEmail.mock.calls[0][0]).toMatchObject({ to: 'ayse@example.com' })
  })

  it('telefon gecersiz + e-posta var: e-posta gider', async () => {
    m.appointment.findFirst.mockResolvedValue(appt({ customer: { id: 'c1', fullName: 'Ayse', phone: '123', email: 'ayse@example.com' } }))
    await processReminderJob(job)
    expect(m.sendSms).not.toHaveBeenCalled()
    expect(m.sendReminderEmail).toHaveBeenCalledTimes(1)
  })

  it('SMS yok ve e-posta yok: is hatasiz atlanir', async () => {
    m.smsProvider.name = 'mock'
    m.appointment.findFirst.mockResolvedValue(appt({ customer: { id: 'c1', fullName: 'Ayse', phone: '05321234567', email: null } }))
    await expect(processReminderJob(job)).resolves.toBeUndefined()
    expect(m.sendSms).not.toHaveBeenCalled()
    expect(m.sendReminderEmail).not.toHaveBeenCalled()
  })

  it('e-posta yapilandirilmamis: e-posta denenmez, is hatasiz atlanir', async () => {
    m.smsProvider.name = 'mock'
    m.emailConfigured.value = false
    m.appointment.findFirst.mockResolvedValue(appt())
    await expect(processReminderJob(job)).resolves.toBeUndefined()
    expect(m.sendReminderEmail).not.toHaveBeenCalled()
  })

  it('e-posta gonderimi basarisizsa is hata firlatir (yeniden denensin)', async () => {
    m.smsProvider.name = 'mock'
    m.sendReminderEmail.mockResolvedValue(false)
    m.appointment.findFirst.mockResolvedValue(appt())
    await expect(processReminderJob(job)).rejects.toThrow()
  })
})

describe('A8 saat Europe/Istanbul ve sablon', () => {
  it('SMS metnindeki saat Istanbul saatidir (UTC 09:00 = 12:00)', async () => {
    m.appointment.findFirst.mockResolvedValue(appt())
    await processReminderJob(job)
    expect(m.sendSms.mock.calls[0][0].body).toContain('12:00')
  })

  it('dentist: hizmet adi gecmez ama saat ve salon gecer', async () => {
    m.appointment.findFirst.mockResolvedValue(appt({ tenant: { id: 't1', name: 'Salon', businessType: 'dentist' } }))
    await processReminderJob(job)
    const body = m.sendSms.mock.calls[0][0].body as string
    expect(body).not.toContain('Dis Beyazlatma')
    expect(body).toContain('12:00')
    expect(body).toContain('Salon')
  })

  it('aesthetic_clinic e-postasinda da hizmet adi gecmez', async () => {
    m.smsProvider.name = 'mock'
    m.appointment.findFirst.mockResolvedValue(appt({ tenant: { id: 't1', name: 'Salon', businessType: 'aesthetic_clinic' } }))
    await processReminderJob({ type: 'reminder_2h', appointmentId: 'a1', tenantId: 't1' })
    expect(JSON.stringify(m.sendReminderEmail.mock.calls[0][0])).not.toContain('Dis Beyazlatma')
  })

  it('hair_salon: hizmet adi gecer (klinik degil)', async () => {
    m.appointment.findFirst.mockResolvedValue(appt())
    await processReminderJob(job)
    expect(m.sendSms.mock.calls[0][0].body).toContain('Dis Beyazlatma')
  })
})

describe('A8 gece no-show', () => {
  async function runNight(now: string) {
    const tz = process.env.TZ
    process.env.TZ = 'UTC'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(now))
    try {
      await processReminderJob({ type: 'nightly_noshow' })
    } finally {
      if (tz === undefined) delete process.env.TZ
      else process.env.TZ = tz
    }
  }
  const noShowQuery = () => m.appointment.findMany.mock.calls.map((c) => c[0]).find((q) => q.where.endAt)

  it('Istanbul gun siniri kullanilir (UTC 21:30 = Istanbul ertesi gun 00:30)', async () => {
    await runNight('2026-10-29T21:30:00Z')
    const where = noShowQuery().where
    expect(where.startAt.gte.toISOString()).toBe('2026-10-29T21:00:00.000Z')
    expect(where.startAt.lte.toISOString()).toBe('2026-10-30T20:59:59.999Z')
  })

  it('aday sorgusu in_progress ve silinmis randevulari icermez', async () => {
    await runNight('2026-10-29T21:30:00Z')
    const where = noShowQuery().where
    expect(where.status.in).toEqual(['pending', 'confirmed'])
    expect(where.isDeleted).toBe(false)
  })

  it('guncelleme kosulludur (updateMany: id, tenantId, durum) ve musteriye SMS gitmez', async () => {
    m.appointment.findMany.mockImplementation(async (q: { where: { endAt?: unknown } }) =>
      q.where.endAt ? [{ id: 'a9', tenantId: 't1' }] : [])
    m.appointment.updateMany.mockResolvedValue({ count: 1 })
    await runNight('2026-10-29T20:30:00Z')
    expect(m.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'a9', tenantId: 't1', status: { in: ['pending', 'confirmed'] } },
      data: { status: 'no_show' },
    })
    expect(m.sendSms).not.toHaveBeenCalled()
  })
})

describe('A8 hatirlatma kurma, silme ve gece uzlastirma', () => {
  const NOW = new Date('2026-10-30T00:00:00Z')

  it('scheduleReminders yalniz gelecekteki isleri belirlenimci kimlikle ekler', async () => {
    // baslangic 10 saat sonra: 24 saat oncesi gecmis, 2 saat oncesi gelecek
    await scheduleReminders({ appointmentId: 'a1', tenantId: 't1', startAt: new Date(NOW.getTime() + 10 * 3600_000), now: NOW })
    const added = m.queues[0].add.mock.calls
    expect(added.map((c) => c[2].jobId)).toEqual(['reminder-2h-a1'])
    expect(added[0][1]).toEqual({ type: 'reminder_2h', appointmentId: 'a1', tenantId: 't1' })
    expect(added[0][2].delay).toBe(8 * 3600_000)
  })

  it('cancelReminders iki isi de kaldirir', async () => {
    await cancelReminders('a1')
    expect(m.queues[0].remove.mock.calls.map((c) => c[0]).sort()).toEqual(['reminder-24h-a1', 'reminder-2h-a1'])
  })

  it('gece uzlastirma: 48 saatteki confirmed randevular icin isleri ekler; iki kez calisinca ayni kimlikler', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    m.appointment.findMany.mockImplementation(async (q: { where: { status?: unknown; endAt?: unknown } }) =>
      q.where.status === 'confirmed'
        ? [{ id: 'a7', tenantId: 't1', startAt: new Date(NOW.getTime() + 30 * 3600_000) }]
        : [])
    await processReminderJob({ type: 'nightly_noshow' })
    const first = m.queues[0].add.mock.calls.map((c) => c[2].jobId)
    await processReminderJob({ type: 'nightly_noshow' })
    const all = m.queues[0].add.mock.calls.map((c) => c[2].jobId)
    expect(first.sort()).toEqual(['reminder-24h-a7', 'reminder-2h-a7'])
    expect(new Set(all)).toEqual(new Set(first))
    const q = m.appointment.findMany.mock.calls.map((c) => c[0]).find((x) => x.where.status === 'confirmed')
    expect(q.where).toMatchObject({ isDeleted: false })
    expect(q.where.startAt.lte.toISOString()).toBe(new Date(NOW.getTime() + 48 * 3600_000).toISOString())
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

describe('A8 cift gonderim onlemi (ADR-0044 risk)', () => {
  it('ayni randevu ve tur icin yakin zamanda gonderilmis kayit varsa SMS yeniden gitmez, is tamamlanir', async () => {
    m.appointment.findFirst.mockResolvedValue(appt())
    m.messageDelivery.findFirst.mockResolvedValue({ id: 'd1' })
    await expect(processReminderJob(job)).resolves.toBeUndefined()
    expect(m.sendSms).not.toHaveBeenCalled()
    expect(m.sendReminderEmail).not.toHaveBeenCalled()
    const where = m.messageDelivery.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ appointmentId: 'a1', purpose: 'reminder_24h', status: { in: ['sent', 'delivered'] } })
    // Pencere randevunun son degisikliginden sonraki kayitlardir: saati degisen randevunun yeni hatirlatmasi eski kayitla engellenmez.
    expect(where.createdAt).toEqual({ gt: new Date('2026-10-29T10:00:00Z') })
  })

  it('farkli tur (2 saat) icin 24 saat kaydi engel degildir: sorgu turu icerir', async () => {
    m.appointment.findFirst.mockResolvedValue(appt())
    await processReminderJob({ type: 'reminder_2h', appointmentId: 'a1', tenantId: 't1' })
    expect(m.messageDelivery.findFirst.mock.calls[0][0].where.purpose).toBe('reminder_2h')
    expect(m.sendSms).toHaveBeenCalledTimes(1)
  })

  it('e-posta yedegiyle gonderilince de teslim kaydi yazilir (sonraki deneme ayni kaydi gorur)', async () => {
    m.smsProvider.name = 'mock'
    m.appointment.findFirst.mockResolvedValue(appt())
    await processReminderJob(job)
    expect(m.messageDelivery.create).toHaveBeenCalledTimes(1)
    expect(m.messageDelivery.create.mock.calls[0][0].data).toMatchObject({
      tenantId: 't1', appointmentId: 'a1', channel: 'email', purpose: 'reminder_24h', status: 'sent',
    })
  })
})
