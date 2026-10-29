// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatNationalPhone, toNationalDigits } from './phone'

describe('telefon yardımcıları (tasarim.md §4 Form alanı)', () => {
  it('W3: +90, 90 ve baştaki 0 ön ekleri atılır, 10 haneli ulusal numara kalır', () => {
    expect(toNationalDigits('+90 532 123 45 67')).toBe('5321234567')
    expect(toNationalDigits('0532 123 45 67')).toBe('5321234567')
    expect(toNationalDigits('905321234567')).toBe('5321234567')
  })

  it('W3: yapıştırılan metindeki NBSP, sekme, uzun tire ve eksi (U+2212) ayırıcı sayılır', () => {
    expect(toNationalDigits('532 123\t45–67')).toBe('5321234567')
    expect(toNationalDigits('532−123—45 67')).toBe('5321234567')
  })

  it('W3: 10 haneden fazlası kesilir; 9 ve 10 hane sınırı korunur', () => {
    expect(toNationalDigits('53212345678999')).toBe('5321234567')
    expect(toNationalDigits('532123456')).toBe('532123456')
  })

  it('W3: yazarken 5xx xxx xx xx biçimine bölünür ve eksik girdi bozulmaz', () => {
    expect(formatNationalPhone('5321234567')).toBe('532 123 45 67')
    expect(formatNationalPhone('53212')).toBe('532 12')
    expect(formatNationalPhone('')).toBe('')
  })

  it('W3: boş ve harf içeren girdi güvenle boşalır', () => {
    expect(toNationalDigits('')).toBe('')
    expect(toNationalDigits('abc')).toBe('')
  })
})
