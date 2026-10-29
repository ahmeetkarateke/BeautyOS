import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { db } from '../lib/db'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestManager,
  createTestStaff,
  createTestService,
  createTestCustomer,
  cleanupTenant,
} from './helpers/setup'

const app = createApp({ rateLimitMax: 1000 })

// S1: rol x uc tablosu. Her satir icin izinli roller 200/2xx (ya da dogrulama hatasi, yani
// yetki kapisini gecti), izinsiz rol 403 alir. Izinsiz rol testlerinde govde GECERLIDIR;
// 403 yalniz rol yuzunden gelir.
type Row = { name: string; method: 'get' | 'post'; path: string; body?: object; deniedForStaff: boolean }

const ROWS: Row[] = [
  { name: 'K1 POST finance/close-day', method: 'post', path: '/finance/close-day', deniedForStaff: true },
  { name: 'K1 GET reports/daily', method: 'get', path: '/reports/daily', deniedForStaff: true },
  { name: 'K1 GET reports/staff-commissions', method: 'get', path: '/reports/staff-commissions', deniedForStaff: true },
  {
    name: 'K1 POST revenues',
    method: 'post',
    path: '/revenues',
    body: { description: 'Test geliri', amount: 100, paymentMethod: 'cash', revenueDate: '2026-01-15' },
    deniedForStaff: true,
  },
  { name: 'K3 GET accounts', method: 'get', path: '/accounts', deniedForStaff: true },
  { name: 'K3 GET current-accounts', method: 'get', path: '/current-accounts', deniedForStaff: true },
  { name: 'K3 GET purchase-invoices', method: 'get', path: '/purchase-invoices', deniedForStaff: true },
  { name: 'K3 GET suppliers', method: 'get', path: '/suppliers', deniedForStaff: true },
]

