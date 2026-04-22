import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { db } from '../lib/db'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestStaff,
  createTestService,
  createTestCustomer,
  cleanupTenant,
} from './helpers/setup'

const app = createApp({ rateLimitMax: 1000 })

// Istanbul is UTC+3 permanently. Midnight Istanbul = 21:00 UTC previous day.
// We construct completedAt values as ISO strings with +03:00 offset.

describe('Finance — dashboard period, close-day, daily range', () => {
  const suffix = uniqueSuffix()
  let tenantId: string
  let tenantSlug: string
  let ownerToken: string
  let staffProfileId: string
  let serviceId: string
  let customerId: string

  // We'll create transactions/expenses directly via DB to test date filtering
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  const [ty, tm, td] = todayStr.split('-').map(Number)

  const yesterdayDate = new Date(Date.UTC(ty, tm - 1, td - 1))
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0]

  const twoDaysAgoDate = new Date(Date.UTC(ty, tm - 1, td - 2))
  const twoDaysAgoStr = twoDaysAgoDate.toISOString().split('T')[0]

  // Timestamps: noon Istanbul on respective dates
  const todayNoon = new Date(`${todayStr}T12:00:00+03:00`)
  const yesterdayNoon = new Date(`${yesterdayStr}T12:00:00+03:00`)
  const twoDaysAgoNoon = new Date(`${twoDaysAgoStr}T12:00:00+03:00`)

  let txTodayId: string
  let txYesterdayId: string
  let txTwoDaysAgoId: string
  let expenseTodayId: string

  beforeAll(async () => {
    const tenant = await createTestTenant(suffix)
    tenantId = tenant.id
    tenantSlug = tenant.slug

    const owner = await createTestOwner(tenantId, tenantSlug, suffix)
    ownerToken = owner.token

    const staff = await createTestStaff(tenantId, tenantSlug, suffix)
    staffProfileId = staff.profile.id

    const service = await createTestService(tenantId, suffix)
    serviceId = service.id

    const phone = `+9055500${suffix.replace(/\D/g, '').slice(0, 7).padEnd(7, '9')}`
    const customer = await createTestCustomer(tenantId, phone, suffix)
    customerId = customer.id

    // Create 3 transactions on different days
    const txToday = await db.transaction.create({
      data: {
        tenantId,
        staffId: staffProfileId,
        grossAmount: 200,
        commissionRate: 0.1,
        commissionAmount: 20,
        paymentMethod: 'cash',
        cashAmount: 200,
        cardAmount: 0,
        status: 'completed',
        completedAt: todayNoon,
        notes: 'Today tx',
      },
    })
    txTodayId = txToday.id

    const txYesterday = await db.transaction.create({
      data: {
        tenantId,
        staffId: staffProfileId,
        grossAmount: 300,
        commissionRate: 0.1,
        commissionAmount: 30,
        paymentMethod: 'card',
        cashAmount: 0,
        cardAmount: 300,
        status: 'completed',
        completedAt: yesterdayNoon,
        notes: 'Yesterday tx',
      },
    })
    txYesterdayId = txYesterday.id

    const txTwoDaysAgo = await db.transaction.create({
      data: {
        tenantId,
        staffId: staffProfileId,
        grossAmount: 150,
        commissionRate: 0.1,
        commissionAmount: 15,
        paymentMethod: 'cash',
        cashAmount: 150,
        cardAmount: 0,
        status: 'completed',
        completedAt: twoDaysAgoNoon,
        notes: '2 days ago tx',
      },
    })
    txTwoDaysAgoId = txTwoDaysAgo.id

    // Create an expense for today
    const expToday = await db.expense.create({
      data: {
        tenantId,
        title: 'Test Gider',
        category: 'Malzeme',
        amount: 50,
        expenseDate: new Date(`${todayStr}T00:00:00+03:00`),
      },
    })
    expenseTodayId = expToday.id
  })

  afterAll(async () => {
    // Delete finance records before generic cleanup
    await db.expense.deleteMany({ where: { tenantId } })
    await db.transaction.deleteMany({ where: { tenantId } })
    await cleanupTenant(tenantId)
  })

  // ─── Task 1: Dashboard period ────────────────────────────────────────────────

  describe('GET /dashboard?period=today', () => {
    it('returns period=today by default', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/dashboard`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      expect(res.body.period).toBe('today')
    })

    it('returns period=today explicitly', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/dashboard?period=today`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      expect(res.body.period).toBe('today')
      expect(res.body).toHaveProperty('todayRevenue')
      expect(res.body).toHaveProperty('revenueChange')
      expect(res.body).toHaveProperty('occupancyRate')
    })

    it('returns period=week', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/dashboard?period=week`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      expect(res.body.period).toBe('week')
      expect(res.body).toHaveProperty('todayRevenue')
      expect(typeof res.body.todayRevenue).toBe('number')
    })

    it('returns period=month', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/dashboard?period=month`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      expect(res.body.period).toBe('month')
      expect(res.body).toHaveProperty('todayRevenue')
      expect(typeof res.body.todayRevenue).toBe('number')
    })

    it('falls back to today for invalid period value', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/dashboard?period=invalid`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      expect(res.body.period).toBe('today')
    })
  })

  // ─── Task 2: Kasa Kapatma ────────────────────────────────────────────────────

  describe('POST /finance/close-day', () => {
    it('returns today summary without date param', async () => {
      const res = await request(app)
        .post(`/api/v1/tenants/${tenantSlug}/finance/close-day`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      expect(res.body.date).toBe(todayStr)
      expect(res.body).toHaveProperty('totalRevenue')
      expect(res.body).toHaveProperty('cashRevenue')
      expect(res.body).toHaveProperty('cardRevenue')
      expect(res.body).toHaveProperty('totalExpenses')
      expect(res.body).toHaveProperty('netProfit')
      expect(res.body).toHaveProperty('transactionCount')
      expect(Array.isArray(res.body.transactions)).toBe(true)
      expect(Array.isArray(res.body.expenses)).toBe(true)
      expect(Array.isArray(res.body.staffCommissions)).toBe(true)
    })

    it('returns correct totals for today', async () => {
      const res = await request(app)
        .post(`/api/v1/tenants/${tenantSlug}/finance/close-day?date=${todayStr}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      // today tx = 200 cash; today expense = 50
      expect(res.body.totalRevenue).toBe(200)
      expect(res.body.cashRevenue).toBe(200)
      expect(res.body.cardRevenue).toBe(0)
      expect(res.body.totalExpenses).toBe(50)
      expect(res.body.netProfit).toBe(150)
      expect(res.body.transactionCount).toBe(1)
    })

    it('does NOT include yesterday transactions in today close-day', async () => {
      const res = await request(app)
        .post(`/api/v1/tenants/${tenantSlug}/finance/close-day?date=${todayStr}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      const txIds = res.body.transactions.map((t: { id: string }) => t.id)
      expect(txIds).toContain(txTodayId)
      expect(txIds).not.toContain(txYesterdayId)
    })

    it('returns yesterday summary with explicit date param', async () => {
      const res = await request(app)
        .post(`/api/v1/tenants/${tenantSlug}/finance/close-day?date=${yesterdayStr}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      expect(res.body.date).toBe(yesterdayStr)
      expect(res.body.totalRevenue).toBe(300)
      expect(res.body.cardRevenue).toBe(300)
      expect(res.body.totalExpenses).toBe(0)
      expect(res.body.netProfit).toBe(300)
    })

    it('includes staffCommissions breakdown', async () => {
      const res = await request(app)
        .post(`/api/v1/tenants/${tenantSlug}/finance/close-day?date=${todayStr}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.body.staffCommissions.length).toBeGreaterThan(0)
      const commission = res.body.staffCommissions[0]
      expect(commission).toHaveProperty('staffId')
      expect(commission).toHaveProperty('staffName')
      expect(commission).toHaveProperty('completedCount')
      expect(commission).toHaveProperty('grossAmount')
      expect(commission).toHaveProperty('commissionAmount')
    })

    it('returns 400 for invalid date format', async () => {
      const res = await request(app)
        .post(`/api/v1/tenants/${tenantSlug}/finance/close-day?date=bad-date`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(400)
    })
  })

  // ─── Task 3: Daily reports date range ────────────────────────────────────────

  describe('GET /reports/daily with date range', () => {
    it('single day — legacy ?date param still works', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/reports/daily?date=${todayStr}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      expect(res.body.from).toBe(todayStr)
      expect(res.body.to).toBe(todayStr)
      expect(res.body.totalRevenue).toBe(200)
    })

    it('date range — returns totals across multiple days', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/reports/daily?from=${twoDaysAgoStr}&to=${todayStr}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      expect(res.body.from).toBe(twoDaysAgoStr)
      expect(res.body.to).toBe(todayStr)
      // 200 (today) + 300 (yesterday) + 150 (2 days ago) = 650
      expect(res.body.totalRevenue).toBe(650)
      expect(res.body.completedCount).toBe(3)
    })

    it('date range — groupBy=day returns daily breakdown array', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/reports/daily?from=${twoDaysAgoStr}&to=${todayStr}&groupBy=day`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.daily)).toBe(true)
      expect(res.body.daily.length).toBeGreaterThanOrEqual(3)

      const dayEntries: Array<{ date: string; revenue: number; netRevenue: number }> = res.body.daily
      const todayEntry = dayEntries.find((d) => d.date === todayStr)
      expect(todayEntry).toBeDefined()
      expect(todayEntry!.revenue).toBe(200)
      // today expense = 50 → netRevenue = 150
      expect(todayEntry!.netRevenue).toBe(150)

      const yesterdayEntry = dayEntries.find((d) => d.date === yesterdayStr)
      expect(yesterdayEntry).toBeDefined()
      expect(yesterdayEntry!.revenue).toBe(300)
    })

    it('date range — daily entries are sorted ascending by date', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/reports/daily?from=${twoDaysAgoStr}&to=${todayStr}&groupBy=day`)
        .set('Authorization', `Bearer ${ownerToken}`)

      const dates: string[] = res.body.daily.map((d: { date: string }) => d.date)
      const sorted = [...dates].sort()
      expect(dates).toEqual(sorted)
    })

    it('returns 400 when from > to', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/reports/daily?from=${todayStr}&to=${twoDaysAgoStr}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid date format', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/reports/daily?from=notadate&to=${todayStr}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(400)
    })

    it('without groupBy, does NOT include daily array', async () => {
      const res = await request(app)
        .get(`/api/v1/tenants/${tenantSlug}/reports/daily?from=${twoDaysAgoStr}&to=${todayStr}`)
        .set('Authorization', `Bearer ${ownerToken}`)

      expect(res.status).toBe(200)
      expect(res.body.daily).toBeUndefined()
      expect(Array.isArray(res.body.transactions)).toBe(true)
    })
  })
})
