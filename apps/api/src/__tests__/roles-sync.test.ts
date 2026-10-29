import { describe, it, expect } from 'vitest'
import { UserRole, BusinessType } from '@prisma/client'
import { ROLES, can, PERMISSIONS, BUSINESS_TYPES } from '@beautyos/shared'

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

describe('paylasilan isletme turleri Prisma ile ayni', () => {
  it('BUSINESS_TYPES, Prisma BusinessType degerleriyle birebir ayni', () => {
    expect([...BUSINESS_TYPES].sort()).toEqual(Object.values(BusinessType).sort())
  })
})
