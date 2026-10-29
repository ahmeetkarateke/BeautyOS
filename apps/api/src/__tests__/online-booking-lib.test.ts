import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

// Bu dosya veritabani ve Redis gerektirmez: db ve kuyruk sahtelenir.
const dbMock = vi.hoisted(() => ({
  appointment: { updateMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  tenant: { findUnique: vi.fn() },
}))
const queueMock = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: queueMock }))

import {
  ONLINE_LIMITS,
  approveOnlineRequest,
  computeExpiryAt,
  expireOnlineRequest,
  expiryJobId,
  phoneVariants,
  rejectOnlineRequest,
  scheduleOnlineExpiry,
  sweepExpiredOnlineRequests,
} from '../lib/online-booking'
import { createAppointmentApprovalRouter } from '../routes/appointment-approval.route'

const H = 60 * 60 * 1000

beforeEach(() => {
  dbMock.appointment.updateMany.mockReset().mockResolvedValue({ count: 1 })
  dbMock.appointment.findFirst.mockReset().mockResolvedValue(null)
  dbMock.appointment.findMany.mockReset().mockResolvedValue([])
  dbMock.tenant.findUnique.mockReset().mockResolvedValue({ isActive: true, trialEndsAt: null })
  queueMock.add.mockReset().mockResolvedValue({})
  queueMock.remove.mockReset().mockResolvedValue(1)
})

describe('S2: sure dolumu hesabi', () => {
  it('K3: randevu uzaksa son tarih talepten 24 saat sonradir', () => {
    const created = new Date('2026-11-01T10:00:00Z')
    const start = new Date('2026-11-10T10:00:00Z')
    expect(computeExpiryAt(created, start).toISOString()).toBe('2026-11-02T10:00:00.000Z')
  })

  it('K3: randevu yakinsa son tarih randevudan 2 saat oncedir (hangisi once ise)', () => {
    const created = new Date('2026-11-01T10:00:00Z')
    const start = new Date('2026-11-01T18:00:00Z')
    expect(computeExpiryAt(created, start).toISOString()).toBe('2026-11-01T16:00:00.000Z')
  })

  it('K3: is kimligi online-expire-<id> bicimindedir', () => {
    expect(expiryJobId('abc')).toBe('online-expire-abc')
  })
})

describe('S2: sure dolumu isi', () => {
  it('K3: belirlenimci kimlik ve bekleme suresiyle kurulur; ayni cagri ayni kimligi kullanir (iki is olusmaz)', async () => {
    const now = new Date('2026-11-01T10:00:00Z')
    const expiresAt = new Date(now.getTime() + 5 * H)
    await scheduleOnlineExpiry('a1', expiresAt, now)
    await scheduleOnlineExpiry('a1', expiresAt, now)
    expect(queueMock.add).toHaveBeenCalledTimes(2)
    for (const call of queueMock.add.mock.calls) {
      expect(call[0]).toBe('online-expire')
      expect(call[1]).toEqual({ type: 'online_expire', appointmentId: 'a1' })
      expect(call[2]).toMatchObject({ jobId: 'online-expire-a1', delay: 5 * H })
    }
  })

  it('K3: gecmis son tarihte gecikme 0 olur (negatif gecikme verilmez)', async () => {
    const now = new Date('2026-11-01T10:00:00Z')
    await scheduleOnlineExpiry('a2', new Date(now.getTime() - H), now)
    expect(queueMock.add.mock.calls[0][2].delay).toBe(0)
  })

  it('K3: kuyruk hatasi yutulmaz, false doner ve kisisel veri olmadan loglanir (sure dolumu yine de gece taramasinda yakalanir)', async () => {
    queueMock.add.mockRejectedValueOnce(new Error('redis down'))
    const ok = await scheduleOnlineExpiry('a3', new Date(Date.now() + H), new Date())
    expect(ok).toBe(false)
  })

  it('K3: sure dolumu yalniz hala bekleyen talebi iptal eder (expired nedeniyle), kosul atomiktir', async () => {
    const ok = await expireOnlineRequest('a1')
    expect(ok).toBe(true)
    expect(dbMock.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', status: 'pending', bookingChannel: 'web' },
      data: { status: 'cancelled', cancelReason: 'expired' },
    })
  })

  it('K3: talep zaten onaylanmissa (guncellenen satir 0) sure dolumu bir sey yapmaz', async () => {
    dbMock.appointment.updateMany.mockResolvedValueOnce({ count: 0 })
    expect(await expireOnlineRequest('a1')).toBe(false)
  })

  it('K3: gece taramasi kuyruk isi kaybolmus bekleyen talepleri de iptal eder', async () => {
    dbMock.appointment.updateMany.mockResolvedValueOnce({ count: 3 })
    const now = new Date('2026-11-02T00:00:00Z')
    const count = await sweepExpiredOnlineRequests(now)
    expect(count).toBe(3)
    const args = dbMock.appointment.updateMany.mock.calls[0][0]
    expect(args.where).toMatchObject({ status: 'pending', bookingChannel: 'web' })
    expect(args.where.OR).toEqual([
      { createdAt: { lte: new Date(now.getTime() - ONLINE_LIMITS.expiryHours * H) } },
      { startAt: { lte: new Date(now.getTime() + ONLINE_LIMITS.expiryLeadHours * H) } },
    ])
    expect(args.data).toEqual({ status: 'cancelled', cancelReason: 'expired' })
  })
})

