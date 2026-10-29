import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { permissionsFor } from '@beautyos/shared'
import { createApp } from '../app'
import { db } from '../lib/db'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestStaff,
  cleanupTenant,
} from './helpers/setup'

// Auth hiz siniri dusuk tutulur: /auth/me bundan muaf olmali (K7).
const app = createApp({ rateLimitMax: 3 })

describe('GET /api/v1/auth/me (A1)', () => {
  const suffixA = uniqueSuffix()
  const suffixB = uniqueSuffix()
  let tenantA: { id: string; slug: string }
  let tenantB: { id: string; slug: string }
  let ownerA: Awaited<ReturnType<typeof createTestOwner>>
  let staffA: Awaited<ReturnType<typeof createTestStaff>>
  let ownerB: Awaited<ReturnType<typeof createTestOwner>>

  beforeAll(async () => {
    tenantA = await createTestTenant(suffixA)
    tenantB = await createTestTenant(suffixB)
    await db.tenant.update({
      where: { id: tenantA.id },
      data: { name: 'Salon A', settings: { activeModules: ['dashboard', 'finance'], botRules: 'gizli', whatsappApiToken: 'tok' } },
    })
    await db.tenant.update({ where: { id: tenantB.id }, data: { name: 'Salon B' } })
    ownerA = await createTestOwner(tenantA.id, tenantA.slug, suffixA)
    staffA = await createTestStaff(tenantA.id, tenantA.slug, suffixA)
    ownerB = await createTestOwner(tenantB.id, tenantB.slug, suffixB)
  })

  afterAll(async () => {
    await cleanupTenant(tenantA.id)
    await cleanupTenant(tenantB.id)
  })

  it('K1: sahip kendi rolunu, izin listesini ve kiraci blogunu alir', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${ownerA.token}`)
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('owner')
    expect(res.body.permissions).toEqual(permissionsFor('owner'))
    expect(res.body.staffId).toBeNull()
    expect(res.body.tenant).toMatchObject({
      slug: tenantA.slug,
      name: 'Salon A',
      termSet: 'salon',
      activeModules: ['dashboard', 'finance'],
      bookingMode: 'approval_required',
      timezone: 'Europe/Istanbul',
    })
  })

  it('K2: uzman staffId alir ve finans izni almaz', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${staffA.token}`)
    expect(res.status).toBe(200)
    expect(res.body.staffId).toBe(staffA.profile.id)
    expect(res.body.permissions).not.toContain('finance.close_day')
    expect(res.body.permissions).toEqual(permissionsFor('staff'))
  })

  it('K3: baska kiracinin bilgisi sizmaz; B sahibi yalniz B\'yi gorur', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${ownerB.token}`)
    expect(res.status).toBe(200)
    expect(res.body.tenant.slug).toBe(tenantB.slug)
    expect(res.body.tenant.name).toBe('Salon B')
    expect(JSON.stringify(res.body)).not.toContain('Salon A')
  })

  it('K4: yanit gizli alan tasimaz', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${ownerA.token}`)
    const json = JSON.stringify(res.body)
    for (const forbidden of ['passwordHash', 'whatsappApiToken', 'telegramBotToken', 'botRules', 'gizli', 'tok"']) {
      expect(json).not.toContain(forbidden)
    }
  })

  it('K5: tokensiz istek 401', async () => {
    const res = await request(app).get('/api/v1/auth/me')
    expect(res.status).toBe(401)
  })

  it('K6: JWT kiraci iddiasi kullaniciyla uyusmuyorsa (A kullanicisi, B kiraci) B bilgisi donmez', async () => {
    const forged = jwt.sign(
      { userId: ownerA.user.id, tenantId: tenantB.id, tenantSlug: tenantB.slug, role: 'owner' },
      process.env.JWT_SECRET ?? 'dev-secret',
      { expiresIn: '1h' },
    )
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`)
    expect(res.status).toBe(401)
    expect(JSON.stringify(res.body)).not.toContain('Salon B')
  })

  it('K7: auth hiz sinirina takilmaz (limit 3, 6 istek hepsi 200)', async () => {
    for (let i = 0; i < 6; i++) {
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${ownerA.token}`)
      expect(res.status).toBe(200)
    }
  })

  it('K8: pasif kullanici 401 alir', async () => {
    await db.user.update({ where: { id: staffA.user.id }, data: { isActive: false } })
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${staffA.token}`)
    expect(res.status).toBe(401)
    await db.user.update({ where: { id: staffA.user.id }, data: { isActive: true } })
  })
})
