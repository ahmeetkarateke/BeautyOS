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

const { mockSendText, mockQueueAdd } = vi.hoisted(() => ({
  mockSendText: vi.fn().mockResolvedValue(undefined),
  mockQueueAdd: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
}))

vi.mock('../channels/telegram.channel', () => ({
  TelegramChannel: vi.fn(() => ({ sendText: mockSendText })),
}))

vi.mock('../lib/queue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/queue')>()
  return {
    ...actual,
    remindersQueue: { add: mockQueueAdd },
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
  let serviceId: string
  let appointmentId: string

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-telegram-token'

    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    tenantSlug = tenant.slug

    const owner = await createTestOwner(tenantId, tenantSlug, suffix)
    ownerToken = owner.token

    const staff = await createTestStaff(tenantId, tenantSlug, suffix)
    staffProfileId = staff.profile.id

    const service = await createTestService(tenantId, suffix)
    serviceId = service.id

    const customer = await createTestCustomer(
      tenantId,
      `+905559${suffix.slice(0, 7).replace(/\D/g, '').padEnd(7, '0')}`,
      suffix,
    )
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
        status: 'pending',
        bookingChannel: 'manual',
      },
    })
    appointmentId = appt.id
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  beforeEach(() => {
    mockSendText.mockClear()
    mockQueueAdd.mockClear()
  })

  // ─── Test 1: Worker doğrudan çağrı — mesaj formatı ────────────────────────

  it('reminder_24h — "Yarın saat" formatında Telegram gönderir', async () => {
    await processReminderJob({ type: 'reminder_24h', appointmentId })

    expect(mockSendText).toHaveBeenCalledTimes(1)
    const [_to, message] = mockSendText.mock.calls[0]
    expect(message).toMatch(/^Merhaba .+! Yarın saat .+'de .+ randevunuz var\. İptal için 'İptal' yazın\.$/)
  })

  it('reminder_2h — "hatırlatmak istedik" formatında Telegram gönderir', async () => {
    await processReminderJob({ type: 'reminder_2h', appointmentId })

    expect(mockSendText).toHaveBeenCalledTimes(1)
    const [_to, message] = mockSendText.mock.calls[0]
    expect(message).toMatch(/^Merhaba .+! .+'deki .+ randevunuzu hatırlatmak istedik\. Görüşürüz!$/)
  })

  it('mesaj müşteri telefona gönderilir', async () => {
    await processReminderJob({ type: 'reminder_24h', appointmentId })

    const [to] = mockSendText.mock.calls[0]
    expect(typeof to).toBe('string')
    expect(to.length).toBeGreaterThan(0)
  })

  // ─── Test 2: Geçmiş tarihli randevu → job eklenmez ────────────────────────

  it('geçmiş tarihli randevu için hiç job eklenmez', async () => {
    const pastStart = new Date(Date.now() - 60 * 60 * 1000) // 1 saat önce

    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId, serviceId, staffId: staffProfileId, startAt: pastStart.toISOString() })

    expect(res.status).toBe(201)
    // Fire-and-forget async — kısa süre bekle
    await new Promise((r) => setTimeout(r, 100))
    expect(mockQueueAdd).not.toHaveBeenCalled()
  })

  it('72 saat sonrası randevu için 2 job eklenir (24h + 2h)', async () => {
    const futureStart = new Date(Date.now() + 72 * 60 * 60 * 1000)
    futureStart.setMinutes(0, 0, 0)

    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId, serviceId, staffId: staffProfileId, startAt: futureStart.toISOString() })

    expect(res.status).toBe(201)
    await new Promise((r) => setTimeout(r, 100))

    expect(mockQueueAdd).toHaveBeenCalledTimes(2)
    const jobTypes = mockQueueAdd.mock.calls.map((call) => call[1].type)
    expect(jobTypes).toContain('reminder_24h')
    expect(jobTypes).toContain('reminder_2h')
  })

  it('3 saat sonrası randevu için sadece 2h job eklenir', async () => {
    const soonStart = new Date(Date.now() + 3 * 60 * 60 * 1000)
    soonStart.setMinutes(0, 0, 0)

    const res = await request(app)
      .post(`/api/v1/tenants/${tenantSlug}/appointments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId, serviceId, staffId: staffProfileId, startAt: soonStart.toISOString() })

    expect(res.status).toBe(201)
    await new Promise((r) => setTimeout(r, 100))

    expect(mockQueueAdd).toHaveBeenCalledTimes(1)
    expect(mockQueueAdd.mock.calls[0][1].type).toBe('reminder_2h')
  })

  // ─── Test 3: Geçersiz appointmentId → hata fırlatmaz ─────────────────────

  it('geçersiz appointmentId → sessizce atlar, hata fırlatmaz', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'

    await expect(
      processReminderJob({ type: 'reminder_24h', appointmentId: fakeId }),
    ).resolves.toBeUndefined()

    expect(mockSendText).not.toHaveBeenCalled()
  })

  it('TELEGRAM_BOT_TOKEN eksikse Telegram göndermez, hata fırlatmaz', async () => {
    const savedToken = process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_BOT_TOKEN

    await expect(
      processReminderJob({ type: 'reminder_24h', appointmentId }),
    ).resolves.toBeUndefined()

    expect(mockSendText).not.toHaveBeenCalled()
    process.env.TELEGRAM_BOT_TOKEN = savedToken
  })
})
