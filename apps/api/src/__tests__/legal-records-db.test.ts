import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '../lib/db'
import { uniqueSuffix, createTestTenant, createTestOwner, cleanupTenant } from './helpers/setup'

// ADR-0048 (guncelleme): kabul ve izin kayitlari kiraci/kullanici silinince SET NULL ile kanit olarak kalir; anlik goruntu sutunlari okunur.
// Yalniz-ekleme tetikleyicisi SET NULL'un kendi guncellemesine izin verir, baska her guncellemeyi reddeler. Gercek PG ister.
describe('legal_acceptances / marketing_consents: silmeden sonra kanit kalir (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let slug: string
  let userId: string
  let userEmail: string
  let acceptanceId: string
  let consentId: string
  let alive: { acceptanceId: string; tenantId: string }

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    slug = tenant.slug
    const owner = await createTestOwner(tenant.id, tenant.slug, suffix)
    userId = owner.user.id
    userEmail = (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } })).email
    const snap = { tenantSlug: slug, tenantName: 'Silinecek Salon', userEmail }
    acceptanceId = (await db.legalAcceptance.create({
      data: { tenantId, userId, documentType: 'terms', documentVersion: 'v1', channel: 'signup', labelVersion: 'v1', ...snap },
    })).id
    consentId = (await db.marketingConsent.create({
      data: { tenantId, userId, channel: 'email', status: 'granted', source: 'signup_form', consentTextVersion: 'v1', ...snap },
    })).id
    // Silinmeyecek ikinci bir kiracinin satiri: tetikleyici testleri bunun uzerinde yapilir.
    const keep = await createTestTenant(`${suffix}k`)
    const keepOwner = await createTestOwner(keep.id, keep.slug, `${suffix}k`)
    alive = {
      tenantId: keep.id,
      acceptanceId: (await db.legalAcceptance.create({
        data: { tenantId: keep.id, userId: keepOwner.user.id, documentType: 'dpa', documentVersion: 'v1', channel: 'signup', labelVersion: 'v1', tenantSlug: keep.slug, tenantName: 'Kalan', userEmail: 'kalan@test.local' },
      })).id,
    }
  })

  afterAll(async () => {
    await db.legalAcceptance.deleteMany({ where: { id: { in: [acceptanceId, alive.acceptanceId] } } })
    await db.marketingConsent.deleteMany({ where: { id: consentId } })
    await cleanupTenant(alive.tenantId)
  })

  it('tetikleyici: icerik guncellenemez (documentVersion), baska kiraciya tasinamaz, NULL sonrasi geri baglanamaz', async () => {
    await expect(db.$executeRaw`UPDATE legal_acceptances SET "documentVersion" = 'v2' WHERE id = ${alive.acceptanceId}::uuid`).rejects.toThrow(/yalniz eklenir/)
    await expect(db.$executeRaw`UPDATE legal_acceptances SET "tenantId" = ${tenantId}::uuid WHERE id = ${alive.acceptanceId}::uuid`).rejects.toThrow(/yalniz eklenir/)
    await expect(db.$executeRaw`UPDATE legal_acceptances SET "tenantSlug" = 'x' WHERE id = ${alive.acceptanceId}::uuid`).rejects.toThrow(/yalniz eklenir/)
    expect((await db.legalAcceptance.findUniqueOrThrow({ where: { id: alive.acceptanceId } })).documentVersion).toBe('v1')
  })

  it('kiraci silinince kabul ve izin satiri silinmez: tenantId/userId NULL, anlik goruntu yerinde', async () => {
    // Veri gercekten var (silmeden once okunur).
    expect(await db.legalAcceptance.count({ where: { id: acceptanceId, tenantId } })).toBe(1)
    expect(await db.marketingConsent.count({ where: { id: consentId, tenantId } })).toBe(1)
    await cleanupTenant(tenantId)
    expect(await db.tenant.count({ where: { id: tenantId } })).toBe(0)
    const a = await db.legalAcceptance.findUniqueOrThrow({ where: { id: acceptanceId } })
    expect(a).toMatchObject({ tenantId: null, userId: null, tenantSlug: slug, tenantName: 'Silinecek Salon', userEmail, documentType: 'terms' })
    const c = await db.marketingConsent.findUniqueOrThrow({ where: { id: consentId } })
    expect(c).toMatchObject({ tenantId: null, userId: null, tenantSlug: slug, userEmail, status: 'granted' })
  })

  it('baska kiracinin satiri silmeden etkilenmez', async () => {
    expect((await db.legalAcceptance.findUniqueOrThrow({ where: { id: alive.acceptanceId } })).tenantId).toBe(alive.tenantId)
  })
})
