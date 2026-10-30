import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// A2 bolum 2 (R3, R4, tips/summary): veritabani ve Redis gerektirmez; db, kuyruk ve kimlik katmani sahtelenir.
// Gercek PG ile ayni davranislar staff-restrictions-db.test.ts'te (test-muhendisi kosusu).
const dbMock = vi.hoisted(() => ({
  staffProfile: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  customer: { findMany: vi.fn() },
  appointment: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  transaction: { create: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  cashDayClosure: { findUnique: vi.fn(), upsert: vi.fn() },
  tipEntry: { aggregate: vi.fn(), groupBy: vi.fn() },
  tipDistribution: { groupBy: vi.fn() },
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
import { createTipsRouter } from '../routes/tips.route'
import { maskPhone, escapeLike } from '../lib/customer-privacy'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/tenants/:slug', createTipsRouter())
  app.use('/api/v1/tenants/:slug', createTenantRouter())
  return app
}
const app = makeApp()
const as = (role: string) => ({ 'x-role': role })
const URL = '/api/v1/tenants/salon'

beforeEach(() => {
  vi.resetAllMocks()
  dbMock.staffProfile.findFirst.mockResolvedValue({ id: 'sp-me' })
})

describe('R4: maskPhone', () => {
  it('K-R4: 0532 *** ** 67 bicimi (yerel, +90 ve bosluklu girdiler ayni sonucu verir)', () => {
    expect(maskPhone('05321234567')).toBe('0532 *** ** 67')
    expect(maskPhone('+905321234567')).toBe('0532 *** ** 67')
    expect(maskPhone('0532 123 45 67')).toBe('0532 *** ** 67')
  })
  it('K-R4: cok kisa ya da bos deger numara sizdirmaz', () => {
    expect(maskPhone('12345')).toBe('***')
    expect(maskPhone('')).toBe('***')
  })
})

describe('R4: uzman musteri aramasi', () => {
  const row = (id: string, name: string, phone: string) => ({
    id, fullName: name, phone, email: `${id}@x.test`, totalVisits: 3, lastVisitAt: null, createdAt: new Date('2026-01-01'),
  })

  it('K-R4: aramasiz liste uzmana kapali (400 SEARCH_REQUIRED) ve DB sorgulanmaz', async () => {
    const res = await request(app).get(`${URL}/customers`).set(as('staff'))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('SEARCH_REQUIRED')
    expect(dbMock.customer.findMany).not.toHaveBeenCalled()
  })

  it('K-R4: 2 karakterlik arama uzmanda reddedilir (3 alti), 3 karakter kabul', async () => {
    const short = await request(app).get(`${URL}/customers?search=ay`).set(as('staff'))
    expect(short.status).toBe(400)
    expect(short.body.error.code).toBe('SEARCH_REQUIRED')
    dbMock.customer.findMany.mockResolvedValue([])
    const ok = await request(app).get(`${URL}/customers?search=ayse`).set(as('staff'))
    expect(ok.status).toBe(200)
  })

  it('K-R4: bosluklarla 3 karaktere tamamlanan arama sayilmaz', async () => {
    const res = await request(app).get(`${URL}/customers?search=${encodeURIComponent('a  ')}`).set(as('staff'))
    expect(res.status).toBe(400)
  })

  it('K-R4: en cok 10 sonuc istenir (take 10) ve nextCursor null', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    const res = await request(app).get(`${URL}/customers?search=ayse&limit=200&cursor=00000000-0000-4000-8000-000000000001`).set(as('staff'))
    expect(res.status).toBe(200)
    expect(res.body.nextCursor).toBeNull()
    const arg = dbMock.customer.findMany.mock.calls[0][0]
    expect(arg.take).toBe(10)
    expect(arg.cursor).toBeUndefined()
  })

  it('K-R4: kendi musterisinde telefon acik, digerinde maskeli; digerinin e-posta ve ziyaret bilgisi donmez', async () => {
    dbMock.customer.findMany
      .mockResolvedValueOnce([row('c-own', 'Ayse Own', '+905321234567'), row('c-other', 'Ayse Other', '+905559876543')])
      .mockResolvedValueOnce([{ id: 'c-own' }])
    const res = await request(app).get(`${URL}/customers?search=ayse`).set(as('staff'))
    expect(res.status).toBe(200)
    const own = res.body.data.find((c: { id: string }) => c.id === 'c-own')
    const other = res.body.data.find((c: { id: string }) => c.id === 'c-other')
    expect(own).toMatchObject({ phone: '+905321234567', phoneMasked: false, isOwn: true, email: 'c-own@x.test' })
    expect(other).toMatchObject({ phone: '0555 *** ** 43', phoneMasked: true, isOwn: false, email: null, totalVisits: null })
    expect(JSON.stringify(other)).not.toContain('9876543')
  })

  it('K-R4: telefon aramasi yalniz kendi musterilerinde calisir (rakam sorgulayarak numara cikarimi yok)', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    await request(app).get(`${URL}/customers?search=0555`).set(as('staff'))
    const where = dbMock.customer.findMany.mock.calls[0][0].where
    const phoneClauses = JSON.stringify(where).match(/"phone"/g) ?? []
    expect(phoneClauses).toHaveLength(1)
    const phoneBranch = where.OR.find((b: Record<string, unknown>) => JSON.stringify(b).includes('"phone"'))
    expect(JSON.stringify(phoneBranch)).toContain('"appointments"')
    expect(JSON.stringify(phoneBranch)).toContain('sp-me')
  })

  it('K-R4: LIKE jokerleri kacislanir: ___ ve %%% aramasi tum musterileri eslestiremez', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    for (const wildcard of ['___', '%%%', 'a_c']) {
      await request(app).get(`${URL}/customers?search=${encodeURIComponent(wildcard)}`).set(as('staff'))
    }
    const sent = dbMock.customer.findMany.mock.calls.map((c) => c[0].where.OR[0].fullName.contains)
    expect(sent).toEqual(['\\_\\_\\_', '\\%\\%\\%', 'a\\_c'])
    const phoneSent = dbMock.customer.findMany.mock.calls[0][0].where.OR[1].AND[1].phone.contains
    expect(phoneSent).toBe('\\_\\_\\_')
  })

  it('K-R4: escapeLike ters egik cizgiyi de kacislar (kacis dizisi enjekte edilemez)', () => {
    expect(escapeLike('a\\b%c_d')).toBe('a\\\\b\\%c\\_d')
    expect(escapeLike('Ayse')).toBe('Ayse')
  })

  it('K-R4: profili olmayan uzman bos sonuc alir', async () => {
    dbMock.staffProfile.findFirst.mockResolvedValue(null)
    const res = await request(app).get(`${URL}/customers?search=ayse`).set(as('staff'))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('K-R4: sahip, mudur ve resepsiyon telefonu maskesiz alir, 2 karakter aramayla ve limit 200 ile calisir', async () => {
    for (const role of ['owner', 'manager', 'receptionist']) {
      dbMock.customer.findMany.mockResolvedValue([row('c1', 'Ali', '+905321234567')])
      const res = await request(app).get(`${URL}/customers?search=al&limit=200`).set(as(role))
      expect(res.status, role).toBe(200)
      expect(res.body.data[0].phone, role).toBe('+905321234567')
      expect(dbMock.customer.findMany.mock.calls.at(-1)![0].take).toBe(201)
    }
  })
})

describe('W13-2: telefon aramasi normalize biciminde saklanan kaydi bulur', () => {
  const phoneContains = (call: unknown[]) => {
    const where = (call[0] as { where: { OR: Array<Record<string, any>> } }).where
    const branch = where.OR.find((b) => JSON.stringify(b).includes('"phone"'))!
    return (branch.phone ?? branch.AND[1].phone).contains as string
  }

  it('K-W13-2: 0532..., 532..., +90532... ve bosluklu/tireli yazimlar ayni ulusal numara desenini arar (saklanan +90 bicimi bulunur)', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    for (const term of ['0532 123', '532123', '+90532123', '0(532)-123', '90532123']) {
      dbMock.customer.findMany.mockClear()
      await request(app).get(`${URL}/customers?search=${encodeURIComponent(term)}`).set(as('owner'))
      expect(phoneContains(dbMock.customer.findMany.mock.calls[0]), term).toBe('532123')
    }
  })

  it('K-W13-2: telefon gibi olmayan terim aynen (jokerleri kacislanmis) aranir; kisa rakam terimi (2 hane) normalize edilmez', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    await request(app).get(`${URL}/customers?search=${encodeURIComponent('a_c')}`).set(as('owner'))
    expect(phoneContains(dbMock.customer.findMany.mock.calls[0])).toBe('a\\_c')
    dbMock.customer.findMany.mockClear()
    await request(app).get(`${URL}/customers?search=05`).set(as('owner'))
    expect(phoneContains(dbMock.customer.findMany.mock.calls[0])).toBe('05')
  })

  it('K-W13-2: uzman aramasi da normalize eder ve telefon dali yine yalniz kendi musterileriyle sinirli kalir (R4)', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    await request(app).get(`${URL}/customers?search=0555123`).set(as('staff'))
    const where = dbMock.customer.findMany.mock.calls[0][0].where
    expect(phoneContains(dbMock.customer.findMany.mock.calls[0])).toBe('555123')
    const phoneBranch = where.OR.find((b: Record<string, unknown>) => JSON.stringify(b).includes('"phone"'))
    expect(JSON.stringify(phoneBranch)).toContain('sp-me')
    expect(JSON.stringify(where).match(/"phone"/g)).toHaveLength(1)
  })
})

