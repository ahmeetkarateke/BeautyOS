import { describe, it, expect } from 'vitest'
import { UserRole } from '@prisma/client'
import { ROLES, can, PERMISSIONS } from '@beautyos/shared'

describe('paylasilan roller Prisma ile ayni', () => {
  it('ROLES, Prisma UserRole degerleriyle birebir ayni (superadmin dahil)', () => {
    expect([...ROLES].sort()).toEqual(Object.values(UserRole).sort())
  })

  it('izin tablosundaki her rol bilinen bir roldur', () => {
    for (const roles of Object.values(PERMISSIONS)) {
      for (const role of roles) expect(ROLES).toContain(role)
    }
  })

  it('superadmin kiraci izinlerine sahip degildir (yonetici uclari ayri ara katmanla korunur)', () => {
    for (const key of Object.keys(PERMISSIONS) as Array<keyof typeof PERMISSIONS>) {
      expect(can('superadmin', key)).toBe(false)
    }
  })
})
