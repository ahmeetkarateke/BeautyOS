import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

// Bu dosya veritabani ve Redis gerektirmez: db ve kuyruk sahtelenir.
const dbMock = vi.hoisted(() => ({
  appointment: { updateMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  customer: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  tenant: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}))
const queueMock = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }))
vi.mock('../lib/db', () => ({ db: dbMock }))
vi.mock('../lib/queue', () => ({ remindersQueue: queueMock }))

import {
  ONLINE_LIMITS,
  anonymizeStaleRequests,
  approveOnlineRequest,
  computeExpiryAt,
  expireOnlineRequest,
  findCustomerCandidates,
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
  dbMock.appointment.findFirst.mockReset().mockResolvedValue({ status: 'pending', customerId: 'c1', requestedName: null, requestedPhone: null })
  dbMock.customer.findFirst.mockReset().mockResolvedValue(null)
  dbMock.customer.findMany.mockReset().mockResolvedValue([])
  dbMock.customer.create.mockReset().mockResolvedValue({ id: 'new-cust' })
  dbMock.$transaction.mockReset().mockImplementation(async (fn: (tx: typeof dbMock) => unknown) => fn(dbMock))
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

describe('S2: saklama (hukuk-uyum: 30 gun)', () => {
  it('iptal ya da gelmedi (eski uctan no_show) olmus musterisiz talebin ad ve telefonu 30 gunden eskiyse anonimlestirilir (CHECK icin - ile doldurulur), onayli/bagli kayda dokunulmaz', async () => {
    dbMock.appointment.updateMany.mockResolvedValueOnce({ count: 4 })
    const now = new Date('2026-12-15T00:00:00Z')
    expect(await anonymizeStaleRequests(now)).toBe(4)
    expect(dbMock.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        customerId: null,
        status: { in: ['cancelled', 'no_show'] },
        updatedAt: { lte: new Date('2026-11-15T00:00:00.000Z') },
        NOT: { requestedPhone: '-' },
      },
      data: { requestedName: '-', requestedPhone: '-' },
    })
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
    expect(dbMock.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1', tenantId: 't2', isDeleted: false } }))
    expect(dbMock.appointment.updateMany).not.toHaveBeenCalled()
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

describe('S2 Kritik 2: dogrulanmamis talepte musteri eslestirme (onayda)', () => {
  const PHONE = '+905551112233'
  const unverified = { status: 'pending', customerId: null, requestedName: 'Ayse Yilmaz', requestedPhone: PHONE }
  beforeEach(() => dbMock.appointment.findFirst.mockResolvedValue(unverified))

  it("create: telefon kiracida kayitli degilse yeni musteri ayni islemde olusur ve talep confirmed olur (customerId IS NULL kosuluyla)", async () => {
    expect(await approveOnlineRequest('t1', 'a1', { customerAction: 'create' })).toBe('ok')
    expect(dbMock.customer.create).toHaveBeenCalledWith({ data: { tenantId: 't1', phone: PHONE, fullName: 'Ayse Yilmaz' }, select: { id: true } })
    expect(dbMock.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', tenantId: 't1', status: 'pending', customerId: null, isDeleted: false },
      data: { customerId: 'new-cust', status: 'confirmed' },
    })
    expect(queueMock.remove).toHaveBeenCalledWith('online-expire-a1')
  })

  it('create (govdesiz eski durum): telefon kayitliysa CUSTOMER_MATCH_REQUIRED icin adaylar doner, musteri olusmaz, talep degismez', async () => {
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c9', fullName: 'Baska Ad' }])
    const result = await approveOnlineRequest('t1', 'a1')
    expect(result).toEqual({ result: 'match_required', candidates: [{ id: 'c9', fullName: 'Baska Ad' }] })
    expect(dbMock.customer.create).not.toHaveBeenCalled()
    expect(dbMock.appointment.updateMany).not.toHaveBeenCalled()
    const q = dbMock.customer.findMany.mock.calls[0][0]
    expect(q.where.tenantId).toBe('t1')
    expect(q.where.phone.in).toEqual(expect.arrayContaining([PHONE, '05551112233']))
    expect(q.take).toBe(5)
  })

  it('create: iki es zamanli onaydan ikincisi (guncellenen satir 0) not_pending alir ve islem geri alinir', async () => {
    dbMock.appointment.updateMany.mockResolvedValueOnce({ count: 0 })
    dbMock.appointment.findFirst.mockResolvedValueOnce(unverified).mockResolvedValueOnce({ status: 'confirmed' })
    expect(await approveOnlineRequest('t1', 'a1', { customerAction: 'create' })).toBe('not_pending')
    expect(queueMock.remove).not.toHaveBeenCalled()
  })

  it('link: telefonu talepteki telefonla eslesen musteri baglanir (biçim farki onemsiz)', async () => {
    dbMock.customer.findFirst.mockResolvedValue({ id: 'c9', phone: '0555 111 22 33' })
    expect(await approveOnlineRequest('t1', 'a1', { customerAction: 'link', customerId: 'c9' })).toBe('ok')
    expect(dbMock.customer.findFirst).toHaveBeenCalledWith({ where: { id: 'c9', tenantId: 't1' }, select: { id: true, phone: true } })
    expect(dbMock.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', tenantId: 't1', status: 'pending', customerId: null, isDeleted: false },
      data: { customerId: 'c9', status: 'confirmed' },
    })
  })

  it('link: baska telefonlu musteri reddedilir (customer_phone_mismatch), talep degismez', async () => {
    dbMock.customer.findFirst.mockResolvedValue({ id: 'c9', phone: '+905559998877' })
    expect(await approveOnlineRequest('t1', 'a1', { customerAction: 'link', customerId: 'c9' })).toEqual({ result: 'customer_phone_mismatch' })
    expect(dbMock.appointment.updateMany).not.toHaveBeenCalled()
  })

  it('link: musteri bu kiracida yoksa (baska kiracinin kimligi) customer_not_found; sorgu tenantId ile yapilir', async () => {
    dbMock.customer.findFirst.mockResolvedValue(null)
    expect(await approveOnlineRequest('t1', 'a1', { customerAction: 'link', customerId: 'c-baska-kiraci' })).toEqual({ result: 'customer_not_found' })
    expect(dbMock.customer.findFirst.mock.calls[0][0].where).toEqual({ id: 'c-baska-kiraci', tenantId: 't1' })
    expect(dbMock.appointment.updateMany).not.toHaveBeenCalled()
  })

  it('link: customerId verilmeden link customer_not_found (route zaten 400 verir)', async () => {
    expect(await approveOnlineRequest('t1', 'a1', { customerAction: 'link' })).toEqual({ result: 'customer_not_found' })
  })

  it('ret musteri olusturmaz ve musterisiz talepte de calisir', async () => {
    expect(await rejectOnlineRequest('t1', 'a1', 'u9')).toBe('ok')
    expect(dbMock.customer.create).not.toHaveBeenCalled()
  })

  it('aday listesi en eski kayittan baslar ve en cok 5 doner', async () => {
    await findCustomerCandidates('t1', PHONE)
    expect(dbMock.customer.findMany.mock.calls[0][0]).toMatchObject({ orderBy: { createdAt: 'asc' }, take: 5 })
  })
})

describe('S2: onay/ret uclari (yetki)', () => {
  const APPT = '33333333-3333-4333-8333-333333333333'
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
        .patch(`/api/v1/tenants/salon/appointments/${APPT}/approve`)
        .set('Authorization', `Bearer ${tokenFor(role)}`)
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ id: APPT, status: 'confirmed' })
    }
  })

  it('onay govdesi: link icin customerId zorunlu (400), gecersiz customerAction 400', async () => {
    for (const body of [{ customerAction: 'link' }, { customerAction: 'merge' }, { customerAction: 'link', customerId: 'x' }]) {
      const res = await request(makeApp())
        .patch(`/api/v1/tenants/salon/appointments/${APPT}/approve`)
        .set('Authorization', `Bearer ${tokenFor('owner')}`)
        .send(body)
      expect(res.status).toBe(400)
    }
    expect(dbMock.appointment.updateMany).not.toHaveBeenCalled()
  })

  it('CUSTOMER_MATCH_REQUIRED: 409, aday kimlik ve adlari govdede, kayitli telefon icin eslestirme mesaji', async () => {
    dbMock.appointment.findFirst.mockResolvedValue({ status: 'pending', customerId: null, requestedName: 'A', requestedPhone: '+905551112233' })
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c9', fullName: 'Kayitli' }])
    const res = await request(makeApp())
      .patch(`/api/v1/tenants/salon/appointments/${APPT}/approve`)
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CUSTOMER_MATCH_REQUIRED')
    expect(res.body.error.message).toBe('Bu telefonla kayıtlı bir müşteri var; eşleştirmeyi yeni panelden yapın.')
    expect(res.body.candidates).toEqual([{ id: 'c9', fullName: 'Kayitli' }])
  })

  it('customer-candidates: owner gorur, staff 403; musterisi bagli talepte bos liste; baska kiracida 404', async () => {
    dbMock.appointment.findFirst.mockResolvedValue({ customerId: null, requestedPhone: '+905551112233' })
    dbMock.customer.findMany.mockResolvedValue([{ id: 'c9', fullName: 'Kayitli' }])
    const url = `/api/v1/tenants/salon/appointments/${APPT}/customer-candidates`
    const ok = await request(makeApp()).get(url).set('Authorization', `Bearer ${tokenFor('owner')}`)
    expect(ok.status).toBe(200)
    expect(ok.body.data).toEqual([{ id: 'c9', fullName: 'Kayitli' }])
    expect(dbMock.appointment.findFirst.mock.calls[0][0].where).toMatchObject({ id: APPT, tenantId: 't1' })

    expect((await request(makeApp()).get(url).set('Authorization', `Bearer ${tokenFor('staff')}`)).status).toBe(403)

    dbMock.appointment.findFirst.mockResolvedValue({ customerId: 'c1', requestedPhone: null })
    expect((await request(makeApp()).get(url).set('Authorization', `Bearer ${tokenFor('owner')}`)).body.data).toEqual([])

    dbMock.appointment.findFirst.mockResolvedValue(null)
    expect((await request(makeApp()).get(url).set('Authorization', `Bearer ${tokenFor('owner')}`)).status).toBe(404)
  })

  it('K1: uzman (staff) onaylayamaz ve reddedemez (403), veri degismez', async () => {
    for (const action of ['approve', 'reject']) {
      const res = await request(makeApp())
        .patch(`/api/v1/tenants/salon/appointments/${APPT}/${action}`)
        .set('Authorization', `Bearer ${tokenFor('staff')}`)
      expect(res.status).toBe(403)
    }
    expect(dbMock.appointment.updateMany).not.toHaveBeenCalled()
  })

  it('K1: ret 200 + cancelled doner; bekleyen olmayan talepte 409 NOT_PENDING', async () => {
    const ok = await request(makeApp())
      .patch(`/api/v1/tenants/salon/appointments/${APPT}/reject`)
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
    expect(ok.status).toBe(200)
    expect(ok.body).toEqual({ id: APPT, status: 'cancelled' })

    dbMock.appointment.updateMany.mockResolvedValueOnce({ count: 0 })
    dbMock.appointment.findFirst.mockResolvedValueOnce({ status: 'confirmed' })
    const locked = await request(makeApp())
      .patch(`/api/v1/tenants/salon/appointments/${APPT}/reject`)
      .set('Authorization', `Bearer ${tokenFor('owner')}`)
    expect(locked.status).toBe(409)
    expect(locked.body.error.code).toBe('NOT_PENDING')
  })

  it('kiraci izolasyonu: baska salonun slug\'i ile istek 403 (token baska kiraciya ait)', async () => {
    const res = await request(makeApp())
      .patch(`/api/v1/tenants/baska-salon/appointments/${APPT}/approve`)
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
