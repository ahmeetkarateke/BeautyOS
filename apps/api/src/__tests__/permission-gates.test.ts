import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { can } from '@beautyos/shared'
import { createApp } from '../app'
import {
  uniqueSuffix,
  createTestTenant,
  createTestOwner,
  createTestManager,
  createTestStaff,
  cleanupTenant,
} from './helpers/setup'
import { GATES } from './helpers/gates'

const app = createApp({ rateLimitMax: 1000 })

/**
 * S1-K5: GATES tablosundaki her kapi (okuma ve yazma) icin rol x uc. Beklenen sonuc izin tablosundan turetilir:
 * izni olmayan rol 403 FORBIDDEN alir; izni olan rol 403 almaz (govde gecersiz olsa bile dogrulama kapisina ulasir).
 * Kapi kaynakta kalkarsa ya da yanlis anahtara baglanirsa (scan testi) ya da hic konmazsa bu test kirmizi olur.
 */
describe('S1-K5: yetki kapisi rol x uc matrisi', () => {
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

  for (const gate of GATES) {
    for (const role of ['owner', 'manager', 'staff'] as const) {
      const allowed = can(role, gate.permission)
      it(`${gate.method.toUpperCase()} ${gate.url} (${gate.permission}): ${role} ${allowed ? 'kapidan gecer' : '403 alir'}`, async () => {
        const res = await request(app)[gate.method](`/api/v1/tenants/${slug}${gate.url}`).set('Authorization', `Bearer ${tokens[role]}`)
        if (allowed) {
          expect(res.status).not.toBe(403)
          expect(res.status).toBeLessThan(500)
        } else {
          expect(res.status).toBe(403)
          expect(res.body.error.code).toBe('FORBIDDEN')
        }
      })
    }
  }
})
