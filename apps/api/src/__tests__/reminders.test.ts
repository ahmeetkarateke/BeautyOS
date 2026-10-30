import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestStaff,
  createTestService,
  createTestCustomer,
  cleanupTenant,
} from './helpers/setup'

// ─── vi.hoisted: mock'lar vi.mock factory'den önce oluşturulmalı ─────────────

const { mockSendSms, mockQueueAdd } = vi.hoisted(() => ({
  mockSendSms: vi.fn(),
  mockQueueAdd: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
}))

// Hatırlatma SMS ile gider (bbd71c6). Dış sağlayıcı sahtelenir; telefon normalleştirme gerçektir.
vi.mock('../lib/sms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sms')>()
  return { ...actual, sendSms: mockSendSms, getSmsProvider: () => ({ name: 'netgsm' }) }
})

vi.mock('../lib/queue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/queue')>()
  return {
    ...actual,
    remindersQueue: { add: mockQueueAdd },
    // Gercek scheduleReminders kendi modulundeki kuyrugu kullanir (mock'lanamaz); ayni is adlari ve kimlikleriyle mockQueueAdd'e yazar.
    scheduleReminders: async (i: { appointmentId: string; tenantId: string; startAt: Date; now?: Date }) => {
      const nowMs = (i.now ?? new Date()).getTime()
      for (const [kind, hours] of [['24h', 24], ['2h', 2]] as const) {
        const delay = i.startAt.getTime() - hours * 3_600_000 - nowMs
        if (delay > 0) {
          await mockQueueAdd(`reminder-${kind}`, { type: `reminder_${kind}`, appointmentId: i.appointmentId, tenantId: i.tenantId }, { delay, jobId: `reminder-${kind}-${i.appointmentId}` })
        }
      }
    },
  }
})

// Mock'lar kurulduktan sonra import et
import { processReminderJob } from '../lib/queue'

// ─── Test altyapısı ────────────────────────────────────────────────────────────

const app = createApp({ rateLimitMax: 1000 })

