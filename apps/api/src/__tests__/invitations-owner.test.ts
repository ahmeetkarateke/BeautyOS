import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createHash } from 'node:crypto'

// A3 / ADR-0042: sahip uclari (davet olustur, listele, yeniden gonder, iptal). DB, e-posta ve kimlik katmani sahte; DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  invitation: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  user: { findFirst: vi.fn() },
  tenant: { findUnique: vi.fn() },
}))
const emailMock = vi.hoisted(() => ({ sendInvitationEmail: vi.fn(), isEmailConfigured: vi.fn() }))

vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/email', () => emailMock)
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() } }))
vi.mock('../middleware/auth.middleware', () => ({
  authenticateJWT: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'u1', tenantId: 't1', tenantSlug: 'salon', role: String(req.headers['x-role']) } as never
    next()
  },
  requireTenantAccess: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = 't1'
    next()
  },
  checkTenantActive: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

import { createInvitationsRouter } from '../routes/invitations.route'

const app = express().use(express.json()).use('/api/v1/tenants/:slug', createInvitationsRouter())
const BASE = '/api/v1/tenants/salon/invitations'
const ID = '00000000-0000-4000-8000-000000000001'
const as = (role: string) => ({ 'x-role': role })
const valid = { email: 'ayse@example.com', fullName: 'Ayse Yilmaz', role: 'staff', title: 'Kuafor' }
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

function tokenFromLink(link: string): string {
  return link.split('/invite#')[1]
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.FRONTEND_URL = 'https://app.example.com'
  dbMock.user.findFirst.mockResolvedValue(null)
  dbMock.invitation.findFirst.mockResolvedValue(null)
  dbMock.invitation.count.mockResolvedValue(0)
  dbMock.invitation.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: ID, ...data }))
  dbMock.invitation.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: ID, ...data }))
  emailMock.isEmailConfigured.mockReturnValue(true)
  emailMock.sendInvitationEmail.mockResolvedValue(true)
})

