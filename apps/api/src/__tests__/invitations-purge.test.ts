import { describe, it, expect, vi, beforeEach } from 'vitest'

// ADR-0042 saklama: suresi dolan ya da iptal edilen davetler 30 gun sonra silinir; kabul edilenler silinmez.
const dbMock = vi.hoisted(() => ({ invitation: { deleteMany: vi.fn() } }))
vi.mock('../lib/db', () => ({ db: dbMock }))

import { purgeStaleInvitations, INVITE_RETENTION_MS } from '../lib/invitations'

beforeEach(() => {
  vi.clearAllMocks()
  dbMock.invitation.deleteMany.mockResolvedValue({ count: 3 })
})

describe('purgeStaleInvitations', () => {
  it('yalniz kabul edilmemis davetleri, 30 gun gecmis iptal/sure dolumuyla siler ve sayiyi doner', async () => {
    const now = new Date('2026-10-29T20:30:00Z')
    expect(await purgeStaleInvitations(now)).toBe(3)
    const where = dbMock.invitation.deleteMany.mock.calls[0][0].where
    const cutoff = new Date(now.getTime() - INVITE_RETENTION_MS)
    expect(where.acceptedAt).toBeNull()
    expect(where.OR).toEqual([{ revokedAt: { lt: cutoff } }, { revokedAt: null, expiresAt: { lt: cutoff } }])
    expect(INVITE_RETENTION_MS).toBe(30 * 86_400_000)
  })
})

describe('invitations tablosu: davet eden silinince davet kalir (ADR-0042 denetim S2)', () => {
  it('invitedById bos olabilir ve yabanci anahtar SET NULL (kiraci/kullanici silmeyi kirmaz)', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const sql = readFileSync(join(__dirname, '../../prisma/migrations/20261029071000_invitations/migration.sql'), 'utf8')
    expect(sql).toMatch(/"invitedById" UUID,/)
    expect(sql).toMatch(/invitations_invitedById_fkey[^;]*ON DELETE SET NULL/)
    const schema = readFileSync(join(__dirname, '../../prisma/schema.prisma'), 'utf8')
    expect(schema).toMatch(/invitedById\s+String\?/)
    expect(schema).toMatch(/onDelete: SetNull/)
  })
})
