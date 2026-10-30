import { describe, expect, it } from 'vitest'
import {
  BUSINESS_TYPE_OPTIONS,
  nextStep,
  serviceCreateBody,
  pickToServiceValues,
  prevStep,
  readyTasks,
  salonSetupIncomplete,
  stepProgress,
  stepsFor,
  suggestionsFor,
  validateInvite,
  type PickedService,
} from './logic'
import { validateService } from '@/features/services/logic'

describe('W31 Kurulum sihirbazı mantığı', () => {
  it('K1: adımlar tasarım sırasındadır ve yalnız hazır adımı atlanamaz (müdür kararı: her adımda Şimdilik atla)', () => {
    const steps = stepsFor('hair_salon')
    expect(steps.map((s) => s.id)).toEqual(['type', 'salon', 'hours', 'services', 'staff', 'legal', 'ready'])
    expect(steps.filter((s) => !s.skippable).map((s) => s.id)).toEqual(['ready'])
  })

  it('K2: nextStep ve prevStep uçlarda taşmaz', () => {
    expect(nextStep('type', 'hair_salon')).toBe('salon')
    expect(nextStep('ready', 'hair_salon')).toBe('ready')
    expect(prevStep('salon', 'hair_salon')).toBe('type')
    expect(prevStep('type', 'hair_salon')).toBe('type')
  })

  it('K3: ilerleme yüzdesi adım sırasından türer', () => {
    expect(stepProgress('type', 'hair_salon')).toEqual({ index: 1, total: 7 })
    expect(stepProgress('ready', 'hair_salon')).toEqual({ index: 7, total: 7 })
  })

  it('K1b: klinik modunda (diş, estetik) tür adımından sonra sağlık kuruluşu bilgi adımı gelir; salonda gelmez', () => {
    expect(stepsFor('dentist').map((s) => s.id).slice(0, 3)).toEqual(['type', 'clinic', 'salon'])
    expect(stepsFor('aesthetic_clinic').map((s) => s.id)).toContain('clinic')
    expect(stepsFor('hair_transplant').map((s) => s.id)).not.toContain('clinic')
    expect(nextStep('type', 'dentist')).toBe('clinic')
    expect(prevStep('salon', 'dentist')).toBe('clinic')
    expect(stepProgress('ready', 'dentist')).toEqual({ index: 8, total: 8 })
  })

  it('K4: işletme türü seçenekleri 11 türü kapsar ve değerleri sunucu sabitleriyle aynıdır', () => {
    expect(BUSINESS_TYPE_OPTIONS.map((o) => o.value)).toContain('hair_transplant')
    expect(BUSINESS_TYPE_OPTIONS).toHaveLength(11)
  })

  it('K5: hizmet önerileri türe göre gelir; bilinmeyen türde boş liste', () => {
    expect(suggestionsFor('barbershop').map((s) => s.name)).toContain('Saç kesimi')
    expect(suggestionsFor('bilinmeyen')).toEqual([])
  })

  it('K6: öneri fiyatsız gelir; fiyat yazılmadan hizmet formu geçersizdir (yalnız fiyat kuralı)', () => {
    const pick: PickedService = { name: 'Saç kesimi', category: 'Saç', durationText: '30', priceText: '' }
    expect(validateService(pickToServiceValues(pick))).toEqual({ priceText: expect.any(String) })
    expect(validateService(pickToServiceValues({ ...pick, priceText: '350' }))).toEqual({})
  })

  it('K6b: fiyat hizmet mantığıyla çevrilir: 850.50 -> 850.5, 1.250,50 -> 1250.5, 850,5 -> 850.5, boş kategori düşer', () => {
    const base = { name: 'Saç kesimi', category: '', durationText: '30' }
    expect(serviceCreateBody({ ...base, priceText: '850.50' })).toMatchObject({ price: 850.5, durationMinutes: 30 })
    expect(serviceCreateBody({ ...base, priceText: '1.250,50' })).toMatchObject({ price: 1250.5 })
    expect(serviceCreateBody({ ...base, priceText: '850,5' })).toMatchObject({ price: 850.5 })
    expect(serviceCreateBody({ ...base, priceText: '350' })).not.toHaveProperty('category')
  })

  it('K7: davet doğrulaması e-posta ve adı ayrı ayrı sınar', () => {
    expect(validateInvite({ fullName: 'Ayşe Demir', email: 'ayse@ornek.com', role: 'staff' })).toEqual({})
    expect(validateInvite({ fullName: 'A', email: 'ayse@ornek.com', role: 'staff' })).toEqual({ fullName: expect.any(String) })
    expect(validateInvite({ fullName: 'Ayşe Demir', email: 'ayse', role: 'staff' })).toEqual({ email: expect.any(String) })
  })

  it('K8: hazır ekranı üç görev verir; bağlantı salon yoluna işaret eder', () => {
    const tasks = readyTasks('defne')
    expect(tasks.map((t) => t.id)).toEqual(['first-appointment', 'copy-link', 'review-hours'])
    expect(tasks[2].href).toBe('/panel/defne/ayarlar/calisma-saatleri')
    expect(tasks[1].href).toBeNull()
  })
})

describe('W31 salon gövdesi', () => {
  it('K13: boş telefon PATCH gövdesine girmez (sunucu en az 7 karakter ister); dolu telefon kırpılarak gider', async () => {
    const { salonBody } = await import('./logic')
    expect(salonBody({ name: ' Defne ', phone: '  ', address: ' Atatürk Cad. 5 ' })).toEqual({ name: 'Defne', address: 'Atatürk Cad. 5' })
    expect(salonBody({ name: 'Defne', phone: ' 0532 111 22 33 ', address: 'Atatürk Cad. 5' })).toMatchObject({ phone: '0532 111 22 33' })
  })
})

describe('W31 salon bilgileri eksikliği', () => {
  const full = { name: 'Defne Berber', phone: '05321234567', address: 'Atatürk Cad. 5, Kadıköy' }
  it('K14: ad ve adres tamamsa eksik sayılmaz; telefon isteğe bağlıdır', () => {
    expect(salonSetupIncomplete(full)).toBe(false)
    expect(salonSetupIncomplete({ ...full, phone: '' })).toBe(false)
  })
  it('K14: adres boşsa eksiktir (yalnız adres bozuk, ad geçerli)', () => {
    expect(salonSetupIncomplete({ ...full, address: '' })).toBe(true)
  })
  it('K14: ad çok kısaysa eksiktir (yalnız ad bozuk, adres geçerli)', () => {
    expect(salonSetupIncomplete({ ...full, name: 'D' })).toBe(true)
  })
})
