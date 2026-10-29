import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { db } from '../lib/db'
import { uniqueSuffix, createTestTenant, cleanupTenant } from './helpers/setup'

// Gercek PostgreSQL ister. S7 migration'i: kiracilar arasi harf farkli tekrarda durur, veriye dokunmaz.
const sql = readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261029020000_user_email_lowercase/migration.sql'), 'utf8')
const [checkBlock, updateStatement] = [/DO \$\$[\s\S]*?END \$\$;/.exec(sql)![0], /^UPDATE [^;]*;/m.exec(sql)![0]]

class Rollback extends Error {}

describe('S7: e-posta kucuk harf migration (gercek PG)', () => {
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

  const insertUser = (tx: Pick<typeof db, '$executeRawUnsafe'>, tenantId: string, email: string) =>
    tx.$executeRawUnsafe(
      `INSERT INTO "users" ("id","tenantId","email","passwordHash","role","fullName","updatedAt")
       VALUES (gen_random_uuid(), $1::uuid, $2, 'x', 'staff'::"UserRole", 'Test', now())`,
      tenantId,
      email,
    )

  // Her vaka bir islemde calisir ve geri alinir: gercek veriye kalici iz birakmaz.
  const inRolledBackTx = async (fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<void>) => {
    await db.$transaction(async (tx) => {
      await fn(tx)
      throw new Rollback()
    }).catch((e) => {
      if (!(e instanceof Rollback)) throw e
    })
  }

  it('K2: farkli kiracilarda yalniz harf farkiyla ayni e-posta varsa migration durur ve veri degismez', async () => {
    const mixed = `Clash.${suffix}@Test.LOCAL`
    const lower = mixed.toLowerCase()
    await inRolledBackTx(async (tx) => {
      await insertUser(tx, tenantA.id, mixed)
      await insertUser(tx, tenantB.id, lower)
      await expect(tx.$executeRawUnsafe(checkBlock)).rejects.toThrow(/cakisiyor/)
    })
    expect(await db.user.count({ where: { email: { in: [mixed, lower] } } })).toBe(0)
  })

  it('K2: cakisma yoksa karisik harfli kayit kucuk harfe cevrilir', async () => {
    const mixed = `Tek.${suffix}@Test.LOCAL`
    await inRolledBackTx(async (tx) => {
      await insertUser(tx, tenantA.id, mixed)
      await tx.$executeRawUnsafe(checkBlock)
      await tx.$executeRawUnsafe(updateStatement)
      const rows = await tx.$queryRawUnsafe<{ email: string }[]>(`SELECT email FROM "users" WHERE lower(email) = $1`, mixed.toLowerCase())
      expect(rows.map((r) => r.email)).toEqual([mixed.toLowerCase()])
    })
  })
})
