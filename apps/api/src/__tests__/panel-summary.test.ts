import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Panel ozeti (menu sayaclari, deneme suresi, bugunku kasa, ilk kurulum): db ve kimlik katmani sahte, DB/Redis gerekmez.
const dbMock = vi.hoisted(() => ({
  appointment: { count: vi.fn() },
  waitlist: { count: vi.fn() },
  transaction: { aggregate: vi.fn() },
  tenant: { findUnique: vi.fn() },
  service: { count: vi.fn() },
  staffProfile: { count: vi.fn() },
}))

vi.mock('../lib/db', () => ({ db: dbMock }))
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

import { createPanelSummaryRouter } from '../routes/panel-summary.route'
import { buildSetupSteps, istanbulDayBounds, trialStatus } from '../lib/panel-summary'

const app = express().use('/api/v1/tenants/:slug/panel-summary', createPanelSummaryRouter())
const URL = '/api/v1/tenants/salon/panel-summary'
const as = (role: string) => ({ 'x-role': role })

describe('istanbulDayBounds', () => {
  it('K-bounds: UTC gece yarisindan sonra bile Istanbul gunu (UTC+3) kullanilir', () => {
    // 2026-10-29 22:30 UTC = 30 Ekim 01:30 Istanbul -> gun 30 Ekim
    const { start, end } = istanbulDayBounds(new Date('2026-10-29T22:30:00Z'))
    expect(start.toISOString()).toBe('2026-10-29T21:00:00.000Z')
    expect(end.toISOString()).toBe('2026-10-30T20:59:59.999Z')
  })
})

describe('trialStatus', () => {
  const now = new Date('2026-10-29T10:00:00Z')
  it('K-trial: deneme disi plan icin null', () => {
    expect(trialStatus('pro', new Date('2026-11-05T00:00:00Z'), now)).toBeNull()
  })
  it('K-trial: kalan gun yukari yuvarlanir, bitis tarihi ISO doner', () => {
    expect(trialStatus('trial', new Date('2026-11-05T09:00:00Z'), now)).toEqual({ endsAt: '2026-11-05T09:00:00.000Z', daysLeft: 7, expired: false })
  })
  it('K-trial: suresi dolmus deneme expired ve daysLeft 0', () => {
    expect(trialStatus('trial', new Date('2026-10-28T00:00:00Z'), now)).toEqual({ endsAt: '2026-10-28T00:00:00.000Z', daysLeft: 0, expired: true })
  })
  it('K-trial: bitis tarihi olmayan deneme null (tarih uydurulmaz)', () => {
    expect(trialStatus('trial', null, now)).toBeNull()
  })
})

describe('buildSetupSteps', () => {
  const full = {
    settings: { phone: '05321234567', address: 'Moda Cd. 5', workingHours: { monday: { start: '09:00', end: '19:00' }, sunday: null }, publicBookingEnabled: true },
    serviceCount: 2, staffCount: 1, appointmentCount: 3,
  }
  it('K-setup: hepsi tamamsa 6 adim ve yuzde 100', () => {
    const r = buildSetupSteps(full)
    expect(r.steps.map((s) => s.id)).toEqual(['salon', 'working-hours', 'services', 'staff', 'first-appointment', 'online-link'])
    expect(r).toMatchObject({ percent: 100, doneCount: 6, totalCount: 6 })
  })
  it('K-setup: bos salon 0 yuzde; telefon yalniz adres eksikse salon adimi tamam degil', () => {
    const empty = buildSetupSteps({ settings: {}, serviceCount: 0, staffCount: 0, appointmentCount: 0 })
    expect(empty).toMatchObject({ percent: 0, doneCount: 0 })
    const half = buildSetupSteps({ ...full, settings: { ...full.settings, address: '' } })
    expect(half.steps.find((s) => s.id === 'salon')!.done).toBe(false)
  })
  it('K-setup: calisma saati yalniz kapali gunlerden olusuyorsa tamam sayilmaz; metin bicimi tamam', () => {
    const closed = buildSetupSteps({ ...full, settings: { ...full.settings, workingHours: { monday: null } } })
    expect(closed.steps.find((s) => s.id === 'working-hours')!.done).toBe(false)
    const text = buildSetupSteps({ ...full, settings: { ...full.settings, workingHours: '09:00-19:00' } })
    expect(text.steps.find((s) => s.id === 'working-hours')!.done).toBe(true)
  })
  it('K-setup: online baglanti yalniz publicBookingEnabled === true iken tamam ("true" metni degil)', () => {
    const s = buildSetupSteps({ ...full, settings: { ...full.settings, publicBookingEnabled: 'true' } })
    expect(s.steps.find((x) => x.id === 'online-link')!.done).toBe(false)
  })
  it('K-setup: yuzde yuvarlanir (2/6 = 33)', () => {
    const r = buildSetupSteps({ settings: { phone: '1234567', address: 'adres 12' }, serviceCount: 1, staffCount: 0, appointmentCount: 0 })
    expect(r).toMatchObject({ doneCount: 2, percent: 33 })
  })
})

