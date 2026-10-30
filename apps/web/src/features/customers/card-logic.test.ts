import { describe, expect, it } from 'vitest'
import { availableTabs, formatAnswer, summaryItems, type CardDetail } from './card-logic'

const detail = (over: Partial<CardDetail> = {}): CardDetail => ({
  id: 'c1',
  fullName: 'Ayşe Demir',
  phone: '+905321234567',
  email: null,
  birthDate: null,
  preferenceNotes: null,
  totalVisits: 4,
  lifetimeValue: 3400,
  segment: null,
  lastVisitAt: '2026-10-20T09:00:00.000Z',
  marketingConsentSms: false,
  marketingConsentEmail: false,
  appointments: [],
  ...over,
})

describe('W18 availableTabs', () => {
  it('K1: sağlık izni olan rol Genel, Randevular ve Sağlık bilgileri sekmelerini görür', () => {
    expect(availableTabs(['health.view']).map((t) => t.value)).toEqual(['genel', 'randevular', 'saglik'])
  })
  it('K1: sağlık izni olmayan rolde (resepsiyon) Sağlık bilgileri sekmesi hiç çıkmaz', () => {
    expect(availableTabs(['customer.view_all']).map((t) => t.value)).toEqual(['genel', 'randevular'])
  })
  it('K1: sekme adları Türkçe', () => {
    expect(availableTabs(['health.view']).map((t) => t.label)).toEqual(['Genel', 'Randevular', 'Sağlık bilgileri'])
  })
})

describe('W18 summaryItems', () => {
  it('K2: ziyaret, harcama ve son ziyaret yazılır', () => {
    expect(summaryItems(detail())).toEqual([
      { label: 'Ziyaret', value: '4' },
      { label: 'Toplam harcama', value: '₺3.400' },
      { label: 'Son ziyaret', value: '20 Eki' },
    ])
  })
  it('K2: hiç ziyaret yoksa son ziyaret "Henüz yok" yazar, harcama ₺0 gösterilir (kart sahibi görür)', () => {
    const items = summaryItems(detail({ totalVisits: 0, lifetimeValue: 0, lastVisitAt: null }))
    expect(items[2]).toEqual({ label: 'Son ziyaret', value: 'Henüz yok' })
    expect(items[1].value).toBe('₺0')
  })
})

describe('W18 formatAnswer', () => {
  it('K3: evet/hayır, çoklu seçim, tarih, sayı ve metin okunur biçime çevrilir', () => {
    expect(formatAnswer('yes_no', true)).toBe('Evet')
    expect(formatAnswer('yes_no', false)).toBe('Hayır')
    expect(formatAnswer('multi_choice', ['Fıstık', 'Polen'])).toBe('Fıstık, Polen')
    expect(formatAnswer('date', '2026-03-05')).toBe('5 Mart 2026')
    expect(formatAnswer('number', 12)).toBe('12')
    expect(formatAnswer('short_text', 'Penisilin')).toBe('Penisilin')
  })
  it('K3: yanıt yoksa (null, boş metin, boş dizi) "Yanıtlanmadı" yazar, boş bırakılmaz', () => {
    expect(formatAnswer('short_text', null)).toBe('Yanıtlanmadı')
    expect(formatAnswer('long_text', '  ')).toBe('Yanıtlanmadı')
    expect(formatAnswer('multi_choice', [])).toBe('Yanıtlanmadı')
  })
  it('K3: beklenmeyen biçim (nesne) yanıtlanmadı sayılır, ham JSON basılmaz', () => {
    expect(formatAnswer('short_text', { a: 1 })).toBe('Yanıtlanmadı')
  })
  it('K3: false sayısı 0 ve false yes_no yanıtlanmadı sayılmaz (sıfır geçerli yanıt)', () => {
    expect(formatAnswer('number', 0)).toBe('0')
    expect(formatAnswer('yes_no', false)).toBe('Hayır')
  })
})

describe('W18 müdür kararı: uzman toplam harcamayı görmez', () => {
  it('K4: harcama görme yetkisi yoksa özet yalnız Ziyaret ve Son ziyaret içerir (Toplam harcama hiç yok)', () => {
    const items = summaryItems(detail(), { showSpending: false })
    expect(items.map((i) => i.label)).toEqual(['Ziyaret', 'Son ziyaret'])
    expect(JSON.stringify(items)).not.toContain('3.400')
  })
  it('K4: yetkili rolde (varsayılan) Toplam harcama kalır', () => {
    expect(summaryItems(detail(), { showSpending: true }).map((i) => i.label)).toEqual(['Ziyaret', 'Toplam harcama', 'Son ziyaret'])
  })
})
