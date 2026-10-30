import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import { uniqueSuffix, createTestTenant, createTestOwner, createTestManager, cleanupTenant } from './helpers/setup'

// S-ayarlar-yetki (guvenlik): PATCH /settings icinde activeModules ve businessType yalniz sahibindir; mudur 403 alir ve
// hicbir sey yazilmaz (gercek PG). Bu dosya tests/entegrasyon altindadir; api-test.sh kosudan once apps/api/src/__tests__/ icine kopyalar.
const app = createApp({ rateLimitMax: 1000 })

describe('S-ayarlar-yetki: sahip alanlari (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let slug: string
  let owner: string
  let manager: string
  let oncekiTur: string
  let oncekiAyar: string

  const patch = (token: string, body: object) =>
    request(app).patch(`/api/v1/tenants/${slug}/settings`).set('Authorization', `Bearer ${token}`).send(body)
  const durum = async () => {
    const t = await db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { settings: true, businessType: true } })
    return { tur: String(t.businessType), ayar: JSON.stringify(t.settings) }
  }

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    slug = tenant.slug
    owner = (await createTestOwner(tenantId, slug, suffix)).token
    manager = (await createTestManager(tenantId, slug, suffix)).token
    const d = await durum()
    oncekiTur = d.tur
    oncekiAyar = d.ayar
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  it('mudur activeModules gonderirse 403 ve hicbir sey yazilmaz', async () => {
    const res = await patch(manager, { activeModules: ['appointments'] })
    expect(res.status).toBe(403)
    expect(await durum()).toEqual({ tur: oncekiTur, ayar: oncekiAyar })
  })

  it('mudur bos activeModules dizisi (tum modulleri kapatma) gonderirse de 403, yazilmaz', async () => {
    const res = await patch(manager, { activeModules: [] })
    expect(res.status).toBe(403)
    expect(await durum()).toEqual({ tur: oncekiTur, ayar: oncekiAyar })
  })

  it('mudur businessType gonderirse 403 ve tur degismez (dentist baska bir deger olmali)', async () => {
    expect(oncekiTur).not.toBe('dentist')
    const res = await patch(manager, { businessType: 'dentist' })
    expect(res.status).toBe(403)
    expect(await durum()).toEqual({ tur: oncekiTur, ayar: oncekiAyar })
  })

  it('olumlu esleme: mudur sahip olmayan bir ayari (aboutText) degistirebilir, 200', async () => {
    const res = await patch(manager, { aboutText: 'Merhaba, salonumuza hos geldiniz' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect((await durum()).ayar).toContain('Merhaba')
  })

  it('sahip activeModules ve businessType degistirebilir (200), degerler yazilir', async () => {
    const mod = await patch(owner, { activeModules: ['appointments'] })
    expect(mod.status, JSON.stringify(mod.body)).toBe(200)
    expect(JSON.parse((await durum()).ayar).activeModules).toEqual(['appointments'])
    const tur = await patch(owner, { businessType: 'dentist' })
    expect(tur.status, JSON.stringify(tur.body)).toBe(200)
    expect((await durum()).tur).toBe('dentist')
  })
})
