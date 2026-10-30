import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { can } from '@beautyos/shared'

// Kurucu karari R3: uzman kendi randevusunu tasir (yalniz saat/gun); staffId'yi yalniz sahip/mudur/resepsiyon degistirir.
const dbMock = vi.hoisted(() => ({
  staffProfile: { findFirst: vi.fn() },
  appointment: { findFirst: vi.fn(), update: vi.fn() },
}))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: { add: vi.fn(), remove: vi.fn() } }))
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
const URL = '/api/v1/tenants/salon/appointments/a1/reschedule'
const as = (role: string) => ({ 'x-role': role })
const SP_ME = '33333333-3333-4333-8333-333333333333'
const SP_OTHER = '44444444-4444-4444-8444-444444444444'
const START = '2026-11-20T10:00:00.000Z'

const appt = (staffId: string) => ({ id: 'a1', tenantId: 't1', staffId, serviceId: 'sv1', status: 'confirmed', service: { durationMinutes: 30 } })
const updated = (staffId: string) => ({
  id: 'a1', referenceCode: 'RDV-1', requestedName: null, status: 'confirmed', startAt: new Date(START), endAt: new Date(START), staffId,
  customer: { fullName: 'Ayse' }, service: { name: 'Sac' }, staff: { colorCode: '#fff', user: { fullName: 'Uzman' } },
})

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.appointment.update.mockImplementation(async ({ data }: { data: { staffId?: string } }) => updated(data.staffId ?? SP_ME))
})

describe('izin tablosu', () => {
  it('K-R3: uzman appointment.reschedule alir; staffId degistirme izni (appointment.reassign_staff) yalniz sahip, mudur, resepsiyon', () => {
    expect(can('staff', 'appointment.reschedule')).toBe(true)
    for (const role of ['owner', 'manager', 'receptionist']) {
      expect(can(role, 'appointment.reschedule')).toBe(true)
      expect(can(role, 'appointment.reassign_staff')).toBe(true)
    }
    expect(can('staff', 'appointment.reassign_staff')).toBe(false)
  })
})

describe('PATCH /appointments/:id/reschedule', () => {
  it('K-R3: uzman kendi randevusunun saatini degistirir; yalniz startAt/endAt yazilir (staffId yazilmaz)', async () => {
    dbMock.staffProfile.findFirst.mockResolvedValue({ id: SP_ME })
    dbMock.appointment.findFirst.mockResolvedValueOnce(appt(SP_ME)).mockResolvedValueOnce(null)
    const res = await request(app).patch(URL).set(as('staff')).send({ startAt: START })
    expect(res.status).toBe(200)
    const data = dbMock.appointment.update.mock.calls[0][0].data
    expect(Object.keys(data).sort()).toEqual(['endAt', 'startAt'])
  })

  it('K-R3: uzman baska uzmanin randevusunu tasiyamaz (403, yazma yok); randevu var oldugu once dogrulanir', async () => {
    dbMock.staffProfile.findFirst.mockResolvedValue({ id: SP_ME })
    dbMock.appointment.findFirst.mockResolvedValueOnce(appt(SP_OTHER))
    const res = await request(app).patch(URL).set(as('staff')).send({ startAt: START })
    expect(res.status).toBe(403)
    expect(dbMock.appointment.update).not.toHaveBeenCalled()
  })

  it('K-R3: uzman staffId gonderirse (baska personele tasima) 403; kendi staffId\'sini gondermek saat degisimidir (200)', async () => {
    dbMock.staffProfile.findFirst.mockResolvedValue({ id: SP_ME })
    dbMock.appointment.findFirst.mockResolvedValue(appt(SP_ME))
    const other = await request(app).patch(URL).set(as('staff')).send({ startAt: START, staffId: SP_OTHER })
    expect(other.status).toBe(403)
    expect(dbMock.appointment.update).not.toHaveBeenCalled()
    dbMock.appointment.findFirst.mockReset().mockResolvedValueOnce(appt(SP_ME)).mockResolvedValueOnce(null)
    const same = await request(app).patch(URL).set(as('staff')).send({ startAt: START, staffId: SP_ME })
    expect(same.status).toBe(200)
  })

  it('K-R3: profili olmayan uzman tasiyamaz (403)', async () => {
    dbMock.staffProfile.findFirst.mockResolvedValue(null)
    dbMock.appointment.findFirst.mockResolvedValueOnce(appt(SP_ME))
    const res = await request(app).patch(URL).set(as('staff')).send({ startAt: START })
    expect(res.status).toBe(403)
    expect(dbMock.appointment.update).not.toHaveBeenCalled()
  })

  it('K-R3: sahip/mudur/resepsiyon staffId degistirir; hedef personel hizmeti veriyor olmali (sorgu kiraci + hizmet atamasi), cakisma hedef personelde aranir', async () => {
    for (const role of ['owner', 'manager', 'receptionist']) {
      dbMock.appointment.findFirst.mockReset().mockResolvedValueOnce(appt(SP_ME)).mockResolvedValueOnce(null)
      dbMock.staffProfile.findFirst.mockReset().mockResolvedValue({ id: SP_OTHER })
      const res = await request(app).patch(URL).set(as(role)).send({ startAt: START, staffId: SP_OTHER })
      expect(res.status, role).toBe(200)
      expect(dbMock.appointment.update.mock.calls.at(-1)![0].data).toMatchObject({ staffId: SP_OTHER })
      expect(dbMock.staffProfile.findFirst.mock.calls[0][0].where).toMatchObject({ id: SP_OTHER, tenantId: 't1', serviceAssignments: { some: { serviceId: 'sv1', isActive: true } }, user: { isActive: true } })
      expect(dbMock.appointment.findFirst.mock.calls[1][0].where).toMatchObject({ staffId: SP_OTHER, tenantId: 't1' })
    }
  })

  it('K-R3: hedef personel bulunamaz ya da hizmeti vermiyorsa 400 STAFF_NOT_ASSIGNABLE, yazma yok', async () => {
    dbMock.appointment.findFirst.mockResolvedValueOnce(appt(SP_ME))
    dbMock.staffProfile.findFirst.mockResolvedValue(null)
    const res = await request(app).patch(URL).set(as('owner')).send({ startAt: START, staffId: SP_OTHER })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('STAFF_NOT_ASSIGNABLE')
    expect(dbMock.appointment.update).not.toHaveBeenCalled()
  })

  it('K-R3: hedef personelde cakisma tek SLOT_TAKEN 409 doner', async () => {
    dbMock.appointment.findFirst.mockResolvedValueOnce(appt(SP_ME)).mockResolvedValueOnce({ id: 'baska' })
    dbMock.staffProfile.findFirst.mockResolvedValue({ id: SP_OTHER })
    const res = await request(app).patch(URL).set(as('owner')).send({ startAt: START, staffId: SP_OTHER })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SLOT_TAKEN')
  })

  it('K-R3: tamamlanmis randevu STATUS_LOCKED (uzman icin de)', async () => {
    dbMock.staffProfile.findFirst.mockResolvedValue({ id: SP_ME })
    dbMock.appointment.findFirst.mockResolvedValueOnce({ ...appt(SP_ME), status: 'completed' })
    const res = await request(app).patch(URL).set(as('staff')).send({ startAt: START })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('STATUS_LOCKED')
  })

  it('K-R3: resepsiyonun bilinmeyen/rolsuz istegi gecmez: bilinmeyen rol 403', async () => {
    const res = await request(app).patch(URL).set(as('kral')).send({ startAt: START })
    expect(res.status).toBe(403)
  })
})