describe('BullMQ hatırlatma sistemi', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let tenantSlug: string
  let ownerToken: string
  let staffProfileId: string
  let customerId: string
  let customerPhone: string
  let serviceId: string
  let appointmentId: string

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    tenantSlug = tenant.slug

    const owner = await createTestOwner(tenantId, tenantSlug, suffix)
    ownerToken = owner.token

    const staff = await createTestStaff(tenantId, tenantSlug, suffix)
    staffProfileId = staff.profile.id

    const service = await createTestService(tenantId, suffix)
    serviceId = service.id

    // Randevu oluşturma, personelin hizmeti yapabildiğini ister (STAFF_NOT_SKILLED, 014f1b6).
    await db.staffServiceAssignment.create({
      data: { staffId: staffProfileId, serviceId, tenantId, isActive: true },
    })

    // +90 5XX XXX XX XX: normalizePhoneTR'nin kabul ettiği 10 haneli ulusal numara.
    customerPhone = `+90555${suffix.replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`
    const customer = await createTestCustomer(tenantId, customerPhone, suffix)
    customerId = customer.id

    // 48 saat sonraya randevu oluştur (processReminderJob testleri için)
    const futureStart = new Date(Date.now() + 48 * 60 * 60 * 1000)
    futureStart.setMinutes(0, 0, 0)

    const appt = await db.appointment.create({
      data: {
        tenantId,
        customerId,
        serviceId,
        staffId: staffProfileId,
        startAt: futureStart,
        endAt: new Date(futureStart.getTime() + 60 * 60 * 1000),
        priceCharged: 150,
        referenceCode: `APT-TEST-${suffix}`,
        status: 'confirmed',
        bookingChannel: 'manual',
      },
    })
    appointmentId = appt.id
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  beforeEach(() => {
    mockSendSms.mockReset()
    mockSendSms.mockResolvedValue({ delivery: {}, result: { success: true, providerName: 'mock' } })
    mockQueueAdd.mockClear()
  })

  async function randevuOlustur(startAt: Date) {
    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId, serviceId, staffId: staffProfileId, startAt: startAt.toISOString() })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.id as string
  }

  function kuyrukCagrilari(appointment: string) {
    return mockQueueAdd.mock.calls.filter((c) => c[1].appointmentId === appointment)
  }

  // Kuyruğa ekleme fire-and-forget: sabit bekleme yerine beklenen çağrı sayısına kadar koşul beklenir.
  async function kuyrukCagrilariniBekle(adet: number, appointment: string) {
    await vi.waitFor(() => expect(kuyrukCagrilari(appointment)).toHaveLength(adet))
    return kuyrukCagrilari(appointment)
  }

  // ─── Test 1: Worker doğrudan çağrı — SMS metni ve alıcı ───────────────────

  it('reminder_24h — "yarın saat" metniyle SMS gönderir', async () => {
    await processReminderJob({ type: 'reminder_24h', appointmentId })

    expect(mockSendSms).toHaveBeenCalledTimes(1)
    const params = mockSendSms.mock.calls[0][0]
    expect(params.purpose).toBe('reminder_24h')
    expect(params.body).toMatch(/^Test Salon .+: Sayın Test Müşteri .+, yarın saat \d{2}:\d{2}'de Test Hizmet .+ randevunuz bulunmaktadır\. Bilginize\.$/)
  })

  it('reminder_2h — "bugün saat" metniyle SMS gönderir', async () => {
    await processReminderJob({ type: 'reminder_2h', appointmentId })

    expect(mockSendSms).toHaveBeenCalledTimes(1)
    const params = mockSendSms.mock.calls[0][0]
    expect(params.purpose).toBe('reminder_2h')
    expect(params.body).toMatch(/bugün saat \d{2}:\d{2}'de Test Hizmet .+ randevunuz vardır\. Sizi bekliyoruz\.$/)
  })

  it('SMS müşterinin telefonuna, kendi kiracısı ve randevusu bağlamıyla gönderilir', async () => {
    await processReminderJob({ type: 'reminder_24h', appointmentId })

    const params = mockSendSms.mock.calls[0][0]
    expect(params.to).toBe(customerPhone)
    expect(params.tenantId).toBe(tenantId)
    expect(params.customerId).toBe(customerId)
    expect(params.appointmentId).toBe(appointmentId)
  })

  it('iptal edilmiş randevu için SMS gönderilmez', async () => {
    await db.appointment.update({ where: { id: appointmentId }, data: { status: 'cancelled' } })
    try {
      await processReminderJob({ type: 'reminder_24h', appointmentId })
      expect(mockSendSms).not.toHaveBeenCalled()
    } finally {
      await db.appointment.update({ where: { id: appointmentId }, data: { status: 'confirmed' } })
    }
  })

  it('telefon normalleştirilemezse SMS gönderilmez, hata fırlatmaz', async () => {
    // Yalnız telefon bozuk; randevu aktif ve diğer her şey geçerli (tek kural bozulur).
    const bozuk = await createTestCustomer(tenantId, '12345678', `${suffix}-bozuk`)
    // beforeAll randevulari ~48 saatte ayni uzmanda; S3 EXCLUDE kisitina takilmamak icin 5 gun sonra.
    const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    const appt = await db.appointment.create({
      data: {
        tenantId,
        customerId: bozuk.id,
        serviceId,
        staffId: staffProfileId,
        startAt: start,
        endAt: new Date(start.getTime() + 60 * 60 * 1000),
        priceCharged: 150,
        referenceCode: `APT-BOZUK-${suffix}`,
        status: 'confirmed',
        bookingChannel: 'manual',
      },
    })

    await expect(processReminderJob({ type: 'reminder_24h', appointmentId: appt.id })).resolves.toBeUndefined()
    expect(mockSendSms).not.toHaveBeenCalled()
  })

  // ─── Test 2: Kuyruğa ekleme ──────────────────────────────────────────────

  it('geçmiş tarihli randevu için hiç job eklenmez', async () => {
    const pastId = await randevuOlustur(new Date(Date.now() - 60 * 60 * 1000))

    // Olmayan bir şeyi sabit beklemeyle ispatlamak yerine: ardından gelen geçerli randevunun işleri
    // eklenene kadar beklenir. İki istek aynı sırayla işlendiğinden geçmiş randevu için iş eklenecek
    // olsaydı bu noktaya kadar eklenmiş olurdu.
    const sonrakiId = await randevuOlustur(new Date(Date.now() + 72 * 60 * 60 * 1000))
    await kuyrukCagrilariniBekle(2, sonrakiId)

    expect(kuyrukCagrilari(pastId)).toHaveLength(0)
  })

  it('100 saat sonrası randevu için 2 job eklenir (24h + 2h, belirlenimci jobId)', async () => {
    const futureStart = new Date(Date.now() + 100 * 60 * 60 * 1000)
    futureStart.setMinutes(0, 0, 0)
    const id = await randevuOlustur(futureStart)

    const cagrilar = await kuyrukCagrilariniBekle(2, id)

    expect(cagrilar.map((c) => c[1].type).sort()).toEqual(['reminder_24h', 'reminder_2h'])
    expect(cagrilar.map((c) => c[2].jobId).sort()).toEqual([`reminder-24h-${id}`, `reminder-2h-${id}`].sort())
  })

  it('4 saat sonrası randevu için sadece 2h job eklenir (24h zamanı geçmiş)', async () => {
    const soonStart = new Date(Date.now() + 4 * 60 * 60 * 1000)
    const id = await randevuOlustur(soonStart)

    const cagrilar = await kuyrukCagrilariniBekle(1, id)

    expect(cagrilar[0][1].type).toBe('reminder_2h')
  })

  // ─── Test 3: Geçersiz appointmentId → hata fırlatmaz ─────────────────────

  it('geçersiz appointmentId → sessizce atlar, hata fırlatmaz', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'

    await expect(
      processReminderJob({ type: 'reminder_24h', appointmentId: fakeId }),
    ).resolves.toBeUndefined()

    expect(mockSendSms).not.toHaveBeenCalled()
  })
})
