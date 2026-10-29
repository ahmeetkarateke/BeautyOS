import { describe, expect, it } from 'vitest'
import type { StaffMember } from '@/features/appointments/staff'
import { futureSlots, isDraftComplete, newCustomerIssue, slotStartAt, staffForService } from './create-logic'

const person = (id: string, serviceIds?: string[]): StaffMember => ({ id, name: id, short: id, title: '', initials: 'X', tone: 1, givesService: true, serviceIds })

describe('slotStartAt', () => {
  it('K-slot: Z’siz slot kimliğine Z ekler, Z’li olana dokunmaz', () => {
    expect(slotStartAt('2026-10-29T07:00:00')).toBe('2026-10-29T07:00:00Z')
    expect(slotStartAt('2026-10-29T07:00:00Z')).toBe('2026-10-29T07:00:00Z')
  })
})

describe('staffForService', () => {
  it('K-personel: yalnız o hizmeti verenleri döndürür; hizmet listesi bilinmeyen elenmez', () => {
    const list = [person('a', ['s1']), person('b', ['s2']), person('c')]
    expect(staffForService(list, 's1').map((s) => s.id)).toEqual(['a', 'c'])
  })
})

describe('newCustomerIssue', () => {
  it('K-yeni-müşteri: kısa ad yalnız ad hatası verir (telefon geçerli)', () => {
    expect(newCustomerIssue('A', '5321234567')).toBe('name')
  })
  it('K-yeni-müşteri: telefon eksik 9 hane yalnız telefon hatası verir (ad geçerli)', () => {
    expect(newCustomerIssue('Ayşe Demir', '532123456')).toBe('phone')
  })
  it('K-yeni-müşteri: 5 ile başlamayan telefon reddedilir', () => {
    expect(newCustomerIssue('Ayşe Demir', '4321234567')).toBe('phone')
  })
  it('K-yeni-müşteri: geçerli ad ve telefon hata vermez', () => {
    expect(newCustomerIssue('Ayşe Demir', '5321234567')).toBeNull()
  })
})

describe('isDraftComplete', () => {
  const full = { customer: { kind: 'existing' as const, id: 'c1', name: 'Ayşe' }, serviceId: 's1', staffId: 'p1', slotId: '2026-10-29T07:00:00' }
  it('K-taslak: tüm alanlar doluysa tamamdır', () => expect(isDraftComplete(full)).toBe(true))
  it.each(['serviceId', 'staffId', 'slotId'] as const)('K-taslak: %s boşsa tamamlanmamıştır', (key) => {
    expect(isDraftComplete({ ...full, [key]: '' })).toBe(false)
  })
  it('K-taslak: müşteri seçilmemişse tamamlanmamıştır', () => expect(isDraftComplete({ ...full, customer: null })).toBe(false))
  it('K-taslak: geçersiz yeni müşteri tamamlanmamıştır', () => {
    expect(isDraftComplete({ ...full, customer: { kind: 'new', name: 'A', phoneDigits: '5321234567' } })).toBe(false)
  })
})

describe('futureSlots (W13-G1)', () => {
  const slots = [{ id: '2026-10-28T07:00:00' }, { id: '2026-10-28T07:30:00' }, { id: '2026-10-28T08:00:00Z' }]
  it('K-geçmiş: şimdiden önceki ve şimdiki saatler elenir, sonrası kalır (10:30 TR = 07:30Z)', () => {
    const now = new Date('2026-10-28T07:30:00Z').getTime()
    expect(futureSlots(slots, now).map((s) => s.id)).toEqual(['2026-10-28T08:00:00Z'])
  })
  it('K-geçmiş: hepsi gelecekteyse hiçbiri elenmez', () => {
    expect(futureSlots(slots, new Date('2026-10-27T00:00:00Z').getTime())).toHaveLength(3)
  })
})
