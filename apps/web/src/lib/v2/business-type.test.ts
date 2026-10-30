import { describe, expect, it } from 'vitest'
import { hidesServiceInMessages, isClinicMode } from './business-type'

describe('işletme türü kararları (hukuk-uyum §10.3)', () => {
  it('K1: klinik modu yalnız diş ve estetik kliniğidir; saç ekimi salon modunda kalır', () => {
    expect(isClinicMode('dentist')).toBe(true)
    expect(isClinicMode('aesthetic_clinic')).toBe(true)
    expect(isClinicMode('hair_transplant')).toBe(false)
    expect(isClinicMode('beauty_center')).toBe(false)
    expect(isClinicMode(undefined)).toBe(false)
  })
  it('K2: mesajda hizmet adı gizleme saç ekimini de kapsar; salon türlerini kapsamaz', () => {
    expect(hidesServiceInMessages('dentist')).toBe(true)
    expect(hidesServiceInMessages('aesthetic_clinic')).toBe(true)
    expect(hidesServiceInMessages('hair_transplant')).toBe(true)
    expect(hidesServiceInMessages('beauty_center')).toBe(false)
    expect(hidesServiceInMessages('')).toBe(false)
    expect(hidesServiceInMessages(null)).toBe(false)
  })
})
