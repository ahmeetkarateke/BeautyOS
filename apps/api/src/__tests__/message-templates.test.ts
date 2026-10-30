import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ADR-0047: sablon degismezligi (hash kilidi), teslim kaydinda govde yok / sablon anahtari ve surumu var,
// OTP hicbir yerde saklanmaz, 1 yil sonra alici anonimlesir. db ve saglayici sahte; DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  messageDelivery: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  phoneVerification: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
}))
const providerSend = vi.hoisted(() => vi.fn())
vi.mock('../lib/db', () => ({ db: dbMock }))

import { TEMPLATE_IDS, renderTemplate, templateSource } from '../lib/messages/templates'
import { sendSms, getSmsProvider } from '../lib/sms'
import { sendVerificationCode } from '../lib/phone-verification'
import { anonymizeOldDeliveries, DELIVERY_RETENTION_MS } from '../lib/message-retention'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

// Yayinlanmis surumlerin degismez ozetleri. Bir metin degistirilirse bu test kirmizi olur: yeni SURUM eklenmeli.
const LOCKED: Record<string, string> = {
  'reminder_24h@1': 'a70bb29d52c6b4d7d545c77f895e524b8fcce53a67e4ac78e8f93a66a70bbfda',
  'reminder_24h_health@1': '09add2b0dd54332eb1ed6d481e1a19eedf0761eb2832cef10b7dc14b524b73d9',
  'reminder_2h@1': 'cd9fc66fcd3963db2d442f956488ed4e2b99186b0754de95247d20f20832cc2d',
  'reminder_2h_health@1': 'e4dd75c3ecd1f137ab959bdb90dbb025d9a9a568cb9a245c393638faf868927e',
  'phone_verification@1': 'c9022ca6a39f4d2282538bce202f4f1d21c799c878d803ffb62ba7af7dccd5b6',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = 'x'.repeat(40)
  dbMock.messageDelivery.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'd1', ...data }))
  dbMock.messageDelivery.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'd1', ...data }))
  dbMock.messageDelivery.updateMany.mockResolvedValue({ count: 2 })
})

describe('sablon hash kilidi', () => {
  it('her yayinlanmis (anahtar, surum) metninin sha-256 ozeti sabit listeyle ayni; liste ve sablonlar birebir', () => {
    expect([...TEMPLATE_IDS].sort()).toEqual(Object.keys(LOCKED).sort())
    for (const id of TEMPLATE_IDS) {
      const [key, version] = id.split('@')
      expect(sha256(templateSource({ key, version: Number(version) }))).toBe(LOCKED[id])
    }
  })

  it('render: yer tutucular dolar; eksik parametre hata verir; klinik sablonunda hizmet adi yer tutucusu yok', () => {
    expect(renderTemplate({ key: 'reminder_24h', version: 1 }, { salon: 'S', name: 'A', time: '12:00', service: 'Sac' })).toBe(
      "S: Sayın A, yarın saat 12:00'de Sac randevunuz bulunmaktadır. Bilginize.",
    )
    expect(() => renderTemplate({ key: 'reminder_24h', version: 1 }, { salon: 'S' })).toThrow()
    expect(templateSource({ key: 'reminder_24h_health', version: 1 })).not.toContain('{service}')
  })
})

describe('sendSms: sablonlu iletide govde saklanmaz', () => {
  it('teslim kaydinda body null, templateKey ve templateVersion dolu; saglayiciya gercek metin gider', async () => {
    const spy = vi.spyOn(getSmsProvider(), 'send').mockResolvedValue({ success: true, providerName: 'mock' })
    await sendSms({
      tenantId: 't1', to: '+905321234567', body: 'Gercek metin Ayse',
      template: { key: 'reminder_24h', version: 1 }, purpose: 'reminder_24h' as never,
    } as never)
    const data = dbMock.messageDelivery.create.mock.calls[0][0].data
    expect(data.body).toBeNull()
    expect(data).toMatchObject({ templateKey: 'reminder_24h', templateVersion: 1, channel: 'sms' })
    expect(spy.mock.calls[0][0].body).toBe('Gercek metin Ayse')
    expect(JSON.stringify(dbMock.messageDelivery.update.mock.calls[0][0])).not.toContain('Gercek metin')
  })

  it('serbest metin (sablonsuz) gelirse govde saklanir', async () => {
    vi.spyOn(getSmsProvider(), 'send').mockResolvedValue({ success: true, providerName: 'mock' })
    await sendSms({ tenantId: 't1', to: '+905321234567', body: 'Serbest', purpose: 'transactional' as never } as never)
    expect(dbMock.messageDelivery.create.mock.calls[0][0].data.body).toBe('Serbest')
  })
})

