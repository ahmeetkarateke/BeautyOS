import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { createFakeSessionDb } from './helpers/fake-session-db'

// S6 K1/K2: oturum kutuphanesi. db sahte bellek tablosu; DB/Redis gerekmez.
const fake = vi.hoisted(() => ({ current: null as unknown }))
const lock = vi.hoisted(() => ({ chain: Promise.resolve() as Promise<void> }))
vi.mock('../lib/db', () => ({
  db: {
    get session() {
      return (fake.current as ReturnType<typeof createFakeSessionDb>).session
    },
    // Gercek PG'de ayni satiri guncelleyen islemler satir kilidiyle sirali calisir; sahte de islemleri siraya dizer.
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => {
      const run = lock.chain.then(() => fn({ session: (fake.current as ReturnType<typeof createFakeSessionDb>).session }))
      lock.chain = run.then(() => undefined, () => undefined)
      return run
    },
  },
}))

import {
  createSession,
  rotateSession,
  revokeByToken,
  revokeUserSessions,
  isSessionLive,
  hashToken,
  purgeExpiredSessions,
  REUSE_GRACE_MS,
} from '../lib/sessions'

let store: ReturnType<typeof createFakeSessionDb>
beforeEach(() => {
  store = createFakeSessionDb()
  fake.current = store
})

describe('K1: yenileme token ozeti ve dondurme', () => {
  it('K1: ham token saklanmaz; tokenHash sha256 ozetidir ve token opak (JWT degil)', async () => {
    const { refreshToken } = await createSession('u1', 't1')
    expect(refreshToken.split('.').length).toBe(1)
    expect(refreshToken.length).toBeGreaterThanOrEqual(40)
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0].tokenHash).toBe(createHash('sha256').update(refreshToken).digest('hex'))
    expect(hashToken(refreshToken)).toBe(store.rows[0].tokenHash)
    expect(JSON.stringify(store.rows)).not.toContain(refreshToken)
  })

  it('K1: her kullanimda token doner: yeni token farkli, ayni aile, eski satir usedAt ile kapanir', async () => {
    const first = await createSession('u1', 't1')
    const r = await rotateSession(first.refreshToken)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.refreshToken).not.toBe(first.refreshToken)
    expect(r.familyId).toBe(first.familyId)
    expect(r.userId).toBe('u1')
    expect(store.rows).toHaveLength(2)
    expect(store.rows.filter((x) => x.usedAt !== null)).toHaveLength(1)
    expect(store.rows.every((x) => x.familyId === first.familyId && x.revokedAt === null)).toBe(true)
  })

  it('K1: tolerans suresi DISINDA kullanilmis token yeniden gelirse reused doner ve TUM aile (yeni token dahil) iptal edilir', async () => {
    const first = await createSession('u1', 't1')
    const second = await rotateSession(first.refreshToken)
    if (!second.ok) throw new Error('beklenmeyen')
    store.rows[0].usedAt = new Date(Date.now() - REUSE_GRACE_MS - 1000)
    expect(await rotateSession(first.refreshToken)).toEqual({ ok: false, reason: 'reused' })
    expect(store.rows.every((x) => x.revokedAt !== null)).toBe(true)
    expect(await rotateSession(second.refreshToken)).toEqual({ ok: false, reason: 'invalid' })
    expect(await isSessionLive(first.familyId)).toBe(false)
  })

  it('S6-1 Onemli 1: tolerans icinde (yaniti kaybolan yenileme) ayni token yeniden gelirse oturum dusmez, yeni token ayni ailede verilir', async () => {
    const first = await createSession('u1', 't1')
    const second = await rotateSession(first.refreshToken)
    const retry = await rotateSession(first.refreshToken)
    if (!second.ok || !retry.ok) throw new Error('tolerans icinde basarili olmaliydi')
    expect(retry.familyId).toBe(first.familyId)
    expect(retry.refreshToken).not.toBe(second.refreshToken)
    expect(store.rows.every((x) => x.revokedAt === null)).toBe(true)
    expect(await isSessionLive(first.familyId)).toBe(true)
    expect((await rotateSession(retry.refreshToken)).ok).toBe(true)
  })

  it('S6-1 Onemli 1: iptal edilmis (cikis) ailenin token\'i tolerans icinde bile reddedilir', async () => {
    const first = await createSession('u1', 't1')
    await rotateSession(first.refreshToken)
    await revokeByToken(first.refreshToken)
    expect(await rotateSession(first.refreshToken)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('K1/S6-1: ayni token ayni anda iki kez gelirse (iki sekme) ikisi de tolerans icinde basarili olur, aile canli kalir', async () => {
    const first = await createSession('u1', 't1')
    const [a, b] = await Promise.all([rotateSession(first.refreshToken), rotateSession(first.refreshToken)])
    expect(a.ok && b.ok).toBe(true)
    expect(await isSessionLive(first.familyId)).toBe(true)
  })

  it('K1: bilinmeyen token invalid; baska ailelere dokunmaz', async () => {
    const other = await createSession('u2', 't1')
    expect(await rotateSession('x'.repeat(48))).toEqual({ ok: false, reason: 'invalid' })
    expect(await isSessionLive(other.familyId)).toBe(true)
  })

  it('K1: suresi dolmus token invalid (aile iptal edilmez, yalniz reddedilir)', async () => {
    const s = await createSession('u1', 't1')
    store.rows[0].expiresAt = new Date(Date.now() - 1000)
    expect(await rotateSession(s.refreshToken)).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('K2: iptal', () => {
  it('K2: revokeByToken tokenin ailesini kapatir', async () => {
    const s = await createSession('u1', 't1')
    const r = await rotateSession(s.refreshToken)
    if (!r.ok) throw new Error('beklenmeyen')
    await revokeByToken(r.refreshToken)
    expect(await isSessionLive(s.familyId)).toBe(false)
    expect(await rotateSession(r.refreshToken)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('K2: revokeByToken bilinmeyen tokenda hata vermez', async () => {
    await expect(revokeByToken('yok')).resolves.toBeUndefined()
  })

  it('K2: revokeUserSessions kullanicinin tum ailelerini kapatir, baska kullaniciya dokunmaz', async () => {
    const a1 = await createSession('u1', 't1')
    const a2 = await createSession('u1', 't1')
    const b = await createSession('u2', 't1')
    await revokeUserSessions('u1')
    expect(await isSessionLive(a1.familyId)).toBe(false)
    expect(await isSessionLive(a2.familyId)).toBe(false)
    expect(await isSessionLive(b.familyId)).toBe(true)
  })

  it('K3: isSessionLive suresi dolmus aileyi canli saymaz', async () => {
    const s = await createSession('u1', 't1')
    store.rows[0].expiresAt = new Date(Date.now() - 1)
    expect(await isSessionLive(s.familyId)).toBe(false)
  })

  it('purgeExpiredSessions suresi dolmus ve iptal edilmis satirlari siler, canliyi tutar', async () => {
    const live = await createSession('u1', 't1')
    const old = await createSession('u2', 't1')
    store.rows.find((r) => r.familyId === old.familyId)!.expiresAt = new Date(Date.now() - 60_000)
    expect(await purgeExpiredSessions()).toBe(1)
    expect(await isSessionLive(live.familyId)).toBe(true)
  })
})
