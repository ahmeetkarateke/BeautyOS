import { describe, expect, it } from 'vitest'
import { canNotify, createBody, notifyMessage, preferenceLine, sortEntries, statusLabel, validateAdd, type WaitEntry } from './logic'

const entry = (over: Partial<WaitEntry> = {}): WaitEntry => ({
  id: 'w1', customerId: 'c1', customerName: 'Ayşe Demir', customerPhone: '+905321234567', serviceName: 'Fön', staffName: 'Derya Aksoy', preferredDate: '2026-11-03',
  preferredTimeRange: 'Öğleden sonra', status: 'waiting', notes: null, notifiedAt: null, createdAt: '2026-10-29T08:00:00.000Z', ...over,
})

describe('W22 statusLabel', () => {
  it('K1: durumlar Türkçe ve metin olarak yazılır', () => {
    expect(statusLabel('waiting')).toBe('Bekliyor')
    expect(statusLabel('notified')).toBe('Haber verildi')
    expect(statusLabel('booked')).toBe('Randevuya çevrildi')
    expect(statusLabel('expired')).toBe('Süresi doldu')
    expect(statusLabel('cancelled')).toBe('Listeden çıkarıldı')
  })
  it('K1: bilinmeyen durum ham kodla değil genel metinle yazılır', () => {
    expect(statusLabel('weird')).toBe('Bilinmiyor')
  })
})

describe('W22 preferenceLine', () => {
  it('K2: hizmet, uzman, tarih ve saat aralığı noktayla ayrılır', () => {
    expect(preferenceLine(entry())).toBe('Fön · Derya Aksoy · 3 Kas · Öğleden sonra')
  })
  it('K2: hiçbiri yoksa "Tercih belirtilmedi" (boş bırakılmaz)', () => {
    expect(preferenceLine(entry({ serviceName: null, staffName: null, preferredDate: null, preferredTimeRange: null }))).toBe('Tercih belirtilmedi')
  })
  it('K2: yalnız bazı alanlar varsa yalnız onlar yazılır', () => {
    expect(preferenceLine(entry({ staffName: null, preferredDate: null }))).toBe('Fön · Öğleden sonra')
  })
})

describe('W22 sortEntries', () => {
  it('K3: açıklar önce (bekleyen, sonra haber verilen), kapalılar sonda; kendi içinde en eski önce', () => {
    const list = [
      entry({ id: 'k', status: 'cancelled', createdAt: '2026-10-01T00:00:00.000Z' }),
      entry({ id: 'n', status: 'notified', createdAt: '2026-10-02T00:00:00.000Z' }),
      entry({ id: 'w2', createdAt: '2026-10-05T00:00:00.000Z' }),
      entry({ id: 'w1', createdAt: '2026-10-03T00:00:00.000Z' }),
    ]
    expect(sortEntries(list).map((e) => e.id)).toEqual(['w1', 'w2', 'n', 'k'])
  })
})

describe('W22 canNotify', () => {
  it('K4: yalnız bekleyen ve haber verilmiş kayıt için haber verilebilir', () => {
    expect(canNotify('waiting')).toBe(true)
    expect(canNotify('notified')).toBe(true)
    expect(canNotify('booked')).toBe(false)
    expect(canNotify('expired')).toBe(false)
    expect(canNotify('cancelled')).toBe(false)
  })
})

describe('W22 notifyMessage', () => {
  it('K5: mesaj müşterinin ilk adıyla başlar; hizmet varsa adı geçer; salon adı yazılır', () => {
    expect(notifyMessage(entry(), 'Defne Güzellik')).toBe('Merhaba Ayşe, Defne Güzellik: Fön için beklediğiniz saat müsait oldu. Uygunsanız bize yazın ya da arayın.')
  })
  it('K5: hizmet yoksa genel cümle', () => {
    expect(notifyMessage(entry({ serviceName: null }), 'Defne Güzellik')).toBe('Merhaba Ayşe, Defne Güzellik: beklediğiniz saat müsait oldu. Uygunsanız bize yazın ya da arayın.')
  })
  it('K5: Türk İ/ı: ad "İpek" büyük harfle bozulmadan yazılır', () => {
    expect(notifyMessage(entry({ customerName: 'İpek Yılmaz' }), 'Salon')).toContain('Merhaba İpek,')
  })
})

describe('W22 validateAdd / createBody', () => {
  const values = { customerId: 'c1', serviceId: '', staffId: '', date: '', timeRange: '', notes: '' }
  it('K6: müşteri zorunlu, diğerleri isteğe bağlı', () => {
    expect(validateAdd(values, '2026-10-29')).toEqual({})
    expect(Object.keys(validateAdd({ ...values, customerId: '' }, '2026-10-29'))).toEqual(['customerId'])
  })
  it('K6: tercih tarihi geçmişte olamaz; bugün ve ileri kabul', () => {
    expect(Object.keys(validateAdd({ ...values, date: '2026-10-28' }, '2026-10-29'))).toEqual(['date'])
    expect(validateAdd({ ...values, date: '2026-10-29' }, '2026-10-29')).toEqual({})
  })
  it('K6: gövde yalnız dolu alanları taşır', () => {
    expect(createBody(values)).toEqual({ customerId: 'c1' })
    expect(createBody({ ...values, serviceId: 's1', date: '2026-11-03', timeRange: ' Sabah ', notes: ' Not ' })).toEqual({ customerId: 'c1', serviceId: 's1', preferredDate: '2026-11-03', preferredTimeRange: 'Sabah', notes: 'Not' })
  })
})
