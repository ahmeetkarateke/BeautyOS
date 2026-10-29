import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import { uniqueSuffix, createTestTenant, createTestOwner, cleanupTenant } from './helpers/setup'

// W24-1 (para verisi, gercek PG): eksi acilis bakiyesi gider yonunde yazilir (bakiye -5000), pasif hesaba virman 400, virman
// iki hesabin bakiyesini dogru yonde degistirir. Bu dosya tests/entegrasyon altindadir; api-test.sh kosudan once
// apps/api/src/__tests__/ icine kopyalar.
const app = createApp({ rateLimitMax: 1000 })

describe('W24-1: hesap bakiyesi yonu ve virman (gercek PG)', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let slug: string
  let owner: string

  const call = (method: 'get' | 'post' | 'patch', path: string) =>
    request(app)[method](`/api/v1/tenants/${slug}${path}`).set('Authorization', `Bearer ${owner}`)
  const hesap = (type: string, name: string, openingBalance: number) =>
    call('post', '/accounts').send({ type, name, currency: 'TRY', openingBalance })
  const bakiye = async (id: string): Promise<number> => {
    const list = await call('get', '/accounts')
    expect(list.status, JSON.stringify(list.body)).toBe(200)
    const a = (list.body.data as Array<{ id: string; balance: number }>).find((x) => x.id === id)
    expect(a, 'hesap listede olmali').toBeDefined()
    return a!.balance
  }

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    slug = tenant.slug
    owner = (await createTestOwner(tenantId, slug, suffix)).token
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  it('eksi acilis bakiyesi (-5000) bakiye olarak -5000 doner, artı (5000) +5000', async () => {
    const eksi = await hesap('bank', 'Kredi Karti', -5000)
    expect(eksi.status, JSON.stringify(eksi.body)).toBe(201)
    expect(await bakiye(eksi.body.id)).toBe(-5000)
    const arti = await hesap('cash', 'Kasa Arti', 5000)
    expect(arti.status).toBe(201)
    expect(await bakiye(arti.body.id)).toBe(5000)
  })

  it('virman: kaynak hesap azalir, hedef hesap artar (dogru yon)', async () => {
    const kaynak = await hesap('cash', 'Kasa Kaynak', 1000)
    const hedef = await hesap('bank', 'Banka Hedef', 200)
    expect(await bakiye(kaynak.body.id)).toBe(1000)
    const v = await call('post', '/transactions/transfer').send({ fromAccountId: kaynak.body.id, toAccountId: hedef.body.id, amount: 300 })
    expect(v.status, JSON.stringify(v.body)).toBe(201)
    expect(await bakiye(kaynak.body.id)).toBe(700)
    expect(await bakiye(hedef.body.id)).toBe(500)
  })

  it('pasif hedef hesaba virman 400 INVALID_ACCOUNT ve bakiyeler degismez (aktif kaynak ile)', async () => {
    const kaynak = await hesap('cash', 'Kasa Kaynak 2', 800)
    const hedef = await hesap('bank', 'Banka Pasif', 0)
    await db.financialAccount.update({ where: { id: hedef.body.id }, data: { isActive: false } })
    const v = await call('post', '/transactions/transfer').send({ fromAccountId: kaynak.body.id, toAccountId: hedef.body.id, amount: 100 })
    expect(v.status).toBe(400)
    expect(v.body.error.code).toBe('INVALID_ACCOUNT')
    expect(await bakiye(kaynak.body.id)).toBe(800)
  })

  it('pasif kaynak hesaptan virman 400 INVALID_ACCOUNT (hedef aktif)', async () => {
    const kaynak = await hesap('cash', 'Kasa Pasif', 800)
    const hedef = await hesap('bank', 'Banka Aktif', 0)
    await db.financialAccount.update({ where: { id: kaynak.body.id }, data: { isActive: false } })
    const v = await call('post', '/transactions/transfer').send({ fromAccountId: kaynak.body.id, toAccountId: hedef.body.id, amount: 100 })
    expect(v.status).toBe(400)
    expect(v.body.error.code).toBe('INVALID_ACCOUNT')
    expect(await bakiye(hedef.body.id)).toBe(0)
  })
})
