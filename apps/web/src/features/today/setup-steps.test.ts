import { describe, expect, it } from 'vitest'
import { buildSetupSteps, needsSetup, setupProgress } from './setup-steps'

const base = { slug: 'defne', serviceCount: 0, staffCount: 0, todayAppointmentCount: 0 }

describe('W10 K-kurulum: ilk kurulum listesi', () => {
  it('K-kurulum: boş salonda salon bilgisi tamam, geri kalanı açık; yüzde adımlardan hesaplanır', () => {
    const steps = buildSetupSteps(base)
    expect(steps.map((s) => [s.id, s.done])).toEqual([
      ['salon', true],
      ['services', false],
      ['staff', false],
      ['first-appointment', false],
    ])
    expect(setupProgress(steps)).toEqual({ done: 1, total: 4, percent: 25 })
  })

  it('K-kurulum: hizmet ve personel eklenince ilgili adımlar tamamlanır', () => {
    const steps = buildSetupSteps({ ...base, serviceCount: 3, staffCount: 2 })
    expect(steps.filter((s) => s.done).map((s) => s.id)).toEqual(['salon', 'services', 'staff'])
  })

  it('K-kurulum: bugün randevu varsa ilk randevu adımı tamamdır ve liste bitmiş sayılır', () => {
    const steps = buildSetupSteps({ ...base, serviceCount: 1, staffCount: 1, todayAppointmentCount: 1 })
    expect(setupProgress(steps).percent).toBe(100)
  })

  it('K-kurulum: bağlantılar salonun kendi adresine gider; ilk randevu adımı eylemdir (adres değil)', () => {
    const steps = buildSetupSteps(base)
    expect(steps.find((s) => s.id === 'services')?.href).toBe('/panel/defne/hizmetler')
    expect(steps.find((s) => s.id === 'staff')?.href).toBe('/panel/defne/personel')
    expect(steps.find((s) => s.id === 'first-appointment')?.href).toBeNull()
  })

  it('K-kurulum: salon kısaltması adres için kaçışlanır', () => {
    expect(buildSetupSteps({ ...base, slug: 'a b/c' })[1].href).toBe('/panel/a%20b%2Fc/hizmetler')
  })
})

describe('W10 K-kurulum: liste ne zaman görünür', () => {
  it('K-kurulum: hizmet ya da personel eksikse görünür', () => {
    expect(needsSetup(buildSetupSteps({ ...base, serviceCount: 1 }))).toBe(true)
    expect(needsSetup(buildSetupSteps({ ...base, staffCount: 1 }))).toBe(true)
  })

  it('K-kurulum: hizmet ve personel varsa yalnız ilk randevunun eksikliği listeyi açmaz', () => {
    expect(needsSetup(buildSetupSteps({ ...base, serviceCount: 1, staffCount: 1 }))).toBe(false)
  })
})
