import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '../lib/db'
import { anonymizeOldDeliveries } from '../lib/message-retention'
import { uniqueSuffix, createTestTenant, cleanupTenant } from './helpers/setup'

// L4 / ADR-0047: gece işi şablonsuz (gövdeli) eski satırda CHECK'i bozmamalı. Gerçek PG ister.
describe('anonymizeOldDeliveries: sablonsuz eski satir CHECK hatasi vermez (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let untemplatedId: string
  let templatedId: string
  let freshId: string

  beforeAll(async () => {
    tenantId = (await createTestTenant(suffix)).id
    const old = new Date(Date.now() - 400 * 86_400_000)
    const base = { tenantId, channel: 'sms' as const, purpose: 'campaign' as const, phone: '+905320000000' }
    untemplatedId = (await db.messageDelivery.create({ data: { ...base, body: 'Kampanya metni', createdAt: old } })).id
    templatedId = (await db.messageDelivery.create({
      data: { ...base, purpose: 'reminder_24h', templateKey: 'reminder_24h', templateVersion: 1, createdAt: old },
    })).id
    freshId = (await db.messageDelivery.create({ data: { ...base, body: 'Yeni kayit' } })).id
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  it('1 yillik sablonsuz satir legacy@0 olur, telefon ve govde silinir; sablonlu satir anahtarini korur; taze satira dokunulmaz', async () => {
    await expect(anonymizeOldDeliveries()).resolves.toBeGreaterThanOrEqual(2)
    const untemplated = await db.messageDelivery.findUniqueOrThrow({ where: { id: untemplatedId } })
    expect(untemplated).toMatchObject({ phone: null, body: null, templateKey: 'legacy', templateVersion: 0 })
    const templated = await db.messageDelivery.findUniqueOrThrow({ where: { id: templatedId } })
    expect(templated).toMatchObject({ phone: null, body: null, templateKey: 'reminder_24h', templateVersion: 1 })
    const fresh = await db.messageDelivery.findUniqueOrThrow({ where: { id: freshId } })
    expect(fresh).toMatchObject({ phone: '+905320000000', body: 'Yeni kayit', templateKey: null })
  })
})
