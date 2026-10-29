import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { db } from './db'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Yeniden kullanım toleransı: kullanılmış token bu süre içinde gelirse çalınma sayılmaz (S6-1 Önemli 1). */
export const REUSE_GRACE_MS = 30 * 1000

export type RotateResult =
  | { ok: true; userId: string; familyId: string; refreshToken: string }
  | { ok: false; reason: 'invalid' | 'reused' }

/** Ham yenileme token'ı asla saklanmaz; veritabanı sızsa bile oturum devralınamaz. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function newRefreshToken(): string {
  return randomBytes(48).toString('base64url')
}

/** Yeni giriş = yeni aile. Dönen ham token yalnız çereze yazılır. */
export async function createSession(userId: string, tenantId: string | null): Promise<{ refreshToken: string; familyId: string }> {
  const refreshToken = newRefreshToken()
  const familyId = randomUUID()
  await db.session.create({
    data: { userId, tenantId, familyId, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  })
  return { refreshToken, familyId }
}

export async function revokeFamily(familyId: string): Promise<void> {
  await db.session.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } })
}

/**
 * Token'ı döndürür: eski satır usedAt ile kapanır, aynı ailede yeni token açılır (K1).
 * Kullanılmış / iptal edilmiş token tekrar gelirse çalınma varsayılır ve aile iptal edilir.
 * Kapanış koşullu güncellemedir (usedAt IS NULL): eş zamanlı iki istekten yalnız biri kazanır.
 */
export async function rotateSession(refreshToken: string): Promise<RotateResult> {
  const row = await db.session.findUnique({ where: { tokenHash: hashToken(refreshToken) } })
  if (!row) return { ok: false, reason: 'invalid' }

  if (row.revokedAt) return { ok: false, reason: 'invalid' }
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'invalid' }
  if (row.usedAt) return reuseOrRevoke(row)

  const next = newRefreshToken()
  const claimed = await db.$transaction(async (tx) => {
    const closed = await tx.session.updateMany({
      where: { id: row.id, usedAt: null, revokedAt: null },
      data: { usedAt: new Date() },
    })
    if (closed.count !== 1) return false
    await tx.session.create({
      data: {
        userId: row.userId,
        tenantId: row.tenantId,
        familyId: row.familyId,
        tokenHash: hashToken(next),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })
    return true
  })
  if (!claimed) {
    // Eş zamanlı yarışı kaybeden: kazanan usedAt'i yazdı; aynı tolerans kuralı uygulanır.
    const fresh = await db.session.findUnique({ where: { tokenHash: row.tokenHash } })
    return fresh?.usedAt ? reuseOrRevoke(fresh) : { ok: false, reason: 'invalid' }
  }
  return { ok: true, userId: row.userId, familyId: row.familyId, refreshToken: next }
}

type SessionRow = NonNullable<Awaited<ReturnType<typeof db.session.findUnique>>>

/**
 * Kullanılmış token yeniden geldi. Tolerans içinde (yanıtı kaybolan yenileme, iki sekmenin yarışı) aynı ailede yeni token verilir;
 * eski satıra dokunulmaz, kendi kullanım zamanı tolerans penceresini belirler. Dışında çalınma varsayılır: aile iptal edilir.
 */
async function reuseOrRevoke(row: SessionRow): Promise<RotateResult> {
  if (row.revokedAt) return { ok: false, reason: 'invalid' }
  if (row.usedAt && Date.now() - row.usedAt.getTime() <= REUSE_GRACE_MS) {
    const next = newRefreshToken()
    await db.session.create({
      data: { userId: row.userId, tenantId: row.tenantId, familyId: row.familyId, tokenHash: hashToken(next), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    })
    return { ok: true, userId: row.userId, familyId: row.familyId, refreshToken: next }
  }
  await revokeFamily(row.familyId)
  return { ok: false, reason: 'reused' }
}

/** Çıkış: çerezdeki token'ın ailesini kapatır; bilinmeyen token sessizce geçilir. */
export async function revokeByToken(refreshToken: string): Promise<void> {
  const row = await db.session.findUnique({ where: { tokenHash: hashToken(refreshToken) } })
  if (row) await revokeFamily(row.familyId)
}

/** Şifre değişimi / sıfırlama / pasifleştirme: kullanıcının tüm oturumları kapanır (K2). */
export async function revokeUserSessions(userId: string): Promise<void> {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
}

/** Erişim token'ındaki `sid` hâlâ canlı bir aileye mi ait? (iptal edilmemiş ve süresi dolmamış satır var mı) */
export async function isSessionLive(familyId: string): Promise<boolean> {
  const row = await db.session.findFirst({
    where: { familyId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  })
  return row !== null
}

/** Gece temizliği: süresi dolmuş satırlar silinir (iptal edilmiş ama süresi dolmamış satırlar yeniden kullanım tespiti için kalır). */
export async function purgeExpiredSessions(now: Date = new Date()): Promise<number> {
  const result = await db.session.deleteMany({ where: { expiresAt: { lt: now } } })
  return result.count
}
