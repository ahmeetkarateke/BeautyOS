import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

// S6 K3: erisim token'i her istekte kullanici aktifligi ve (sid varsa) canli oturum ile dogrulanir.
const dbMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  session: { findFirst: vi.fn() },
}))
vi.mock('../lib/db', () => ({ db: dbMock }))

import { authenticateJWT } from '../middleware/auth.middleware'

const SECRET = 's'.repeat(40)
const sign = (extra: Record<string, unknown> = {}) =>
  jwt.sign({ userId: 'u1', tenantId: 't1', tenantSlug: 'salon', role: 'owner', ...extra }, SECRET, { expiresIn: '5m' })

function makeApp() {
  const app = express()
  app.get('/p', authenticateJWT, (req, res) => res.json({ userId: req.user!.userId }))
  return app
}

beforeEach(() => {
  process.env.JWT_SECRET = SECRET
  dbMock.user.findFirst.mockReset().mockResolvedValue({ id: 'u1' })
  dbMock.session.findFirst.mockReset().mockResolvedValue({ id: 's1' })
})

describe('authenticateJWT: durumlu dogrulama', () => {
  it('K3: aktif kullanici ve canli oturum -> 200; kullanici sorgusu tenantId ve isActive ile sinirli', async () => {
    const res = await request(makeApp()).get('/p').set('Authorization', `Bearer ${sign({ sid: 'fam-1' })}`)
    expect(res.status).toBe(200)
    expect(dbMock.user.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'u1', isActive: true })
    expect(dbMock.session.findFirst.mock.calls[0][0].where).toMatchObject({ familyId: 'fam-1', revokedAt: null })
  })

  it('K3: pasiflestirilmis kullanicinin henuz suresi dolmamis token\'i 401 (her istekte kontrol)', async () => {
    dbMock.user.findFirst.mockResolvedValue(null)
    const res = await request(makeApp()).get('/p').set('Authorization', `Bearer ${sign({ sid: 'fam-1' })}`)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE')
  })

  it('K2: iptal edilmis oturumun token\'i (cikis/sifre degisimi sonrasi) 401 SESSION_REVOKED', async () => {
    dbMock.session.findFirst.mockResolvedValue(null)
    const res = await request(makeApp()).get('/p').set('Authorization', `Bearer ${sign({ sid: 'fam-1' })}`)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('SESSION_REVOKED')
  })

  it('K6: sid tasimayan (gecis donemi) token yalniz kullanici aktifligiyle gecer; oturum sorgulanmaz', async () => {
    const res = await request(makeApp()).get('/p').set('Authorization', `Bearer ${sign()}`)
    expect(res.status).toBe(200)
    expect(dbMock.session.findFirst).not.toHaveBeenCalled()
    expect(dbMock.user.findFirst).toHaveBeenCalledTimes(1)
  })

  it('superadmin (tenantId yok) da aktiflik denetiminden gecer', async () => {
    const t = jwt.sign({ userId: 'root', role: 'superadmin', sid: 'fam-9' }, SECRET, { expiresIn: '5m' })
    expect((await request(makeApp()).get('/p').set('Authorization', `Bearer ${t}`)).status).toBe(200)
    dbMock.user.findFirst.mockResolvedValue(null)
    expect((await request(makeApp()).get('/p').set('Authorization', `Bearer ${t}`)).status).toBe(401)
  })

  it('gecersiz imza ve bilinmeyen rol DB\'ye gitmeden 401', async () => {
    const forged = jwt.sign({ userId: 'u1', role: 'owner' }, 'z'.repeat(40))
    expect((await request(makeApp()).get('/p').set('Authorization', `Bearer ${forged}`)).status).toBe(401)
    expect((await request(makeApp()).get('/p').set('Authorization', `Bearer ${sign({ role: 'kral' })}`)).status).toBe(401)
    expect(dbMock.user.findFirst).not.toHaveBeenCalled()
  })

  it('DB hatasi 500 olur, kimlik dogrulanmis sayilmaz (kapali basarisizlik)', async () => {
    dbMock.user.findFirst.mockRejectedValue(new Error('db down'))
    const app = makeApp()
    app.use((_e: unknown, _q: express.Request, r: express.Response, _n: express.NextFunction) => { r.status(500).json({ error: 'x' }) })
    const res = await request(app).get('/p').set('Authorization', `Bearer ${sign()}`)
    expect(res.status).toBe(500)
  })
})
