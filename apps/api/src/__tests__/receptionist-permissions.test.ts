import { describe, it, expect } from 'vitest'
import { can, permissionsFor, isRole, PERMISSIONS, type PermissionKey } from '@beautyos/shared'

// A2: resepsiyon rolu (docs/tasarim-girdisi/roller-ve-akislar.md 1.4 matrisi). Saf mantik, veritabani gerekmez.
const RECEPTION_ALLOWED: PermissionKey[] = [
  'appointment.approve', // 3-7 (online talep onay/ret)
  'appointment.reschedule', // 6
  'appointment.reassign_staff', // 6 (randevuyu baska personele tasima)
  'customer.view_all', // 13
  'customer.write', // 15
  'waitlist.view', // 11
  'waitlist.write', // 12
  'tip.record', // 33
  'finance.close_day', // 37
  'finance.revenue.create', // 38
  'finance.report.daily', // 36 (yalniz bugun; rota ayrica sinirlar)
]

// R9 ve matristeki "-" hucreleri: resepsiyonun ASLA olmamasi gerekenler.
const RECEPTION_DENIED: PermissionKey[] = [
  'dashboard.revenue', // 2
  'finance.report.commissions', // 42
  'finance.report.range', // 36, 41 (gecmis gun/aralik; resepsiyon yalniz bugun)
  'tip.view', // 35 (bahsis listesi/ozeti)
  'finance.account.read', // 43
  'finance.account.write',
  'current_account.read', // 44
  'current_account.write',
  'purchase_invoice.read', // 45
  'purchase_invoice.write',
  'supplier.read', // 46
  'health.view', // 17, R9
  'health.write',
  'customer.photo.view', // 19
  'customer.photo.write',
]

describe('A2: receptionist rolu', () => {
  it('receptionist bilinen bir roldur', () => {
    expect(isRole('receptionist')).toBe(true)
  })

  it.each(RECEPTION_ALLOWED)('resepsiyon %s iznine sahip', (key) => {
    expect(can('receptionist', key)).toBe(true)
  })

  it.each(RECEPTION_DENIED)('resepsiyon %s iznine sahip DEGIL', (key) => {
    expect(can('receptionist', key)).toBe(false)
  })

  it('izin listesi tam olarak beklenen kume (yeni bir izin sessizce acilmaz)', () => {
    expect([...permissionsFor('receptionist')].sort()).toEqual([...RECEPTION_ALLOWED].sort())
  })

  it('owner ve manager yeni izinlerin hepsine sahip', () => {
    for (const key of RECEPTION_ALLOWED) {
      expect(can('owner', key)).toBe(true)
      expect(can('manager', key)).toBe(true)
    }
  })

  it('uzman (staff) resepsiyon izinlerinden hicbirine sahip degil; tek istisna kurucu karari R3 ile appointment.reschedule (kapsam rotada: yalniz kendi randevusu, staffId degistiremez)', () => {
    for (const key of RECEPTION_ALLOWED) expect(can('staff', key), key).toBe(key === 'appointment.reschedule')
  })

  it('izin tablosundaki her anahtar tanimli ve rol listesi bos degil', () => {
    for (const roles of Object.values(PERMISSIONS)) expect(roles.length).toBeGreaterThan(0)
  })
})
