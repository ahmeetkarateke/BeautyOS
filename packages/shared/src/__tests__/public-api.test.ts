import { describe, expect, it } from 'vitest'
import * as shared from '../index'

describe('@beautyos/shared dis API', () => {
  it('K3: dis API tam olarak bu listedir (yeni ad eklemek bu testi bilerek degistirmeyi gerektirir)', () => {
    expect(Object.keys(shared).sort()).toEqual(['ROLES', 'isRole'])
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
