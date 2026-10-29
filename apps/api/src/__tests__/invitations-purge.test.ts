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