describe('S1 rol x uc yetki tablosu', () => {
  const suffix = uniqueSuffix()
  let slug: string
  let tenantId: string
  const tokens = {} as Record<'owner' | 'manager' | 'staff', string>

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    slug = tenant.slug
    tokens.owner = (await createTestOwner(tenantId, slug, suffix)).token
    tokens.manager = (await createTestManager(tenantId, slug, suffix)).token
    tokens.staff = (await createTestStaff(tenantId, slug, suffix)).token
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
  })

  const call = (row: Row, token: string) => {
    const req = request(app)[row.method](`/api/v1/tenants/${slug}${row.path}`).set('Authorization', `Bearer ${token}`)
    return row.body ? req.send(row.body) : req
  }

  for (const row of ROWS) {
    it(`${row.name}: staff 403 FORBIDDEN`, async () => {
      const res = await call(row, tokens.staff)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    for (const role of ['owner', 'manager'] as const) {
      it(`${row.name}: ${role} yetki kapisini gecer`, async () => {
        const res = await call(row, tokens[role])
        expect(res.status).not.toBe(403)
        expect(res.status).toBeLessThan(500)
      })
    }

    it(`${row.name}: tokensiz istek 401`, async () => {
      const res = await request(app)[row.method](`/api/v1/tenants/${slug}${row.path}`)
      expect(res.status).toBe(401)
    })
  }

  it('K1 staff gelir kaydi: 403 donen istek hicbir islem satiri olusturmaz', async () => {
    const before = await db.transaction.count({ where: { tenantId } })
    await call(ROWS[3], tokens.staff)
    expect(await db.transaction.count({ where: { tenantId } })).toBe(before)
  })

  it('K1 owner gelir kaydi gercekten olusur (staff testinin tesadufen gecmedigini kanitlar)', async () => {
    const before = await db.transaction.count({ where: { tenantId } })
    const res = await call(ROWS[3], tokens.owner)
    expect(res.status).toBeLessThan(300)
    expect(await db.transaction.count({ where: { tenantId } })).toBe(before + 1)
  })

  it('bilinmeyen rol iddia eden gecerli imzali token 401 alir', async () => {
    const forged = jwt.sign({ userId: 'x', tenantId, tenantSlug: slug, role: 'admin' }, process.env.JWT_SECRET ?? 'dev-secret', { expiresIn: '1h' })
    const res = await request(app).get(`/api/v1/tenants/${slug}/dashboard`).set('Authorization', `Bearer ${forged}`)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('K2 dashboard: staff yanitinda ciro alanlari yok, owner ve manager icin var', async () => {
    const staff = await request(app).get(`/api/v1/tenants/${slug}/dashboard`).set('Authorization', `Bearer ${tokens.staff}`)
    expect(staff.status).toBe(200)
    expect(staff.body).not.toHaveProperty('todayRevenue')
    expect(staff.body).not.toHaveProperty('revenueChange')
    expect(staff.body).toHaveProperty('todayAppointmentCount')

    for (const role of ['owner', 'manager'] as const) {
      const res = await request(app).get(`/api/v1/tenants/${slug}/dashboard`).set('Authorization', `Bearer ${tokens[role]}`)
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('todayRevenue')
      expect(res.body).toHaveProperty('revenueChange')
    }
  })
})

describe('S1 uzman yalniz kendi musterilerini gorur (K4)', () => {
  const suffix = uniqueSuffix()
  const otherSuffix = `${uniqueSuffix()}b`
  let slug: string
  let tenantId: string
  let otherTenantId: string
  let ownerToken: string
  let staffAToken: string
  let staffBToken: string
  let ownCustomerId: string
  let otherStaffCustomerId: string
  let noAppointmentCustomerId: string
  let foreignTenantCustomerId: string
  let ownPhotoId: string
  let otherPhotoId: string
  let questionId: string
  let serviceId: string
  let staffAProfileId: string
  let staffBProfileId: string

  async function appointment(staffId: string, customerId: string, serviceId: string, startAt: Date, status: 'confirmed' | 'cancelled' | 'completed' | 'no_show' = 'confirmed') {
    return db.appointment.create({
      data: {
        tenantId,
        customerId,
        staffId,
        serviceId,
        referenceCode: `S1-${uniqueSuffix()}`,
        status,
        startAt,
        endAt: new Date(startAt.getTime() + 60 * 60 * 1000),
        priceCharged: 150,
      },
    })
  }

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    slug = tenant.slug
    ownerToken = (await createTestOwner(tenantId, slug, suffix)).token
    const staffA = await createTestStaff(tenantId, slug, `${suffix}a`)
    const staffB = await createTestStaff(tenantId, slug, `${suffix}c`)
    staffAToken = staffA.token
    staffBToken = staffB.token
    const service = await createTestService(tenantId, suffix)
    serviceId = service.id
    staffAProfileId = staffA.profile.id
    staffBProfileId = staffB.profile.id

    const own = await createTestCustomer(tenantId, '+905550000101', `${suffix}-own`)
    const other = await createTestCustomer(tenantId, '+905550000102', `${suffix}-other`)
    const none = await createTestCustomer(tenantId, '+905550000103', `${suffix}-none`)
    ownCustomerId = own.id
    otherStaffCustomerId = other.id
    noAppointmentCustomerId = none.id
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    await appointment(staffA.profile.id, own.id, service.id, future)
    await appointment(staffB.profile.id, other.id, service.id, future)

    // Baska kiracida B'nin verisi: izolasyon kontrolu
    const otherTenant = await createTestTenant(otherSuffix)
    otherTenantId = otherTenant.id
    const foreign = await createTestCustomer(otherTenantId, '+905550000104', `${otherSuffix}-foreign`)
    foreignTenantCustomerId = foreign.id

    const q = await db.anamnesisQuestion.create({
      data: { tenantId, label: 'Alerji var mi?', type: 'yes_no', isRequired: false, order: 1, isActive: true },
    })
    questionId = q.id
    ownPhotoId = (await db.customerPhoto.create({ data: { tenantId, customerId: own.id, url: 'https://example.com/a.jpg' } })).id
    otherPhotoId = (await db.customerPhoto.create({ data: { tenantId, customerId: other.id, url: 'https://example.com/b.jpg' } })).id
  })

  afterAll(async () => {
    await cleanupTenant(tenantId)
    await cleanupTenant(otherTenantId)
  })

  const get = (path: string, token: string) =>
    request(app).get(`/api/v1/tenants/${slug}${path}`).set('Authorization', `Bearer ${token}`)

  it('K4 liste: staff A yalniz kendi musterisini gorur', async () => {
    const res = await get('/customers', staffAToken)
    expect(res.status).toBe(200)
    const ids = res.body.data.map((c: { id: string }) => c.id)
    expect(ids).toEqual([ownCustomerId])
  })

  it('K4 liste: owner uc musteriyi de gorur (kapsami daraltan filtre owner icin devrede degil)', async () => {
    const res = await get('/customers', ownerToken)
    const ids = res.body.data.map((c: { id: string }) => c.id)
    expect(ids).toEqual(expect.arrayContaining([ownCustomerId, otherStaffCustomerId, noAppointmentCustomerId]))
    expect(ids).not.toContain(foreignTenantCustomerId)
  })

  it('K4 liste: staff aramasi da kapsamla sinirli (baska uzmanin musterisi aramayla gelmez)', async () => {
    const res = await get('/customers?search=Müşteri', staffAToken)
    expect(res.status).toBe(200)
    const ids = res.body.data.map((c: { id: string }) => c.id)
    expect(ids).not.toContain(otherStaffCustomerId)
  })

  it('K4 ayrinti: kendi musterisi 200, baska uzmanin, randevusuz ve baska kiracinin musterisi 404', async () => {
    expect((await get(`/customers/${ownCustomerId}`, staffAToken)).status).toBe(200)
    for (const id of [otherStaffCustomerId, noAppointmentCustomerId, foreignTenantCustomerId]) {
      const res = await get(`/customers/${id}`, staffAToken)
      expect(res.status).toBe(404)
    }
  })

  it('K4 ayrinti: owner baska uzmanin musterisini gorur', async () => {
    expect((await get(`/customers/${otherStaffCustomerId}`, ownerToken)).status).toBe(200)
  })

  it('K4 iptal edilmis randevu musteriyi "kendi musterisi" yapmaz', async () => {
    const t = await db.appointment.findFirstOrThrow({ where: { tenantId, customerId: ownCustomerId }, select: { staffId: true, serviceId: true } })
    const cancelledOnly = await createTestCustomer(tenantId, '+905550000105', `${suffix}-canc`)
    await appointment(t.staffId, cancelledOnly.id, t.serviceId, new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 'cancelled')
    expect((await get(`/customers/${cancelledOnly.id}`, staffAToken)).status).toBe(404)
  })

  it('K4 anamnez: kendi musterisinde okur ve yazar, baska musteride 404', async () => {
    expect((await get(`/customers/${ownCustomerId}/anamnesis`, staffAToken)).status).toBe(200)
    expect((await get(`/customers/${otherStaffCustomerId}/anamnesis`, staffAToken)).status).toBe(404)

    const put = (customerId: string) =>
      request(app)
        .put(`/api/v1/tenants/${slug}/customers/${customerId}/anamnesis`)
        .set('Authorization', `Bearer ${staffAToken}`)
        .send({ answers: [{ questionId, value: true }] })
    expect((await put(ownCustomerId)).status).toBe(204)
    expect((await put(otherStaffCustomerId)).status).toBe(404)
    expect(await db.customerAnamnesisAnswer.count({ where: { tenantId, customerId: otherStaffCustomerId } })).toBe(0)
  })

  it('K4 anamnez: owner herkesinkine erisir', async () => {
    expect((await get(`/customers/${otherStaffCustomerId}/anamnesis`, ownerToken)).status).toBe(200)
  })

  it('K4 fotograf: kendi musterisinde listeler, baska musteride 404', async () => {
    const own = await get(`/customers/${ownCustomerId}/photos`, staffAToken)
    expect(own.status).toBe(200)
    expect(own.body).toHaveLength(1)
    expect((await get(`/customers/${otherStaffCustomerId}/photos`, staffAToken)).status).toBe(404)
  })

  it('K4 fotograf ekleme ve silme: baska uzmanin musterisinde 404, kayit degismez', async () => {
    const post = await request(app)
      .post(`/api/v1/tenants/${slug}/customers/${otherStaffCustomerId}/photos`)
      .set('Authorization', `Bearer ${staffAToken}`)
      .send({ url: 'https://example.com/c.jpg' })
    expect(post.status).toBe(404)

    const del = await request(app)
      .delete(`/api/v1/tenants/${slug}/photos/${otherPhotoId}`)
      .set('Authorization', `Bearer ${staffAToken}`)
    expect(del.status).toBe(404)
    expect(await db.customerPhoto.count({ where: { id: otherPhotoId } })).toBe(1)

    const delOwn = await request(app)
      .delete(`/api/v1/tenants/${slug}/photos/${ownPhotoId}`)
      .set('Authorization', `Bearer ${staffAToken}`)
    expect(delOwn.status).toBe(204)
  })

  it('K4 staff B, A uzmaninin musterisine erisemez (iki yonlu)', async () => {
    expect((await get(`/customers/${ownCustomerId}`, staffBToken)).status).toBe(404)
    expect((await get(`/customers/${otherStaffCustomerId}`, staffBToken)).status).toBe(200)
  })

  // ─── S1 tur 2: ayni siniftaki sizintilar ────────────────────────────────────

  const patch = (customerId: string, token: string, body: object) =>
    request(app).patch(`/api/v1/tenants/${slug}/customers/${customerId}`).set('Authorization', `Bearer ${token}`).send(body)

  it('matris 15: staff PATCH {} baska uzmanin musterisinde 403', async () => {
    const res = await patch(otherStaffCustomerId, staffAToken, {})
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('matris 15: staff PATCH allergyNotes 403 ve kayit degismez (kendi musterisi de dahil)', async () => {
    for (const id of [otherStaffCustomerId, ownCustomerId]) {
      const before = await db.customer.findUniqueOrThrow({ where: { id }, select: { allergyNotes: true, phone: true } })
      const res = await patch(id, staffAToken, { allergyNotes: 'DEGISTI', phone: '+905559999999' })
      expect(res.status).toBe(403)
      const after = await db.customer.findUniqueOrThrow({ where: { id }, select: { allergyNotes: true, phone: true } })
      expect(after).toEqual(before)
    }
  })

  it('matris 15: owner PATCH 200 ve kayit gercekten degisir (staff testinin tesadufen gecmedigini kanitlar)', async () => {
    const res = await patch(otherStaffCustomerId, ownerToken, { allergyNotes: 'Lateks alerjisi' })
    expect(res.status).toBe(200)
    expect((await db.customer.findUniqueOrThrow({ where: { id: otherStaffCustomerId } })).allergyNotes).toBe('Lateks alerjisi')
  })

  it('matris 15: owner baska kiracinin musterisini PATCH edemez (404) ve kayit degismez', async () => {
    const res = await patch(foreignTenantCustomerId, ownerToken, { allergyNotes: 'SIZINTI' })
    expect(res.status).toBe(404)
    expect((await db.customer.findUniqueOrThrow({ where: { id: foreignTenantCustomerId } })).allergyNotes).not.toBe('SIZINTI')
  })

  it('matris 11: staff GET /waitlist 403; owner veriyi gorur (veri gercekten var)', async () => {
    const entry = await db.waitlist.create({ data: { tenantId, customerId: otherStaffCustomerId } })
    const staffRes = await get('/waitlist', staffAToken)
    expect(staffRes.status).toBe(403)
    expect(JSON.stringify(staffRes.body)).not.toContain('+905550000102')

    const ownerRes = await get('/waitlist', ownerToken)
    expect(ownerRes.status).toBe(200)
    expect(ownerRes.body.data.map((e: { id: string }) => e.id)).toContain(entry.id)
  })

  it('S1b: staff bekleme listesine yazamaz (POST, PATCH, DELETE, notify, book, expire 403) ve kayit degismez; notify yanitinda telefon yok', async () => {
    const entry = await db.waitlist.create({ data: { tenantId, customerId: otherStaffCustomerId } })
    const countBefore = await db.waitlist.count({ where: { tenantId, customerId: otherStaffCustomerId } })
    const base = `/api/v1/tenants/${slug}/waitlist`
    const auth = { Authorization: `Bearer ${staffAToken}` }
    const calls = [
      request(app).post(base).set(auth).send({ customerId: otherStaffCustomerId }),
      request(app).patch(`${base}/${entry.id}`).set(auth).send({ notes: 'DEGISTI' }),
      request(app).delete(`${base}/${entry.id}`).set(auth),
      request(app).post(`${base}/${entry.id}/notify`).set(auth).send({}),
      request(app).post(`${base}/${entry.id}/book`).set(auth).send({ appointmentId: entry.id }),
      request(app).post(`${base}/${entry.id}/expire`).set(auth).send({}),
    ]
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(403)
      expect(JSON.stringify(res.body)).not.toContain('+905550000102')
    }
    const after = await db.waitlist.findUniqueOrThrow({ where: { id: entry.id } })
    expect(after.status).toBe('waiting')
    expect(after.notes).toBeNull()
    expect(after.notifiedAt).toBeNull()
    expect(await db.waitlist.count({ where: { tenantId, customerId: otherStaffCustomerId } })).toBe(countBefore)
  })

  it('S1b: owner bekleme listesine yazabilir (staff testinin tesadufen gecmedigini kanitlar)', async () => {
    const res = await request(app)
      .post(`/api/v1/tenants/${slug}/waitlist`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId: otherStaffCustomerId })
    expect(res.status).toBeLessThan(300)
  })

  describe('musteri paketleri (K4 kapsami)', () => {
    let ownCpId: string
    let otherCpId: string

    beforeAll(async () => {
      const pkg = await db.servicePackage.create({
        data: { tenantId, serviceId, name: 'Test Paket', totalSessions: 5, price: 500 },
      })
      const mk = (customerId: string) =>
        db.customerPackage.create({
          data: { tenantId, customerId, packageId: pkg.id, totalSessions: 5, remainingSessions: 5, pricePaid: 500 },
        })
      ownCpId = (await mk(ownCustomerId)).id
      otherCpId = (await mk(otherStaffCustomerId)).id
    })

    it('GET /customer-packages: staff A yalniz kendi musterisinin paketini gorur, owner ikisini de', async () => {
      const staff = await get('/customer-packages', staffAToken)
      expect(staff.status).toBe(200)
      expect(staff.body.data.map((p: { id: string }) => p.id)).toEqual([ownCpId])
      expect(JSON.stringify(staff.body)).not.toContain('+905550000102')

      const owner = await get('/customer-packages', ownerToken)
      expect(owner.body.data.map((p: { id: string }) => p.id)).toEqual(expect.arrayContaining([ownCpId, otherCpId]))
    })

    it('GET /customer-packages?customerId=<baska uzmanin musterisi>: staff bos liste alir', async () => {
      const res = await get(`/customer-packages?customerId=${otherStaffCustomerId}`, staffAToken)
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })

    it('GET usages: baska uzmanin musteri paketi 404, kendi musterisininki 200', async () => {
      expect((await get(`/customer-packages/${otherCpId}/usages`, staffAToken)).status).toBe(404)
      expect((await get(`/customer-packages/${ownCpId}/usages`, staffAToken)).status).toBe(200)
    })

    it('POST use: staff baska uzmanin musteri paketini kullanamaz (404) ve seans sayisi degismez', async () => {
      const post = (id: string) =>
        request(app).post(`/api/v1/tenants/${slug}/customer-packages/${id}/use`).set('Authorization', `Bearer ${staffAToken}`).send({})
      expect((await post(otherCpId)).status).toBe(404)
      expect((await db.customerPackage.findUniqueOrThrow({ where: { id: otherCpId } })).remainingSessions).toBe(5)
      expect((await post(ownCpId)).status).toBeLessThan(300)
      expect((await db.customerPackage.findUniqueOrThrow({ where: { id: ownCpId } })).remainingSessions).toBe(4)
    })
  })

  describe('"kendi musterisi" 12 ay penceresi', () => {
    const monthsAgo = (m: number) => new Date(Date.now() - m * 30 * 24 * 60 * 60 * 1000)

    it('11 ay once tamamlanmis randevu kapsamda (200), 13 ay once kapsam disi (404)', async () => {
      const inWindow = await createTestCustomer(tenantId, '+905550000111', `${suffix}-w11`)
      const outWindow = await createTestCustomer(tenantId, '+905550000113', `${suffix}-w13`)
      await appointment(staffAProfileId, inWindow.id, serviceId, monthsAgo(11), 'completed')
      await appointment(staffAProfileId, outWindow.id, serviceId, monthsAgo(13), 'completed')
      expect((await get(`/customers/${inWindow.id}`, staffAToken)).status).toBe(200)
      expect((await get(`/customers/${outWindow.id}`, staffAToken)).status).toBe(404)
    })

    it('karar: no_show randevusu musteriyi "kendi musterisi" sayar (iptalden farkli)', async () => {
      const noShow = await createTestCustomer(tenantId, '+905550000112', `${suffix}-ns`)
      await appointment(staffBProfileId, noShow.id, serviceId, monthsAgo(1), 'no_show')
      expect((await get(`/customers/${noShow.id}`, staffBToken)).status).toBe(200)
      expect((await get(`/customers/${noShow.id}`, staffAToken)).status).toBe(404)
    })
  })
})
