import { createHash, randomBytes } from 'node:crypto'
import { db } from './db'

// A3 / ADR-0042: personel daveti. Token 32 bayt rastgele (base64url); veritabanına yalnız SHA-256 özeti yazılır.
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const INVITES_PER_DAY = 20
// Süresi dolan ya da iptal edilen davetler bu süre sonra silinir (ADR-0042 saklama).
export const INVITE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashInviteToken(token) }
}

export function inviteLink(token: string): string {
  const base = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/+$/, '')
  return `${base}/invite#${token}`
}

/** Gece işi: süresi dolmuş ya da iptal edilmiş davetlerin 30 gün sonra silinmesi. Kabul edilmiş davetler kalır (kayıt izi). */
export async function purgeStaleInvitations(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - INVITE_RETENTION_MS)
  const result = await db.invitation.deleteMany({
    where: {
      acceptedAt: null,
      OR: [{ revokedAt: { lt: cutoff } }, { revokedAt: null, expiresAt: { lt: cutoff } }],
    },
  })
  return result.count
}
