import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { db } from '../lib/db'
import { uniqueSuffix, createTestTenant, cleanupTenant } from './helpers/setup'

// Gerçek PostgreSQL ister (api-test.sh yığını; tests/entegrasyon -> apps/api/src/__tests__ kopyalanır).
// S7 e-posta küçük harf migration'ını farklı kiracılarda karışık harfli satırlarla dener; her vaka geri alınan işlemde koşar.
const sql = readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261029020000_user_email_lowercase/migration.sql'), 'utf8')
const checkBlock = /DO \$\$[\s\S]*?END \$\$;/.exec(sql)![0]
const updateStatement = /^UPDATE [^;]*;/m.exec(sql)![0]

class Rollback extends Error {}
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

describe('S7 migration: farklı kiracılarda karışık harfli e-postalar (gerçek PG)', () => {
  const suffix = uniqueSuffix()
  let tenantA: { id: string }
  let tenantB: { id: string }

  beforeAll(async () => {
    tenantA = await createTestTenant(suffix)
    tenantB = await createTestTenant(`${suffix}b`)
  })
  afterAll(async () => {
    await cleanupTenant(tenantA.id)
    await cleanupTenant(tenantB.id)
  })

  const insertUser = (tx: Tx, tenantId: string, email: string) =>
    tx.$executeRawUnsafe(
      `INSERT INTO "users" ("id","tenantId","email","passwordHash","role","fullName","updatedAt")
       VALUES (gen_random_uuid(), $1::uuid, $2, 'x', 'staff'::"UserRole", 'Test', now())`,
      tenantId,
      email,
    )
  const emails = (tx: Tx, like: string) =>
    tx.$queryRawUnsafe<{ email: string }[]>(`SELECT email FROM "users" WHERE lower(email) LIKE $1 ORDER BY email`, like)
  const inRolledBackTx = async (fn: (tx: Tx) => Promise<void>) => {
    await db
      .$transaction(async (tx) => {
        await fn(tx)
        throw new Rollback()
      })
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e
      })
  }

  it('farklı kiracılarda çakışmayan karışık harfli adresler (büyük I dahil) küçüğe çevrilir, diğer satırlar aynı kalır', async () => {
    const a = `ISIK.${suffix}@Ornek.TEST`
    const b = `Ali.${suffix}@ornek.test`
    const already = `kucuk.${suffix}@ornek.test`
    await inRolledBackTx(async (tx) => {
      await insertUser(tx, tenantA.id, a)
      await insertUser(tx, tenantB.id, b)
      await insertUser(tx, tenantB.id, already)
      await tx.$executeRawUnsafe(checkBlock)
      await tx.$executeRawUnsafe(updateStatement)
      const rows = (await emails(tx, `%${suffix}@ornek.test`)).map((r) => r.email)
      expect([...rows].sort()).toEqual([b.toLowerCase(), a.toLowerCase(), already].sort())
      expect(rows.every((e) => e === e.toLowerCase())).toBe(true)
    })
  })

  it('A kiracısında Mixed, B kiracısında küçük harfli aynı adres: migration durur, iki satır da değişmeden kalır', async () => {
    const mixed = `Cakisma.${suffix}@Ornek.Test`
    const lower = mixed.toLowerCase()
    await inRolledBackTx(async (tx) => {
      await insertUser(tx, tenantA.id, mixed)
      await insertUser(tx, tenantB.id, lower)
      await expect(tx.$executeRawUnsafe(checkBlock)).rejects.toThrow(/cakisiyor/)
    })
    expect(await db.user.count({ where: { email: { in: [mixed, lower] } } })).toBe(0)
  })

  it('aynı kiracıda harf farkıyla çakışma da durdurur (nedenin kiracıdan bağımsız olduğunu doğrular)', async () => {
    const mixed = `Ayni.${suffix}@Ornek.Test`
    await inRolledBackTx(async (tx) => {
      await insertUser(tx, tenantA.id, mixed)
      await insertUser(tx, tenantA.id, mixed.toLowerCase())
      await expect(tx.$executeRawUnsafe(checkBlock)).rejects.toThrow(/cakisiyor/)
    })
  })
})
