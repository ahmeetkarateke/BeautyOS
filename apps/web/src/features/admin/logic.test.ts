import { describe, expect, it } from 'vitest'
import { extendedTrialEnd, filterTenants, foldSearch, tenantStatus, TRIAL_EXTENSIONS, type TenantRow } from './logic'

const NOW = new Date('2026-10-30T09:00:00.000Z')

function row(over: Partial<TenantRow> = {}): TenantRow {
  return {
    id: 't1',
    name: 'Güzel Salon',
    slug: 'guzel-salon',
    plan: 'trial',
    isActive: true,
    trialEndsAt: '2026-11-10T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    ownerName: 'Ayşe Yılmaz',
    ownerEmail: 'ayse@example.com',
    userCount: 3,
    customerCount: 40,
    ...over,
  }
}

describe('W33 salon durumu', () => {
  it('K1: pasif salon, deneme tarihi geçmiş olsa da "pasif" görünür', () => {
    expect(tenantStatus(row({ isActive: false, trialEndsAt: '2026-01-01T00:00:00.000Z' }), NOW)).toBe('passive')
  })
  it('K1: aktif salonun deneme süresi geçmişse "süresi dolmuş"', () => {
    expect(tenantStatus(row({ trialEndsAt: '2026-10-29T00:00:00.000Z' }), NOW)).toBe('expired')
  })
  it('K1: süresi geçerli deneme planı "deneme", ücretli plan "aktif"', () => {
    expect(tenantStatus(row(), NOW)).toBe('trial')
    expect(tenantStatus(row({ plan: 'pro', trialEndsAt: null }), NOW)).toBe('active')
  })
  it('K1: ücretli planda eski deneme tarihi salonu "süresi dolmuş" yapmaz', () => {
    expect(tenantStatus(row({ plan: 'starter', trialEndsAt: '2026-01-01T00:00:00.000Z' }), NOW)).toBe('active')
  })
})

describe('W33 salon listesi süzgeci', () => {
  const rows = [
    row({ id: 'a', name: 'İstanbul Güzellik', slug: 'istanbul-guzellik' }),
    row({ id: 'b', name: 'Işık Kuaför', slug: 'isik-kuafor', plan: 'pro', trialEndsAt: null }),
    row({ id: 'c', name: 'Pasif Berber', slug: 'pasif-berber', isActive: false }),
  ]
  it('K2: arama büyük İ ve I ile yazılsa da küçük i ve ı karşılığını bulur', () => {
    expect(foldSearch('İSTANBUL')).toBe(foldSearch('istanbul'))
    expect(filterTenants(rows, { search: 'ISIK', plan: '', status: '' }, NOW).map((r) => r.id)).toEqual(['b'])
    expect(filterTenants(rows, { search: 'istanbul', plan: '', status: '' }, NOW).map((r) => r.id)).toEqual(['a'])
  })
  it('K2: sahip e-postası ve salon adresiyle de aranır', () => {
    expect(filterTenants(rows, { search: 'AYSE@example', plan: '', status: '' }, NOW)).toHaveLength(3)
    expect(filterTenants(rows, { search: 'pasif-berber', plan: '', status: '' }, NOW).map((r) => r.id)).toEqual(['c'])
  })
  it('K2: plan ve durum süzgeçleri birlikte çalışır', () => {
    expect(filterTenants(rows, { search: '', plan: 'pro', status: '' }, NOW).map((r) => r.id)).toEqual(['b'])
    expect(filterTenants(rows, { search: '', plan: '', status: 'passive' }, NOW).map((r) => r.id)).toEqual(['c'])
    expect(filterTenants(rows, { search: '', plan: 'pro', status: 'passive' }, NOW)).toEqual([])
  })
})

describe('W33 deneme uzatma', () => {
  it('K3: bitiş tarihi gelecekteyse üstüne gün eklenir', () => {
    expect(extendedTrialEnd('2026-11-10T00:00:00.000Z', 7, NOW)).toBe('2026-11-17T00:00:00.000Z')
  })
  it('K3: süresi dolmuş ya da tarihsiz denemede bugünden başlar', () => {
    expect(extendedTrialEnd('2026-10-01T00:00:00.000Z', 14, NOW)).toBe('2026-11-13T09:00:00.000Z')
    expect(extendedTrialEnd(null, 7, NOW)).toBe('2026-11-06T09:00:00.000Z')
  })
  it('K3: seçenekler 7, 14 ve 30 gündür', () => {
    expect(TRIAL_EXTENSIONS).toEqual([7, 14, 30])
  })
})