describe('POST /invitations', () => {
  it('owner davet olusturur: 201, link token tasir, veritabanina yalniz sha-256 ozeti yazilir', async () => {
    const res = await request(app).post(BASE).set(as('owner')).send(valid)
    expect(res.status).toBe(201)
    expect(Object.keys(res.body).sort()).toEqual(['emailSent', 'expiresAt', 'id', 'link'])
    expect(res.body.link.startsWith('https://app.example.com/invite#')).toBe(true)
    const token = tokenFromLink(res.body.link)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const data = dbMock.invitation.create.mock.calls[0][0].data
    expect(data.tokenHash).toBe(sha256(token))
    expect(JSON.stringify(dbMock.invitation.create.mock.calls[0][0])).not.toContain(token)
    expect(data).toMatchObject({ tenantId: 't1', invitedById: 'u1', role: 'staff', title: 'Kuafor', fullName: 'Ayse Yilmaz' })
  })

  it('son kullanma 7 gun', async () => {
    const before = Date.now()
    const res = await request(app).post(BASE).set(as('owner')).send(valid)
    const ms = new Date(res.body.expiresAt).getTime() - before
    expect(ms).toBeGreaterThan(7 * 86_400_000 - 5_000)
    expect(ms).toBeLessThan(7 * 86_400_000 + 5_000)
  })

  it('e-posta kucuk harfe cevrilir; Turk I vakasi: IREM@X.COM -> irem@x.com (ı olmaz)', async () => {
    await request(app).post(BASE).set(as('owner')).send({ ...valid, email: 'IREM@EXAMPLE.COM' })
    expect(dbMock.invitation.create.mock.calls[0][0].data.email).toBe('irem@example.com')
  })

  it.each(['owner', 'superadmin'])('rol %s davet edilemez: 400 (baska her alan gecerli)', async (role) => {
    const res = await request(app).post(BASE).set(as('owner')).send({ ...valid, role })
    expect(res.status).toBe(400)
    expect(dbMock.invitation.create).not.toHaveBeenCalled()
  })

  it.each(['manager', 'receptionist', 'staff'])('%s davet acamaz: 403', async (role) => {
    const res = await request(app).post(BASE).set(as(role)).send(valid)
    expect(res.status).toBe(403)
    expect(dbMock.invitation.create).not.toHaveBeenCalled()
  })

  it('kiracida ayni e-postayla kullanici varsa 409 DUPLICATE_EMAIL', async () => {
    dbMock.user.findFirst.mockResolvedValue({ id: 'x' })
    const res = await request(app).post(BASE).set(as('owner')).send(valid)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL')
    expect(dbMock.user.findFirst.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', email: 'ayse@example.com' })
  })

  it('bekleyen ayni e-posta daveti varsa 409 DUPLICATE_EMAIL', async () => {
    dbMock.invitation.findFirst.mockResolvedValue({ id: 'bekleyen' })
    const res = await request(app).post(BASE).set(as('owner')).send(valid)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE_EMAIL')
    expect(dbMock.invitation.findFirst.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', acceptedAt: null, revokedAt: null })
  })

  it('gunluk tavan: kiracida son 24 saatte 20 davet varsa 429 INVITE_LIMIT; 19 ise gecer', async () => {
    dbMock.invitation.count.mockResolvedValue(20)
    const limited = await request(app).post(BASE).set(as('owner')).send(valid)
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('INVITE_LIMIT')
    expect(dbMock.invitation.count.mock.calls[0][0].where.tenantId).toBe('t1')
    dbMock.invitation.count.mockResolvedValue(19)
    const ok = await request(app).post(BASE).set(as('owner')).send(valid)
    expect(ok.status).toBe(201)
  })

  it('e-posta yapilandirilmis ve gonderildiyse emailSent true; adrese davet gider', async () => {
    const res = await request(app).post(BASE).set(as('owner')).send(valid)
    expect(res.body.emailSent).toBe(true)
    expect(emailMock.sendInvitationEmail.mock.calls[0][0]).toMatchObject({ to: 'ayse@example.com' })
  })

  it('e-posta yapilandirilmamissa emailSent false, gonderim denenmez, davet yine olusur', async () => {
    emailMock.isEmailConfigured.mockReturnValue(false)
    const res = await request(app).post(BASE).set(as('owner')).send(valid)
    expect(res.status).toBe(201)
    expect(res.body.emailSent).toBe(false)
    expect(emailMock.sendInvitationEmail).not.toHaveBeenCalled()
  })

  it('e-posta gonderimi basarisizsa emailSent false (davet korunur)', async () => {
    emailMock.sendInvitationEmail.mockResolvedValue(false)
    const res = await request(app).post(BASE).set(as('owner')).send(valid)
    expect(res.status).toBe(201)
    expect(res.body.emailSent).toBe(false)
  })
})

describe('GET /invitations', () => {
  it('bekleyenleri token ve ozet olmadan listeler; sorgu kiraciya baglidir', async () => {
    dbMock.invitation.findMany.mockResolvedValue([
      { id: ID, email: 'a@x.com', fullName: 'A', role: 'staff', title: null, expiresAt: new Date(Date.now() + 1000), createdAt: new Date() },
    ])
    const res = await request(app).get(BASE).set(as('owner'))
    expect(res.status).toBe(200)
    expect(JSON.stringify(res.body)).not.toContain('tokenHash')
    expect(dbMock.invitation.findMany.mock.calls[0][0].select).not.toHaveProperty('tokenHash')
    expect(dbMock.invitation.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: 't1', acceptedAt: null, revokedAt: null })
  })

  it('manager listeleyemez: 403', async () => {
    expect((await request(app).get(BASE).set(as('manager'))).status).toBe(403)
  })
})

describe('POST /invitations/:id/resend', () => {
  it('bekleyen davet yeni token ve yeni hash alir; eski hash gecersiz olur', async () => {
    dbMock.invitation.findFirst.mockResolvedValue({ id: ID, tokenHash: 'eski', email: 'a@x.com', fullName: 'A', role: 'staff' })
    const res = await request(app).post(`${BASE}/${ID}/resend`).set(as('owner'))
    expect(res.status).toBe(200)
    const token = tokenFromLink(res.body.link)
    const data = dbMock.invitation.update.mock.calls[0][0].data
    expect(data.tokenHash).toBe(sha256(token))
    expect(data.tokenHash).not.toBe('eski')
    expect(dbMock.invitation.findFirst.mock.calls[0][0].where).toMatchObject({ id: ID, tenantId: 't1', acceptedAt: null, revokedAt: null })
  })

  it('bulunamayan (ya da baska kiracinin) davet 404', async () => {
    const res = await request(app).post(`${BASE}/${ID}/resend`).set(as('owner'))
    expect(res.status).toBe(404)
    expect(dbMock.invitation.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /invitations/:id', () => {
  it('bekleyen daveti iptal eder (revokedAt yazilir), sorgu kiraciya baglidir', async () => {
    dbMock.invitation.updateMany.mockResolvedValue({ count: 1 })
    const res = await request(app).delete(`${BASE}/${ID}`).set(as('owner'))
    expect(res.status).toBe(200)
    const call = dbMock.invitation.updateMany.mock.calls[0][0]
    expect(call.where).toMatchObject({ id: ID, tenantId: 't1', acceptedAt: null, revokedAt: null })
    expect(call.data.revokedAt).toBeInstanceOf(Date)
  })

  it('baska kiracinin ya da olmayan davet 404 (count 0)', async () => {
    dbMock.invitation.updateMany.mockResolvedValue({ count: 0 })
    expect((await request(app).delete(`${BASE}/${ID}`).set(as('owner'))).status).toBe(404)
  })

  it('manager iptal edemez: 403', async () => {
    expect((await request(app).delete(`${BASE}/${ID}`).set(as('manager'))).status).toBe(403)
    expect(dbMock.invitation.updateMany).not.toHaveBeenCalled()
  })
})

describe('yeniden gonderme gunluk tavana tabidir', () => {
  it('kiracida son 24 saatte 20 davet varsa resend 429 INVITE_LIMIT, token degismez', async () => {
    dbMock.invitation.findFirst.mockResolvedValue({ id: ID, tokenHash: 'eski', email: 'a@x.com', fullName: 'A', role: 'staff' })
    dbMock.invitation.count.mockResolvedValue(20)
    const res = await request(app).post(`${BASE}/${ID}/resend`).set(as('owner'))
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('INVITE_LIMIT')
    expect(dbMock.invitation.update).not.toHaveBeenCalled()
  })
})