describe('S2: telefon bicimleri', () => {
  it('ayni numaranin kayitli bicimlerini uretir (+90, 0, bosluksuz, 90)', () => {
    const v = phoneVariants('0555 111 22 33')
    expect(v).toEqual(expect.arrayContaining(['+905551112233', '05551112233', '5551112233', '905551112233']))
  })

  it('normalize edilemeyen girdide bos liste doner', () => {
    expect(phoneVariants('12')).toEqual([])
  })
})

describe('S2: onay ve ret', () => {
  it('K1: onay yalniz kendi kiracisinin bekleyen talebini confirmed yapar', async () => {
    const result = await approveOnlineRequest('t1', 'a1')
    expect(result).toBe('ok')
    expect(dbMock.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', tenantId: 't1', status: 'pending', isDeleted: false },
      data: { status: 'confirmed' },
    })
    expect(queueMock.remove).toHaveBeenCalledWith('online-expire-a1')
  })

  it('onay: baska kiracinin talebi not_found doner', async () => {
    dbMock.appointment.updateMany.mockResolvedValueOnce({ count: 0 })
    dbMock.appointment.findFirst.mockResolvedValueOnce(null)
    expect(await approveOnlineRequest('t2', 'a1')).toBe('not_found')
    expect(dbMock.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1', tenantId: 't2' } }))
  })

  it('onay: talep bekleyen degilse not_pending doner', async () => {
    dbMock.appointment.updateMany.mockResolvedValueOnce({ count: 0 })
    dbMock.appointment.findFirst.mockResolvedValueOnce({ status: 'cancelled' })
    expect(await approveOnlineRequest('t1', 'a1')).toBe('not_pending')
  })

  it('K1: ret rejected nedenli iptaldir ve reddeden kullaniciyi kaydeder', async () => {
    expect(await rejectOnlineRequest('t1', 'a1', 'u9')).toBe('ok')
    expect(dbMock.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', tenantId: 't1', status: 'pending', isDeleted: false },
      data: { status: 'cancelled', cancelReason: 'rejected', cancelledById: 'u9' },
    })
    expect(queueMock.remove).toHaveBeenCalledWith('online-expire-a1')
  })

  it('ret: baska kiracinin talebi not_found, bekleyen degilse not_pending', async () => {
    dbMock.appointment.updateMany.mockResolvedValue({ count: 0 })
    dbMock.appointment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: 'confirmed' })
    expect(await rejectOnlineRequest('t2', 'a1', 'u9')).toBe('not_found')
    expect(await rejectOnlineRequest('t1', 'a1', 'u9')).toBe('not_pending')
  })

  it('kuyruk kaldirma hatasi onayi bozmaz (is zaten bekleyen degilse etkisiz)', async () => {
    queueMock.remove.mockRejectedValueOnce(new Error('redis down'))
    expect(await approveOnlineRequest('t1', 'a1')).toBe('ok')
  })
})

describe('S2: onay/ret uclari (yetki)', () => {
  const secret = 'x'.repeat(40)
  function tokenFor(role: string, tenantId = 't1') {
    return jwt.sign({ userId: 'u1', tenantId, tenantSlug: 'salon', role }, secret, { expiresIn: '5m' })
  }
  function makeApp() {
    process.env.JWT_SECRET = secret
    const app = express()
    app.use(express.json())
    app.use('/api/v1/tenants/:slug', createAppointmentApprovalRouter())
    return app
  }

  it('K1: sahip ve mudur onaylayabilir (200 + confirmed)', async () => {
    for (const role of ['owner', 'manager']) {
      const res = await request(makeApp())
        .patch('/api/v1/tenants/salon/appointments/a1/approve')
        .set('Authorization', `Bearer ${tokenFor(role)}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ id: 'a1', status: 'confirmed' })
    }
  })

  it('K1: uzman (staff) onaylayamaz ve reddedemez (403), veri degismez', async () => {
    for (const action of ['approve', 'reject']) {
      const res = await request(makeApp())
        .patch(`/api/v1/tenants/salon/appointments/a1/${action}`)
        .set('Authorization', `Bearer ${tokenFor('staff')}`)
      expect(res.status).toBe(403)
    }
    expect(dbMock.appointment.updateMany).not.toHaveBeenCalled()
  })

  it('K1: ret 200 + cancelled doner; bekleyen olmayan talepte 409 NOT_PENDING', async () => {
    const ok = await request(makeApp())
      .patch('/api/v1/tenants/salon/appointments/a1/reject')
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
    expect(ok.status).toBe(200)
    expect(ok.body).toEqual({ id: 'a1', status: 'cancelled' })

    dbMock.appointment.updateMany.mockResolvedValueOnce({ count: 0 })
    dbMock.appointment.findFirst.mockResolvedValueOnce({ status: 'confirmed' })
    const locked = await request(makeApp())
      .patch('/api/v1/tenants/salon/appointments/a1/reject')
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
    expect(locked.status).toBe(409)
    expect(locked.body.error.code).toBe('NOT_PENDING')
  })

  it('kiraci izolasyonu: baska salonun slug\'i ile istek 403 (token baska kiraciya ait)', async () => {
    const res = await request(makeApp())
      .patch('/api/v1/tenants/baska-salon/appointments/a1/approve')
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
    expect(res.status).toBe(403)
    expect(dbMock.appointment.updateMany).not.toHaveBeenCalled()
  })

  it('gecersiz randevu kimligi 400 VALIDATION_ERROR', async () => {
    const res = await request(makeApp())
      .patch('/api/v1/tenants/salon/appointments/not-a-uuid/approve')
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
    expect(res.status).toBe(400)
  })
})
