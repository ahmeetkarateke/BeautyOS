import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// S5: bot sahte onay ve test kalintilari. Veritabani, kuyruk ve kanallar sahte; DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn(), findFirst: vi.fn() },
  service: { findFirst: vi.fn(), findMany: vi.fn() },
  staffProfile: { findMany: vi.fn() },
  appointment: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  customer: { upsert: vi.fn(), update: vi.fn() },
}))
const slotsMock = vi.hoisted(() => ({ getSlots: vi.fn() }))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/slots', () => slotsMock)

import {
  getAvailableSlots,
  createAppointment,
  cancelAppointmentByRef,
  ServiceNotFoundError,
} from '../bot/booking.service'
import { getSalon } from '../lib/salon.context'
import { TenantRegistry } from '../lib/tenant.registry'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('K1: sahte slot ve sahte onay kalintisi yok', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) return name === '__tests__' ? [] : sourceFiles(p)
      return p.endsWith('.ts') ? [p] : []
    })
  }

  it('K1: uretim kaynaginda mockSlots, TEST_SALON ve mock-staff gecmez', () => {
    const offenders = sourceFiles(join(__dirname, '..'))
      .filter((f) => /mockSlots|TEST_SALON|mock-staff/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('K1: bot akisi kendi basina RDV- referansi uretmez (referans yalniz kayit yazan servisten gelir)', () => {
    expect(readFileSync(join(__dirname, '..', 'bot', 'flow.handler.ts'), 'utf8')).not.toMatch(/`RDV-\$\{/)
  })

  it('K1: getAvailableSlots hizmet bulunamazsa sahte saat degil ServiceNotFoundError doner ve personel sorgulamaz', async () => {
    dbMock.tenant.findUnique.mockResolvedValue({ slug: 's' })
    dbMock.service.findFirst.mockResolvedValue(null)
    dbMock.service.findMany.mockResolvedValue([{ id: 'sv1', name: 'Saç Kesimi' }])
    await expect(getAvailableSlots('t1', 'lazer epilasyon', 'yarın', undefined)).rejects.toBeInstanceOf(ServiceNotFoundError)
    expect(dbMock.staffProfile.findMany).not.toHaveBeenCalled()
  })

  it('K1: getSalon bilinmeyen kiracida kurgusal salon degil null doner; test-tenant ozel durumu yok', async () => {
    dbMock.tenant.findUnique.mockResolvedValue(null)
    expect(await getSalon('t-yok')).toBeNull()
    expect(await getSalon('test-tenant')).toBeNull()
    expect(dbMock.tenant.findUnique).toHaveBeenCalledTimes(2)
  })
})

describe('K2: hizmet eslestirmesi tek yerde ve Turkce-I guvenli', () => {
  function stageSlots() {
    dbMock.tenant.findUnique.mockResolvedValue({ slug: 's' })
    dbMock.staffProfile.findMany.mockResolvedValue([])
  }

  it('K2: aksansiz giris aksanli hizmete eslesir (sac kesimi -> Saç Kesimi)', async () => {
    stageSlots()
    dbMock.service.findFirst.mockResolvedValue(null)
    dbMock.service.findMany.mockResolvedValue([{ id: 'sv1', name: 'Saç Kesimi' }])
    await getAvailableSlots('t1', 'sac kesimi', 'yarın', undefined)
    expect(dbMock.staffProfile.findMany).toHaveBeenCalled()
    expect(dbMock.staffProfile.findMany.mock.calls[0][0].where.serviceAssignments.some.serviceId).toBe('sv1')
  })

  it('K2: BUYUK I iceren giris noktasiz-i hizmete eslesir (KIRPMA -> Kırpma)', async () => {
    stageSlots()
    dbMock.service.findFirst.mockResolvedValue(null)
    dbMock.service.findMany.mockResolvedValue([{ id: 'sv2', name: 'Kırpma' }])
    await getAvailableSlots('t1', 'KIRPMA', 'yarın', undefined)
    expect(dbMock.staffProfile.findMany.mock.calls[0][0].where.serviceAssignments.some.serviceId).toBe('sv2')
  })

  it('K2: createAppointment ayni eslestirmeyi kullanir; hizmet yoksa ServiceNotFoundError ve randevu yazilmaz', async () => {
    dbMock.service.findFirst.mockResolvedValue(null)
    dbMock.service.findMany.mockResolvedValue([])
    await expect(
      createAppointment({ tenantId: 't1', customerPhone: '905320000001', customerName: 'A', serviceName: 'yok', slotId: '2026-11-02T10:00:00__sp1', channel: 'whatsapp' }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError)
    expect(dbMock.appointment.create).not.toHaveBeenCalled()
    expect(dbMock.customer.upsert).not.toHaveBeenCalled()
  })
})

describe('K2: akis netlestirme sorusu sorar', () => {
  it('K2: bilinmeyen hizmette hizmet listesiyle sorar, adimi awaiting_service yapar, onay/referans yazmaz', async () => {
    vi.resetModules()
    vi.doMock('../bot/booking.service', async (orig) => {
      const actual = await orig<typeof import('../bot/booking.service')>()
      return { ...actual, getAvailableSlots: vi.fn().mockRejectedValue(new actual.ServiceNotFoundError('lazer')), createAppointment: vi.fn(), cancelAppointmentByRef: vi.fn() }
    })
    const { FlowHandler } = await import('../bot/flow.handler')
    const session = { sessionId: 's', tenantId: 't1', channelType: 'whatsapp', from: '905320000001', currentIntent: 'book', entities: { service: 'lazer', datePreference: 'yarın' }, messages: [], turnCount: 3, clarifyCount: 0, step: 'awaiting_date', createdAt: '', lastMessageAt: '' }
    const sessionService = { getOrCreate: vi.fn().mockResolvedValue(session), addMessage: vi.fn(), save: vi.fn(), reset: vi.fn() }
    const sent: string[] = []
    const channel = { type: 'whatsapp', sendText: vi.fn(async (_to: string, t: string) => { sent.push(t) }) }
    const salon = { name: 'S', address: 'a', workingHours: '09-19', services: [{ name: 'Saç Kesimi', duration: 30, price: 250 }, { name: 'Manikür', duration: 45, price: 200 }], staff: [] }
    const handler = new FlowHandler(sessionService as never, { detect: vi.fn() } as never)
    await handler.handle(channel as never, { channelType: 'whatsapp', from: '905320000001', text: 'yarın', messageId: 'm', timestamp: new Date(), rawPayload: {} }, salon as never, 't1')
    expect(session.step).toBe('awaiting_service')
    expect(sent.join('\n')).toMatch(/Saç Kesimi/)
    expect(sent.join('\n')).toMatch(/Manikür/)
    expect(sent.join('\n')).not.toMatch(/RDV-|Randevunuz oluşturuldu/)
    vi.doUnmock('../bot/booking.service')
  })
})

describe('K3: WhatsApp eslesmesi yoksa mesaj dusurulur', () => {
  it('K3: phoneNumberId bossa DB sorgulanmaz ve null doner', async () => {
    expect(await new TenantRegistry().getByPhoneNumberId('')).toBeNull()
    expect(dbMock.tenant.findFirst).not.toHaveBeenCalled()
  })

  it('K3: eslesen kiracı yoksa null ("ilk kiracı" secilmez); sorgu phoneNumberId ile sinirli', async () => {
    dbMock.tenant.findFirst.mockResolvedValue(null)
    expect(await new TenantRegistry().getByPhoneNumberId('109876')).toBeNull()
    const where = dbMock.tenant.findFirst.mock.calls[0][0].where
    expect(where.isActive).toBe(true)
    expect(JSON.stringify(where)).toContain('109876')
  })

  it('K3: eslesen kiracı varsa id doner', async () => {
    dbMock.tenant.findFirst.mockResolvedValue({ id: 't-eslesen' })
    expect(await new TenantRegistry().getByPhoneNumberId('55555')).toBe('t-eslesen')
  })

  describe('webhook yonlendirmesi', () => {
    afterEach(() => { delete process.env.TELEGRAM_TENANT_ID })

    async function postWhatsapp(registry: { getByPhoneNumberId: ReturnType<typeof vi.fn>; getByBotToken: ReturnType<typeof vi.fn> }) {
      vi.resetModules()
      vi.doMock('../channels/channel.factory', () => ({
        getChannel: () => ({ verifyWebhook: () => true, parseWebhook: () => ({ channelType: 'whatsapp', from: '905320000001', text: 'merhaba', messageId: 'm', timestamp: new Date(), rawPayload: {} }) }),
      }))
      vi.doMock('../lib/salon.context', () => ({ getSalon: vi.fn().mockResolvedValue({ name: 'S', services: [], staff: [], address: '', workingHours: '' }) }))
      const { createWebhookRouter } = await import('../routes/webhook.route')
      const handle = vi.fn().mockResolvedValue(undefined)
      const app = express().use(express.json()).use('/webhook', createWebhookRouter({ handle } as never, registry as never))
      await request(app).post('/webhook/whatsapp').send({ entry: [{ changes: [{ value: { phone_number_id: '777' } }] }] })
      await new Promise((r) => setTimeout(r, 20))
      vi.doUnmock('../channels/channel.factory')
      vi.doUnmock('../lib/salon.context')
      return handle
    }

    it('K3: eslesme yoksa WhatsApp mesaji islenmez', async () => {
      const handle = await postWhatsapp({ getByPhoneNumberId: vi.fn().mockResolvedValue(null), getByBotToken: vi.fn() })
      expect(handle).not.toHaveBeenCalled()
    })

    it('K3: TELEGRAM_TENANT_ID ortam degiskeni WhatsApp mesajlarini o kiraciya yonlendirmez', async () => {
      process.env.TELEGRAM_TENANT_ID = 't-telegram'
      const registry = { getByPhoneNumberId: vi.fn().mockResolvedValue(null), getByBotToken: vi.fn() }
      const handle = await postWhatsapp(registry)
      expect(handle).not.toHaveBeenCalled()
      expect(registry.getByPhoneNumberId).toHaveBeenCalledWith('777')
    })
  })
})

describe('K4: iptal sahiplik ister', () => {
  const future = new Date(Date.now() + 24 * 3600 * 1000)

  it('K4: sorgu kiraci ve musteri telefonu ile sinirlanir; baskasinin kodu not_found', async () => {
    dbMock.appointment.findFirst.mockResolvedValue(null)
    const r = await cancelAppointmentByRef('t1', 'RDV-ABC', '905320000009')
    expect(r).toEqual({ ok: false, reason: 'not_found' })
    const where = dbMock.appointment.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ tenantId: 't1', referenceCode: 'RDV-ABC' })
    // WhatsApp: 905... biçimi normalize (+90...) kayıtla eşleşir; müşterisiz talep requestedPhone ile eşleşir
    expect(where.OR).toEqual([
      { customer: { phone: { in: expect.arrayContaining(['905320000009', '+905320000009']) } } },
      { requestedPhone: { in: expect.arrayContaining(['905320000009', '+905320000009']) } },
    ])
    expect(dbMock.appointment.update).not.toHaveBeenCalled()
  })

  it('ADR-0039: Telegram kanalinda (exact) kimlik sohbet no ile eslesir (telefon alanlariyla degil), normalize edilmez', async () => {
    dbMock.appointment.findFirst.mockResolvedValue(null)
    await cancelAppointmentByRef('t1', 'RDV-ABC', '905320000009', { exact: true })
    const where = dbMock.appointment.findFirst.mock.calls[0][0].where
    expect(where.OR).toEqual([{ customer: { telegramChatId: '905320000009' } }, { requestedChatId: '905320000009' }])
  })

  it('K4: sahibi kendi randevusunu iptal eder', async () => {
    dbMock.appointment.findFirst.mockResolvedValue({ id: 'a1', startAt: future })
    dbMock.appointment.update.mockResolvedValue({})
    expect(await cancelAppointmentByRef('t1', 'RDV-ABC', '905320000001')).toEqual({ ok: true })
    expect(dbMock.appointment.update.mock.calls[0][0].data.status).toBe('cancelled')
  })

  it('K4: telefonsuz (bos) kimlikle iptal denenmez', async () => {
    expect(await cancelAppointmentByRef('t1', 'RDV-ABC', '')).toEqual({ ok: false, reason: 'not_found' })
    expect(dbMock.appointment.findFirst).not.toHaveBeenCalled()
  })

  it('K4: 2 saatten az kalan randevu sahibine bile too_soon', async () => {
    dbMock.appointment.findFirst.mockResolvedValue({ id: 'a1', startAt: new Date(Date.now() + 3600 * 1000) })
    expect(await cancelAppointmentByRef('t1', 'RDV-ABC', '905320000001')).toEqual({ ok: false, reason: 'too_soon' })
  })
})

describe('S2ek-2 Onemli 2: bot yakin saatte bekleyen talep icin bos soz vermez', () => {
  it('SlotTooSoonForApprovalError -> yanit "alindi" demez, salonu aramasini soyler; oturum sifirlanmaz', async () => {
    vi.resetModules()
    vi.doMock('../bot/booking.service', async (orig) => {
      const actual = await orig<typeof import('../bot/booking.service')>()
      return { ...actual, createAppointment: vi.fn().mockRejectedValue(new actual.SlotTooSoonForApprovalError()) }
    })
    const { FlowHandler } = await import('../bot/flow.handler')
    const session = { sessionId: 's', tenantId: 't1', channelType: 'whatsapp', from: '905320000001', currentIntent: 'book', entities: { service: 'Saç Kesimi', confirmedSlot: '2026-11-20T10:00:00__sp1' }, messages: [], turnCount: 5, clarifyCount: 0, step: 'awaiting_confirm', createdAt: '', lastMessageAt: '' }
    const sessionService = { getOrCreate: vi.fn().mockResolvedValue(session), addMessage: vi.fn(), save: vi.fn(), reset: vi.fn() }
    const sent: string[] = []
    const channel = { type: 'whatsapp', sendText: vi.fn(async (_to: string, t: string) => { sent.push(t) }) }
    const salon = { name: 'S', address: 'a', workingHours: '09-19', services: [], staff: [] }
    const handler = new FlowHandler(sessionService as never, { detect: vi.fn() } as never)
    await handler.handle(channel as never, { channelType: 'whatsapp', from: '905320000001', text: 'evet', messageId: 'm', timestamp: new Date(), rawPayload: {} }, salon as never, 't1')
    const text = sent.join('\n')
    expect(text).not.toMatch(/alındı|oluşturuldu/)
    expect(text).toMatch(/salonu arayın/)
    expect(sessionService.reset).not.toHaveBeenCalled()
    vi.doUnmock('../bot/booking.service')
  })
})

describe('ADR-0038 Onemli 1: bot bekleyen talepte bos soz vermez', () => {
  it('pending dönen kayitta yanit "iletisime gececek" der; bildirim sozu (bilgi verilecek) yoktur', async () => {
    vi.resetModules()
    vi.doMock('../bot/booking.service', async (orig) => {
      const actual = await orig<typeof import('../bot/booking.service')>()
      return { ...actual, createAppointment: vi.fn().mockResolvedValue({ referenceCode: 'RDV-X1', status: 'pending' }) }
    })
    const { FlowHandler } = await import('../bot/flow.handler')
    const session = { sessionId: 's', tenantId: 't1', channelType: 'whatsapp', from: '905320000001', currentIntent: 'book', entities: { service: 'Saç Kesimi', confirmedSlot: '2026-11-20T10:00:00__sp1' }, messages: [], turnCount: 5, clarifyCount: 0, step: 'awaiting_confirm', createdAt: '', lastMessageAt: '' }
    const sessionService = { getOrCreate: vi.fn().mockResolvedValue(session), addMessage: vi.fn(), save: vi.fn(), reset: vi.fn() }
    const sent: string[] = []
    const channel = { type: 'whatsapp', sendText: vi.fn(async (_to: string, t: string) => { sent.push(t) }) }
    const salon = { name: 'S', address: 'a', workingHours: '09-19', services: [], staff: [] }
    const handler = new FlowHandler(sessionService as never, { detect: vi.fn() } as never)
    await handler.handle(channel as never, { channelType: 'whatsapp', from: '905320000001', text: 'evet', messageId: 'm', timestamp: new Date(), rawPayload: {} }, salon as never, 't1')
    const text = sent.join('\n')
    expect(text).toMatch(/iletişime geçecek/)
    expect(text).not.toMatch(/bilgi verilecek/)
    expect(text).toContain('RDV-X1')
    vi.doUnmock('../bot/booking.service')
  })
})
