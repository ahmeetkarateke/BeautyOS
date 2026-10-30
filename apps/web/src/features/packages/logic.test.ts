import { describe, expect, it } from 'vitest'
import {
  emptyPackage,
  packageBody,
  packageMeta,
  perSession,
  sortPackages,
  toPackageValues,
  validatePackage,
  type PackageRow,
  type PackageValues,
} from './logic'

const pkg = (over: Partial<PackageRow> = {}): PackageRow => ({
  id: 'p1',
  name: 'Cilt bakımı 6 seans',
  serviceId: 's1',
  serviceName: 'Cilt bakımı',
  totalSessions: 6,
  price: 3000,
  validityDays: 180,
  description: null,
  isActive: true,
  ...over,
})
const valid: PackageValues = {
  serviceId: 's1',
  name: 'Cilt bakımı 6 seans',
  sessionsText: '6',
  priceText: '3.000',
  validityText: '180',
  description: '',
  isActive: true,
}

describe('W26 perSession / packageMeta', () => {
  it('K1: seans başı fiyat kuruşa yuvarlanır; sıfır seansta 0 (bölme hatası yok)', () => {
    expect(perSession(3000, 6)).toBe(500)
    expect(perSession(1000, 3)).toBe(333.33)
    expect(perSession(1000, 0)).toBe(0)
  })
  it('K1: özet satırı seans, fiyat ve süreyi yazar; süre yoksa "Süresiz"', () => {
    expect(packageMeta(pkg())).toBe('6 seans · ₺3.000 · 180 gün geçerli')
    expect(packageMeta(pkg({ validityDays: null }))).toBe('6 seans · ₺3.000 · Süresiz')
  })
})

describe('W26 sortPackages', () => {
  it('K2: etkinler önce, ada göre Türkçe sırayla; pasifler sonda', () => {
    const sorted = sortPackages([pkg({ id: 'a', name: 'Zeta' }), pkg({ id: 'b', name: 'Çay', isActive: false }), pkg({ id: 'c', name: 'Ağda' })])
    expect(sorted.map((p) => p.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('W26 validatePackage', () => {
  it('K3: geçerli paket hatasızdır', () => {
    expect(validatePackage(valid)).toEqual({})
  })
  it('K3: hizmet zorunlu; ad 2-100', () => {
    expect(Object.keys(validatePackage({ ...valid, serviceId: '' }))).toEqual(['serviceId'])
    expect(Object.keys(validatePackage({ ...valid, name: 'A' }))).toEqual(['name'])
  })
  it('K3: seans 1-100 tam sayı; fiyat sıfırdan büyük (0 reddedilir)', () => {
    expect(Object.keys(validatePackage({ ...valid, sessionsText: '0' }))).toEqual(['sessionsText'])
    expect(Object.keys(validatePackage({ ...valid, sessionsText: '101' }))).toEqual(['sessionsText'])
    expect(Object.keys(validatePackage({ ...valid, sessionsText: '2,5' }))).toEqual(['sessionsText'])
    expect(Object.keys(validatePackage({ ...valid, priceText: '0' }))).toEqual(['priceText'])
    expect(Object.keys(validatePackage({ ...valid, priceText: 'x' }))).toEqual(['priceText'])
  })
  it('K3: geçerlilik gün sayısı isteğe bağlı 1-1095; açıklama ≤500', () => {
    expect(validatePackage({ ...valid, validityText: '' })).toEqual({})
    expect(Object.keys(validatePackage({ ...valid, validityText: '1096' }))).toEqual(['validityText'])
    expect(Object.keys(validatePackage({ ...valid, description: 'x'.repeat(501) }))).toEqual(['description'])
  })
})

describe('W26 packageBody / toPackageValues', () => {
  it('K4: gövde sayıları çevirir; boş süre null, açıklama boşsa gönderilmez', () => {
    expect(packageBody(valid)).toEqual({ serviceId: 's1', name: 'Cilt bakımı 6 seans', totalSessions: 6, price: 3000, validityDays: 180, isActive: true })
    expect(packageBody({ ...valid, validityText: '', description: ' Not ' })).toMatchObject({ validityDays: null, description: 'Not' })
  })
  it('K4: sunucu kaydı forma çevrilir; boş form etkin başlar', () => {
    expect(toPackageValues(pkg({ price: 99.5 }))).toMatchObject({ priceText: '99,5', sessionsText: '6', validityText: '180' })
    expect(emptyPackage().isActive).toBe(true)
  })
})
