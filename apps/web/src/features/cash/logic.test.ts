import { describe, expect, it } from 'vitest'
import { closeBody, differenceView, reopenIssue, reopenBody, validateCount } from './logic'

describe('W19 differenceView (beklenen nakit ve fark)', () => {
  it('K1: sayım beklenenle aynıysa "Fark yok" ve durum ok', () => {
    expect(differenceView(1250, 1250)).toEqual({ amount: 0, text: 'Fark yok', tone: 'ok' })
  })
  it('K1: sayım azsa eksik (kırmızı), fazlaysa fazla (uyarı); tutar işaretli ve para biçiminde', () => {
    expect(differenceView(1250, 1200)).toEqual({ amount: -50, text: '₺50 eksik', tone: 'short' })
    expect(differenceView(1250, 1300.5)).toEqual({ amount: 50.5, text: '₺50,50 fazla', tone: 'over' })
  })
  it('K1: kuruş hesabında kayan nokta hatası olmaz (0.1 + 0.2 türü): 100,10 beklenen 100,10 sayım', () => {
    expect(differenceView(100.1, 100.1).tone).toBe('ok')
    expect(differenceView(0.3, 0.1 + 0.2).tone).toBe('ok')
  })
})

describe('W19 validateCount', () => {
  it('K2: sayım isteğe bağlıdır: boş girdi hata değildir ve sayım yok demektir', () => {
    expect(validateCount('')).toEqual({ ok: true, value: null })
  })
  it('K2: 0 geçerli sayımdır (kasada nakit kalmadı); eksi ve harf reddedilir', () => {
    expect(validateCount('0')).toEqual({ ok: true, value: 0 })
    expect(validateCount('-5').ok).toBe(false)
    expect(validateCount('abc').ok).toBe(false)
  })
  it('K2: Türkçe biçim okunur (1.250,50)', () => {
    expect(validateCount('1.250,50')).toEqual({ ok: true, value: 1250.5 })
  })
})

describe('W19 closeBody', () => {
  it('K3: sayım ve not yoksa gövde boş nesnedir (sunucuda alanlar opsiyonel)', () => {
    expect(closeBody(null, '')).toEqual({})
  })
  it('K3: sayım ve kırpılmış not gider', () => {
    expect(closeBody(1200, '  Kuaför gideri  ')).toEqual({ countedCash: 1200, note: 'Kuaför gideri' })
  })
  it('K3: yalnız not gelirse yalnız not gider', () => {
    expect(closeBody(null, 'Not')).toEqual({ note: 'Not' })
  })
})

describe('W19 reopen', () => {
  it('K4: neden en az 3 karakter ister (sunucu kuralı); boşluklar sayılmaz', () => {
    expect(reopenIssue('  ab ')).toBe('Neden en az 3 karakter olmalı. Kimin neden açtığı kayıt altında tutulur.')
    expect(reopenIssue('Hata')).toBeNull()
  })
  it('K4: gövde tarih ve kırpılmış nedeni taşır', () => {
    expect(reopenBody('2026-10-29', ' Yanlış tutar ')).toEqual({ date: '2026-10-29', reason: 'Yanlış tutar' })
  })
})
