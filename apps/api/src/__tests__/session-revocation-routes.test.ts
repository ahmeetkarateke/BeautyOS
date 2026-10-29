import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import bcrypt from 'bcryptjs'

// S6 K2: sifre degisimi ve personel pasiflestirme kullanicinin tum oturumlarini kapatir. db ve sessions sahte.
const dbMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), update: vi.fn() },
  staffProfile: { findFirst: vi.fn() },
}))
const sessionsMock = vi.hoisted(() => ({ revokeUserSessions: vi.fn() }))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() } }))
vi.mock('../lib/sessions', () => sessionsMock)
vi.mock('../middleware/auth.middleware', () => ({
  authenticateJWT: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { userId: 'u-me', tenantId: 't1', tenantSlug: 'salon', role: String(req.headers['x-role']) } as never
    next()
  },
  requireTenantAccess: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.tenantId = 't1'
    next()
  },
  checkTenantActive: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

import { createTenantRouter } from '../routes/tenant.route'

const app = express().use(express.json()).use('/api/v1/tenants/:slug', createTenantRouter())
const URL = '/api/v1/tenants/salon'
const as = (role: string) => ({ 'x-role': role })

beforeEach(() => {
  vi.resetAllMocks()
})

describe('K2: sifre degisimi oturumlari kapatir', () => {
  it('K2: basarili sifre degisimi kullanicinin tum oturumlarini kapatir', async () => {
    dbMock.user.findFirst.mockResolvedValue({ id: 'u-me', passwordHash: await bcrypt.hash('EskiSifre123!', 4) })
    dbMock.user.update.mockResolvedValue({})
    const res = await request(app)
      .patch(`${URL}/users/u-me/password`)
      .set(as('owner'))
      .send({ currentPassword: 'EskiSifre123!', newPassword: 'YeniGuclu123!' })
    expect(res.status).toBe(200)
    expect(sessionsMock.revokeUserSessions).toHaveBeenCalledWith('u-me')
  })

  it('K2: yanlis mevcut sifre oturumlara dokunmaz', async () => {
    dbMock.user.findFirst.mockResolvedValue({ id: 'u-me', passwordHash: await bcrypt.hash('EskiSifre123!', 4) })
    const res = await request(app)
      .patch(`${URL}/users/u-me/password`)
      .set(as('owner'))
      .send({ currentPassword: 'yanlis', newPassword: 'YeniGuclu123!' })
    expect(res.status).toBe(401)
    expect(sessionsMock.revokeUserSessions).not.toHaveBeenCalled()
  })
})

describe('K2: pasiflestirme oturumlari kapatir', () => {
  it('K2: DELETE /staff/:id personelin kullanicisini pasiflestirir ve onun oturumlarini kapatir', async () => {
    dbMock.staffProfile.findFirst.mockResolvedValue({ userId: 'u-staff' })
    dbMock.user.update.mockResolvedValue({})
    const res = await request(app).delete(`${URL}/staff/sp1`).set(as('owner'))
    expect(res.status).toBe(200)
    expect(dbMock.user.update.mock.calls[0][0]).toMatchObject({ where: { id: 'u-staff' }, data: { isActive: false } })
    expect(sessionsMock.revokeUserSessions).toHaveBeenCalledWith('u-staff')
  })

  it('K2: yetkisiz rol (uzman) pasiflestiremez ve oturum kapanmaz', async () => {
    const res = await request(app).delete(`${URL}/staff/sp1`).set(as('staff'))
    expect(res.status).toBe(403)
    expect(sessionsMock.revokeUserSessions).not.toHaveBeenCalled()
  })

  it('K2: baska kiracinin personeli bulunamaz (404), oturum kapanmaz', async () => {
    dbMock.staffProfile.findFirst.mockResolvedValue(null)
    const res = await request(app).delete(`${URL}/staff/sp-baska`).set(as('owner'))
    expect(res.status).toBe(404)
    expect(dbMock.staffProfile.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'sp-baska', tenantId: 't1' })
    expect(sessionsMock.revokeUserSessions).not.toHaveBeenCalled()
  })
})