describe('W13-API-1: arama terimi siniri ve karisik terim', () => {
  it('K-W13-2: harf+rakam karisik terim (ab532) telefon gibi sayilmaz, aynen aranir; yonetici adinda joker kacislanir', async () => {
    dbMock.customer.findMany.mockResolvedValue([])
    await request(app).get(`${URL}/customers?search=ab532`).set(as('owner'))
    const where = dbMock.customer.findMany.mock.calls[0][0].where
    expect(where.OR[1].phone.contains).toBe('ab532')
    dbMock.customer.findMany.mockClear()
    await request(app).get(`${URL}/customers?search=a_c`).set(as('owner'))
    expect(dbMock.customer.findMany.mock.calls[0][0].where.OR[0].fullName.contains).toBe('a\\_c')
  })

  it('K-W13-2: 100 karakteri asan arama terimi 400 VALIDATION_ERROR (sorgu atilmaz)', async () => {
    const res = await request(app).get(`${URL}/customers?search=${'a'.repeat(101)}`).set(as('owner'))
    expect(res.status).toBe(400)
    expect(dbMock.customer.findMany).not.toHaveBeenCalled()
  })
})

describe('R3: uzman fiyati degistiremez', () => {
  // A6: tamamlama tek islemde ($transaction) ve kosullu updateMany ile; sahte tx dbMock'un kendisidir.
  function completionMocks() {
    dbMock.$transaction.mockImplementation(async (fn: (t: typeof dbMock) => unknown) => fn(dbMock))
    dbMock.cashDayClosure.findUnique.mockResolvedValue(null)
    dbMock.$queryRaw.mockResolvedValue([])
    dbMock.appointment.updateMany.mockResolvedValue({ count: 1 })
    dbMock.appointment.update.mockResolvedValue({})
    dbMock.transaction.create.mockResolvedValue({ id: 'tx1', completedAt: new Date() })
  }
  function setupCompletion() {
    dbMock.appointment.findFirst
      .mockResolvedValueOnce({ id: 'a1', status: 'confirmed', staffId: 'sp-me', customerId: 'c1' })
      .mockResolvedValueOnce({
        id: 'a1', staffId: 'sp-me', priceCharged: 500, customerId: 'c1',
        service: { commissionRate: 0.1, followUpSchedule: null }, customer: null, tenant: { settings: {}, telegramBotToken: null },
      })
    completionMocks()
  }

  it('K-R3: uzman priceCharged gonderse bile islem tutari randevu fiyatidir (yok sayilir)', async () => {
    setupCompletion()
    const res = await request(app).patch(`${URL}/appointments/a1/status`).set(as('staff')).send({ status: 'completed', priceCharged: 1 })
    expect(res.status).toBe(200)
    expect(String(dbMock.transaction.create.mock.calls[0][0].data.grossAmount)).toBe('500')
    // randevu fiyati da degismez: fiyat guncellemesi hic yapilmaz
    expect(dbMock.appointment.update).not.toHaveBeenCalled()
  })

  it('K-R3: uzman odeme yontemini secebilir (yalniz fiyat kilitli)', async () => {
    setupCompletion()
    await request(app).patch(`${URL}/appointments/a1/status`).set(as('staff')).send({ status: 'completed', priceCharged: 1, paymentMethod: 'card' })
    const data = dbMock.transaction.create.mock.calls[0][0].data
    expect(data.paymentMethod).toBe('card')
    expect(String(data.cardAmount)).toBe('500')
    expect(data.cashAmount).toBe(0)
  })

  it.each(['owner', 'manager', 'receptionist'])('K-R3: %s priceCharged ile tutari degistirebilir', async (role) => {
    dbMock.appointment.findFirst
      .mockResolvedValueOnce({ id: 'a1', status: 'confirmed', staffId: 'sp-other', customerId: 'c1' })
      .mockResolvedValueOnce({
        id: 'a1', staffId: 'sp-other', priceCharged: 500, customerId: 'c1',
        service: { commissionRate: 0.1, followUpSchedule: null }, customer: null, tenant: { settings: {}, telegramBotToken: null },
      })
    completionMocks()
    const res = await request(app).patch(`${URL}/appointments/a1/status`).set(as(role)).send({ status: 'completed', priceCharged: 450 })
    expect(res.status).toBe(200)
    expect(String(dbMock.transaction.create.mock.calls[0][0].data.grossAmount)).toBe('450')
  })
})

