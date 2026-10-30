import { describe, expect, it } from 'vitest'
import {
  BUSINESS_TYPE_OPTIONS,
  nextStep,
  pickToServiceValues,
  prevStep,
  readyTasks,
  stepProgress,
  stepsFor,
  suggestionsFor,
  validateInvite,
  type PickedService,
} from './logic'
import { validateService } from '@/features/services/logic'

describe('W31 Kurulum sihirbazı mantığı', () => {
  it('K1: adımlar tasarım sırasındadır ve yalnız tür, salon ve hazır zorunludur', () => {
    const steps = stepsFor('hair_salon')
    expect(steps.map((s) => s.id)).toEqual(['type', 'salon', 'hours', 'services', 'staff', 'legal', 'ready'])
    expect(steps.filter((s) => !s.skippable).map((s) => s.id)).toEqual(['type', 'salon', 'ready'])
  })

  it('K2: nextStep ve prevStep uçlarda taşmaz', () => {
    expect(nextStep('type')).toBe('salon')
    expect(nextStep('ready')).toBe('ready')
    expect(prevStep('salon')).toBe('type')
    expect(prevStep('type')).toBe('type')
  })

  it('K3: ilerleme yüzdesi adım sırasından türer', () => {
    expect(stepProgress('type')).toEqual({ index: 1, total: 7 })
    expect(stepProgress('ready')).toEqual({ index: 7, total: 7 })
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
