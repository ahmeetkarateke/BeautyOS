import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createHash } from 'node:crypto'

// A3 / ADR-0042: herkese acik kabul uclari. DB ve oturum katmani sahte; DB/Redis gerekmez.
const m = vi.hoisted(() => {
  const tx = {
    invitation: { updateMany: vi.fn(), update: vi.fn() },
    user: { create: vi.fn() },
    staffProfile: { create: vi.fn() },
  }
  return {
    tx,
    db: {
      invitation: { findFirst: vi.fn() },
      user: { findFirst: vi.fn() },
      $transaction: vi.fn(),
    },
    createSession: vi.fn(),
  }
})

vi.mock('../lib/db', () => ({ db: m.db }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() } }))
vi.mock('../lib/sessions', () => ({ createSession: m.createSession, SESSION_TTL_MS: 30 * 86_400_000 }))

import { createPublicInvitationsRouter } from '../routes/invitations.route'

const app = express().use(express.json()).use('/api/v1/auth/invitations', createPublicInvitationsRouter())
const TOKEN = 'T'.repeat(43)
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const invite = (over: Record<string, unknown> = {}) => ({
  id: 'i1', tenantId: 't1', email: 'ayse@example.com', fullName: 'Ayse Yilmaz', role: 'staff', title: 'Kuafor',
  expiresAt: new Date(Date.now() + 86_400_000),
  tenant: { name: 'Salon', slug: 'salon', settings: {} },
  ...over,
})
const accept = (body: object = {}) => request(app).post('/api/v1/auth/invitations/accept').send({ token: TOKEN, password: 'Sifre1234', ...body })
const lookup = (token: unknown = TOKEN) => request(app).post('/api/v1/auth/invitations/lookup').send({ token })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = 'x'.repeat(40)
  m.db.invitation.findFirst.mockResolvedValue(invite())
  m.db.user.findFirst.mockResolvedValue(null)
  m.db.$transaction.mockImplementation(async (fn: (t: typeof m.tx) => unknown) => fn(m.tx))
  m.tx.invitation.updateMany.mockResolvedValue({ count: 1 })
  m.tx.invitation.update.mockResolvedValue({})
  m.tx.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'u9', ...data }))
  m.tx.staffProfile.create.mockResolvedValue({ id: 'sp1' })
  m.createSession.mockResolvedValue({ refreshToken: 'refresh-opak', familyId: 'fam1' })
})

describe('POST /auth/invitations/lookup (ADR-0046: token govdede)', () => {
  it('gecerli bag: davet ozeti doner, token ozet olarak sorgulanir, Referrer-Policy no-referrer', async () => {
    const res = await lookup()
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ tenantName: 'Salon', role: 'staff', email: 'ayse@example.com', fullName: 'Ayse Yilmaz' })
    expect(res.body.expiresAt).toBeTruthy()
    expect(res.headers['referrer-policy']).toBe('no-referrer')
    const where = m.db.invitation.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ tokenHash: sha256(TOKEN), acceptedAt: null, revokedAt: null })
    expect(where.expiresAt.gt).toBeInstanceOf(Date)
  })

  it('gecersiz, suresi dolmus, kullanilmis ya da iptal: hepsi ayni 404 INVITATION_INVALID govdesi', async () => {
    m.db.invitation.findFirst.mockResolvedValue(null)
    const a = await lookup('A'.repeat(43))
    const b = await lookup('B'.repeat(43))
    expect(a.status).toBe(404)
    expect(a.body.error.code).toBe('INVITATION_INVALID')
    expect(b.body).toEqual(a.body)
  })
})