describe('tips/summary: uzman yalniz kendi ozetini gorur', () => {
  function setupSummary() {
    dbMock.tipEntry.aggregate.mockResolvedValue({ _sum: { amount: 40 }, _count: { _all: 2 } })
    dbMock.tipEntry.groupBy.mockResolvedValue([{ staffId: 'sp-me', _sum: { amount: 40 } }])
    dbMock.tipDistribution.groupBy.mockResolvedValue([])
    dbMock.staffProfile.count.mockResolvedValue(4)
    dbMock.staffProfile.findMany.mockResolvedValue([{ id: 'sp-me', user: { fullName: 'Ben' } }])
  }
  const whereOf = (fn: { mock: { calls: unknown[][] } }, i = 0) => (fn.mock.calls[i][0] as { where: Record<string, unknown> }).where

  it('K-tips: uzmanin tum tip sorgulari kendi staffId ile sinirlanir', async () => {
    setupSummary()
    const res = await request(app).get(`${URL}/tips/summary`).set(as('staff'))
    expect(res.status).toBe(200)
    expect(whereOf(dbMock.tipEntry.aggregate, 0).staffId).toBe('sp-me')
    expect(whereOf(dbMock.tipEntry.groupBy).staffId).toBe('sp-me')
    expect(whereOf(dbMock.tipDistribution.groupBy).staffId).toBe('sp-me')
  })

  it('K-tips: uzman yanitinda havuz (dagitilmamis) ve salon ortalamasi yok; perStaff yalniz kendisi', async () => {
    setupSummary()
    const res = await request(app).get(`${URL}/tips/summary`).set(as('staff'))
    expect(res.body.totalAmount).toBe(40)
    expect(res.body.undistributedTotal).toBe(0)
    expect(res.body.undistributedCount).toBe(0)
    expect(res.body.staffCount).toBe(1)
    expect(res.body.perStaff.map((p: { staffId: string }) => p.staffId)).toEqual(['sp-me'])
    expect(dbMock.staffProfile.count).not.toHaveBeenCalled()
  })

  it('K-tips: uzman baska personelin ozetini staffId parametresiyle isteyemez (parametre yok sayilir)', async () => {
    setupSummary()
    await request(app).get(`${URL}/tips/summary?staffId=sp-other`).set(as('staff'))
    expect(whereOf(dbMock.tipEntry.aggregate, 0).staffId).toBe('sp-me')
  })

  it('K-tips: profili olmayan uzman 403 alir', async () => {
    dbMock.staffProfile.findFirst.mockResolvedValue(null)
    const res = await request(app).get(`${URL}/tips/summary`).set(as('staff'))
    expect(res.status).toBe(403)
  })

  it('K-tips: resepsiyon 403; sahip ve mudur tum ozeti (kiracı filtreli, staffId filtresiz) gorur', async () => {
    const rec = await request(app).get(`${URL}/tips/summary`).set(as('receptionist'))
    expect(rec.status).toBe(403)
    for (const role of ['owner', 'manager']) {
      setupSummary()
      dbMock.tipEntry.aggregate.mockClear()
      const res = await request(app).get(`${URL}/tips/summary`).set(as(role))
      expect(res.status, role).toBe(200)
      expect(whereOf(dbMock.tipEntry.aggregate, 0)).not.toHaveProperty('staffId')
      expect(res.body.staffCount).toBe(4)
    }
  })
})