describe('OTP hicbir yerde saklanmaz', () => {
  it('dogrulama kodu teslim kaydinda (govde null, phone_verification@1) ve veritabaninda duz metin olarak yok', async () => {
    dbMock.phoneVerification.findFirst.mockResolvedValue(null)
    dbMock.phoneVerification.count.mockResolvedValue(0)
    dbMock.phoneVerification.create.mockResolvedValue({})
    let sentBody = ''
    vi.spyOn(getSmsProvider(), 'send').mockImplementation(async (input) => {
      sentBody = input.body
      return { success: true, providerName: 'mock' }
    })
    const res = await sendVerificationCode({ phone: '05321234567', tenantId: 't1' } as never)
    expect(res.ok).toBe(true)
    const code = /(\d{6})/.exec(sentBody)![1]
    const delivery = dbMock.messageDelivery.create.mock.calls[0][0].data
    expect(delivery).toMatchObject({ body: null, templateKey: 'phone_verification', templateVersion: 1 })
    const everything = JSON.stringify([dbMock.messageDelivery.create.mock.calls, dbMock.messageDelivery.update.mock.calls, dbMock.phoneVerification.create.mock.calls])
    expect(everything).not.toContain(code)
  })
})

describe('L4: 1 yil sonra alici anonimlesir', () => {
  it('createdAt tam 1 yil oncesinden eski kayitlarda phone, email ve govde NULL; bir gun sonrasi dokunulmaz', async () => {
    const now = new Date('2027-10-29T20:30:00Z')
    expect(await anonymizeOldDeliveries(now)).toBe(4)
    const cutoff = new Date(now.getTime() - DELIVERY_RETENTION_MS)
    expect(DELIVERY_RETENTION_MS).toBe(365 * 86_400_000)
    const calls = dbMock.messageDelivery.updateMany.mock.calls.map((c: unknown[]) => c[0] as { where: Record<string, unknown>; data: Record<string, unknown> })
    expect(calls).toHaveLength(2)
    for (const call of calls) expect(call.where.createdAt).toEqual({ lt: cutoff })
    const templated = calls.find((c) => JSON.stringify(c.where.templateKey) === JSON.stringify({ not: null }))
    expect(templated?.data).toEqual({ phone: null, email: null, body: null })
  })

  it('sablonsuz satir govdeyle birlikte legacy@0 olur; CHECK (govde ya da anahtar+surum) bozulmaz', async () => {
    await anonymizeOldDeliveries(new Date())
    const calls = dbMock.messageDelivery.updateMany.mock.calls.map((c: unknown[]) => c[0] as { where: Record<string, unknown>; data: Record<string, unknown> })
    const untemplated = calls.find((c) => c.where.templateKey === null)
    expect(untemplated?.data).toEqual({ phone: null, email: null, body: null, templateKey: 'legacy', templateVersion: 0 })
  })

  it('zaten anonim kayitlar yeniden yazilmaz (phone/email/body bos olmayan satirlar)', async () => {
    await anonymizeOldDeliveries(new Date())
    for (const [arg] of dbMock.messageDelivery.updateMany.mock.calls) {
      expect(arg.where.OR).toEqual([{ phone: { not: null } }, { email: { not: null } }, { body: { not: null } }])
    }
  })
})

describe('migration', () => {
  const sql = readFileSync(join(__dirname, '../../prisma/migrations/20261029073000_message_templates/migration.sql'), 'utf8')

  it('govde bos olabilir, sablon alanlari eklenir, CHECK govde ya da (anahtar, surum) ister', () => {
    expect(sql).toMatch(/ALTER COLUMN "body" DROP NOT NULL/)
    expect(sql).toMatch(/ADD COLUMN "templateKey" TEXT/)
    expect(sql).toMatch(/ADD COLUMN "templateVersion" INTEGER/)
    expect(sql).toMatch(/CHECK \("body" IS NOT NULL OR \("templateKey" IS NOT NULL AND "templateVersion" IS NOT NULL\)\)/)
  })

  it('eski kayitlarin hepsi legacy@0 olur; reminder_*@1 ya da phone_verification@1 yazilmaz (metin sablondan uretilmedi)', () => {
    expect(sql).not.toMatch(/THEN\s+'reminder_|THEN\s+'phone_verification'|"templateVersion"\s*=\s*1/)
    expect(sql).toMatch(/SET "templateKey" = 'legacy', "templateVersion" = 0/)
  })

  it('govde yalniz sablonlu amaclarda (reminder_24h, reminder_2h, verification) bosaltilir; campaign ve transactional kalir', () => {
    const update = sql.match(/UPDATE "message_deliveries" SET "body" = NULL[^;]*;/)?.[0] ?? ''
    expect(update).toMatch(/WHERE "purpose" IN \('reminder_24h', 'reminder_2h', 'verification'\)/)
    expect(update).not.toMatch(/campaign|transactional/)
  })
})
