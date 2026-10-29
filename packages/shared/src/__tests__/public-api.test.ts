import { describe, expect, it } from 'vitest'
import * as shared from '../index'

describe('@beautyos/shared dis API', () => {
  it('K3: dis API tam olarak bu listedir (yeni ad eklemek bu testi bilerek degistirmeyi gerektirir)', () => {
    expect(Object.keys(shared).sort()).toEqual(['PERMISSIONS', 'ROLES', 'can', 'isRole', 'permissionsFor'])
  })
})

describe('isRole', () => {
  it('bilinen rolleri kabul eder', () => {
    for (const role of shared.ROLES) expect(shared.isRole(role)).toBe(true)
  })

  it('bilinmeyen, bos ve string olmayan degerleri reddeder', () => {
    for (const value of ['admin', '', 'OWNER', 'Owner', undefined, null, 1, {}]) {
      expect(shared.isRole(value)).toBe(false)
    }
  })

  it('Turk I vakasi: buyuk I iceren rol adi dil bagimsiz kucultmeyle taninir, kucultulmemis hali taninmaz', () => {
    expect(shared.isRole('MANAGER'.toLowerCase())).toBe(true)
    expect(shared.isRole('STAFF')).toBe(false)
  })
})

describe('izin tablosu', () => {
  it('staff finans, cari, fatura ve tedarikci izinlerine sahip degil', () => {
    for (const key of [
      'dashboard.revenue', 'finance.close_day', 'finance.report.daily', 'finance.report.commissions',
      'finance.revenue.create', 'finance.account.read', 'current_account.read', 'purchase_invoice.read',
      'supplier.read', 'customer.view_all',
    ] as const) {
      expect(shared.can('staff', key)).toBe(false)
      expect(shared.can('owner', key)).toBe(true)
      expect(shared.can('manager', key)).toBe(true)
    }
  })

  it('bilinmeyen rol, superadmin ve bos deger hicbir izne sahip degil', () => {
    for (const role of ['superadmin', 'admin', '', undefined, null]) {
      expect(shared.permissionsFor(role)).toEqual([])
    }
  })

  it('Object.prototype adlari izin anahtari sayilmaz (disaridan gelen anahtar icin kapali basarisizlik)', () => {
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      for (const role of ['owner', 'manager', 'staff']) {
        expect(shared.can(role, key as never)).toBe(false)
      }
    }
  })

  it('permissionsFor: staff yalnizca saglik ve fotograf izinlerini alir', () => {
    expect(shared.permissionsFor('staff').sort()).toEqual(
      ['customer.photo.view', 'customer.photo.write', 'health.view', 'health.write'],
    )
  })
})