describe('POST /auth/invitations/accept', () => {
  it('mutlu yol: kullanici davetteki rol ve e-postayla olusur, uzman profili unvanla, oturum acilir (girisle ayni yanit)', async () => {
    const res = await accept()
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user).toMatchObject({ id: 'u9', email: 'ayse@example.com', role: 'staff', tenantSlug: 'salon' })
    expect(String(res.headers['set-cookie'])).toContain('refreshToken=refresh-opak')
    expect(m.tx.user.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', email: 'ayse@example.com', role: 'staff', fullName: 'Ayse Yilmaz' })
    expect(m.tx.staffProfile.create.mock.calls[0][0].data).toMatchObject({ userId: 'u9', tenantId: 't1', title: 'Kuafor' })
    expect(m.createSession).toHaveBeenCalledWith('u9', 't1')
  })

  it('sifre duz metin saklanmaz (bcrypt ozeti)', async () => {
    await accept()
    const hash = m.tx.user.create.mock.calls[0][0].data.passwordHash as string
    expect(hash).not.toContain('Sifre1234')
    expect(hash).toMatch(/^\$2[aby]\$/)
  })

  it('manager daveti uzman profili olusturmaz (A2: profil yalniz staff icin)', async () => {
    m.db.invitation.findFirst.mockResolvedValue(invite({ role: 'manager', title: null }))
    const res = await accept()
    expect(res.status).toBe(200)
    expect(m.tx.staffProfile.create).not.toHaveBeenCalled()
    expect(m.tx.user.create.mock.calls[0][0].data.role).toBe('manager')
  })

  it('govdede role/email/tenantId gonderilse bile davetten gelir (degistirilemez)', async () => {
    await accept({ role: 'owner', email: 'baska@example.com', tenantId: 'baska' })
    expect(m.tx.user.create.mock.calls[0][0].data).toMatchObject({ role: 'staff', email: 'ayse@example.com', tenantId: 't1' })
  })

  it('zayif sifre 400, hicbir sey yazilmaz (baska her sey gecerli)', async () => {
    const res = await accept({ password: 'abcdefgh' })
    expect(res.status).toBe(400)
    expect(m.db.$transaction).not.toHaveBeenCalled()
  })

  it('ikinci kabul / es zamanli yarisi kaybeden: kosullu guncelleme count 0 -> 404 INVITATION_INVALID, kullanici olusmaz', async () => {
    m.tx.invitation.updateMany.mockResolvedValue({ count: 0 })
    const res = await accept()
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('INVITATION_INVALID')
    expect(m.tx.user.create).not.toHaveBeenCalled()
    expect(m.createSession).not.toHaveBeenCalled()
    const where = m.tx.invitation.updateMany.mock.calls[0][0].where
    expect(where).toMatchObject({ tokenHash: sha256(TOKEN), acceptedAt: null, revokedAt: null })
    expect(where.expiresAt.gt).toBeInstanceOf(Date)
  })

  it('gecersiz bag (bulunamadi) 404 INVITATION_INVALID', async () => {
    m.db.invitation.findFirst.mockResolvedValue(null)
    const res = await accept()
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('INVITATION_INVALID')
  })

  it('e-posta baska kiracida kayitliysa 409 INVITATION_EMAIL_IN_USE, davet harcanmaz', async () => {
    m.db.user.findFirst.mockResolvedValue({ id: 'baska' })
    const res = await accept()
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INVITATION_EMAIL_IN_USE')
    expect(m.db.$transaction).not.toHaveBeenCalled()
    expect(m.db.user.findFirst.mock.calls[0][0].where).toMatchObject({ email: 'ayse@example.com' })
  })

  it('kullanici olusturma tekillik hatasi (P2002, yaris) 409 INVITATION_EMAIL_IN_USE', async () => {
    m.tx.user.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    const res = await accept()
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INVITATION_EMAIL_IN_USE')
  })
})

describe('ADR-0046: gizli token URL yolunda tasinmaz', () => {
  it('eski GET /:token yolu 404 doner (route yok), veritabani sorgulanmaz', async () => {
    const res = await request(app).get(`/api/v1/auth/invitations/${TOKEN}`)
    expect(res.status).toBe(404)
    expect(m.db.invitation.findFirst).not.toHaveBeenCalled()
  })

  it('eski POST /:token/accept yolu da calismaz: kullanici olusmaz', async () => {
    const res = await request(app).post(`/api/v1/auth/invitations/${TOKEN}/accept`).send({ password: 'Sifre1234' })
    expect(res.status).toBe(404)
    expect(m.tx.user.create).not.toHaveBeenCalled()
  })

  it.each([
    ['token eksik', {}],
    ['token string degil', { token: 123 }],
    ['token cok kisa', { token: 'kisa' }],
  ])('lookup: %s -> 400 ve yanit gövdesi gonderilen degeri icermez', async (_n, body) => {
    const res = await request(app).post('/api/v1/auth/invitations/lookup').send(body)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(m.db.invitation.findFirst).not.toHaveBeenCalled()
  })

  it('accept: token eksikse 400 (sifre gecerli), hata iletisi gonderilen tokeni icermez', async () => {
    const res = await request(app).post('/api/v1/auth/invitations/accept').send({ password: 'Sifre1234' })
    expect(res.status).toBe(400)
    expect(m.db.$transaction).not.toHaveBeenCalled()
    const bad = await request(app).post('/api/v1/auth/invitations/accept').send({ token: TOKEN, password: 'zayif' })
    expect(bad.status).toBe(400)
    expect(JSON.stringify(bad.body)).not.toContain(TOKEN)
  })

  it('sorgu dizgisiyle gonderilen token yok sayilir (gövde esas)', async () => {
    const res = await request(app).post(`/api/v1/auth/invitations/lookup?token=${TOKEN}`).send({})
    expect(res.status).toBe(400)
  })
})