describe('GET /panel-summary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    dbMock.appointment.count.mockImplementation(async ({ where }: { where: { status?: string } }) => (where.status === 'pending' ? 3 : 7))
    dbMock.waitlist.count.mockResolvedValue(4)
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { grossAmount: 900, cashAmount: 600, cardAmount: 300 }, _count: { _all: 5 } })
    dbMock.tenant.findUnique.mockResolvedValue({
      plan: 'trial', trialEndsAt: new Date(Date.now() + 3 * 86400000 - 1000),
      settings: { phone: '05321234567', address: 'Moda Cd. 5', workingHours: '09:00-19:00', publicBookingEnabled: true },
    })
    dbMock.service.count.mockResolvedValue(2)
    dbMock.staffProfile.count.mockResolvedValue(1)
  })

  it('K-rol: sahip her blogu alir (sayaclar, deneme, kasa, kurulum)', async () => {
    const res = await request(app).get(URL).set(as('owner'))
    expect(res.status).toBe(200)
    expect(res.body.counters).toEqual({ pendingOnlineRequests: 3, waitingList: 4 })
    expect(res.body.trial).toMatchObject({ daysLeft: 3, expired: false })
    expect(res.body.cashToday).toEqual({ totalAmount: 900, cashAmount: 600, cardAmount: 300, count: 5 })
    expect(res.body.setup).toMatchObject({ percent: 100, totalCount: 6 })
  })

  it('K-rol: mudur deneme kutusunu gormez (yalniz sahip), kalan her sey tam', async () => {
    const res = await request(app).get(URL).set(as('manager'))
    expect(res.body.trial).toBeNull()
    expect(res.body.cashToday).not.toBeNull()
    expect(res.body.setup).not.toBeNull()
    expect(res.body.counters.waitingList).toBe(4)
  })

  it('K-rol: resepsiyon sayaclari ve bugunku kasayi alir; deneme ve kurulum yok', async () => {
    const res = await request(app).get(URL).set(as('receptionist'))
    expect(res.body.counters).toEqual({ pendingOnlineRequests: 3, waitingList: 4 })
    expect(res.body.cashToday).not.toBeNull()
    expect(res.body.trial).toBeNull()
    expect(res.body.setup).toBeNull()
    expect(dbMock.tenant.findUnique).not.toHaveBeenCalled()
  })

  it('K-rol: uzman hicbir sayac, kasa, deneme ya da kurulum goremez ve DB aggregate calismaz', async () => {
    const res = await request(app).get(URL).set(as('staff'))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ counters: { pendingOnlineRequests: null, waitingList: null }, trial: null, cashToday: null, setup: null })
    expect(dbMock.waitlist.count).not.toHaveBeenCalled()
    expect(dbMock.transaction.aggregate).not.toHaveBeenCalled()
    expect(dbMock.appointment.count).not.toHaveBeenCalled()
  })

  it('K-rol: bilinmeyen rol 403', async () => {
    const res = await request(app).get(URL).set(as('hacker'))
    expect(res.status).toBe(403)
  })

  it('K-tenant: her sorgu tenantId ile sinirlidir; talep sayaci yalniz bekleyen web randevusu', async () => {
    await request(app).get(URL).set(as('owner'))
    const wheres = [
      ...dbMock.appointment.count.mock.calls, ...dbMock.waitlist.count.mock.calls, ...dbMock.transaction.aggregate.mock.calls,
      ...dbMock.service.count.mock.calls, ...dbMock.staffProfile.count.mock.calls,
    ].map((c) => c[0].where)
    expect(wheres.length).toBeGreaterThanOrEqual(6)
    for (const w of wheres) expect(w.tenantId).toBe('t1')
    expect(dbMock.tenant.findUnique.mock.calls[0][0].where).toEqual({ id: 't1' })
    const pending = dbMock.appointment.count.mock.calls.map((c) => c[0].where).find((w) => w.status === 'pending')
    expect(pending).toMatchObject({ bookingChannel: 'web', status: 'pending', isDeleted: false })
    expect(dbMock.waitlist.count.mock.calls[0][0].where.status).toBe('waiting')
  })

  it('K-kasa: bugunku kasa yalniz tamamlanmis islemler ve Istanbul gun araligi', async () => {
    await request(app).get(URL).set(as('receptionist'))
    const w = dbMock.transaction.aggregate.mock.calls[0][0].where
    expect(w.status).toBe('completed')
    expect(w.completedAt.gte).toBeInstanceOf(Date)
    expect(w.completedAt.lte.getTime() - w.completedAt.gte.getTime()).toBe(86400000 - 1)
  })

  it('K-kasa: islem yoksa toplamlar 0 ve sayi 0 (null toplam sifira cevrilir)', async () => {
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { grossAmount: null, cashAmount: null, cardAmount: null }, _count: { _all: 0 } })
    const res = await request(app).get(URL).set(as('owner'))
    expect(res.body.cashToday).toEqual({ totalAmount: 0, cashAmount: 0, cardAmount: 0, count: 0 })
  })
})
