import type { ServiceValues } from '@/features/services/logic'

// Kurulum sihirbazı saf mantığı (W31, tasarim.md §8.3). Adım sırası ve atlanabilirlik burada; ağ çağrıları api/ekranda.
export type StepId = 'type' | 'salon' | 'hours' | 'services' | 'staff' | 'legal' | 'ready'
export type Step = { id: StepId; label: string; skippable: boolean }
export type PickedService = { name: string; category: string; durationText: string; priceText: string }
export type InviteValues = { fullName: string; email: string; role: 'manager' | 'receptionist' | 'staff' }

const STEPS: readonly Step[] = [
  { id: 'type', label: 'İşletme türü', skippable: false },
  { id: 'salon', label: 'Salon bilgileri', skippable: false },
  { id: 'hours', label: 'Çalışma saatleri', skippable: true },
  { id: 'services', label: 'Hizmetler', skippable: true },
  { id: 'staff', label: 'Personel', skippable: true },
  { id: 'legal', label: 'Yasal bilgiler', skippable: true },
  { id: 'ready', label: 'Hazır', skippable: false },
]

export const BUSINESS_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'hair_salon', label: 'Kuaför' },
  { value: 'barbershop', label: 'Berber' },
  { value: 'beauty_center', label: 'Güzellik merkezi' },
  { value: 'nail_studio', label: 'Tırnak stüdyosu' },
  { value: 'spa', label: 'Spa' },
  { value: 'massage', label: 'Masaj salonu' },
  { value: 'tattoo_piercing', label: 'Dövme ve piercing' },
  { value: 'aesthetic_clinic', label: 'Estetik kliniği' },
  { value: 'dentist', label: 'Diş kliniği' },
  { value: 'hair_transplant', label: 'Saç ekim merkezi' },
  { value: 'other', label: 'Diğer' },
]

/** Adımlar her türde aynı sıradadır; tür yalnız öneri ve metinleri değiştirir. */
export const stepsFor = (_businessType: string): Step[] => STEPS.map((s) => ({ ...s }))

const ids = STEPS.map((s) => s.id)
export const nextStep = (id: StepId, _t?: string): StepId => ids[Math.min(ids.indexOf(id) + 1, ids.length - 1)]
export const prevStep = (id: StepId, _t?: string): StepId => ids[Math.max(ids.indexOf(id) - 1, 0)]
export const serviceCreateBody = (_p: PickedService): Record<string, unknown> => ({})
export const stepProgress = (id: StepId, _t?: string) => ({ index: ids.indexOf(id) + 1, total: ids.length })

type Suggestion = { name: string; category: string; durationText: string }
const SUGGESTIONS: Record<string, Suggestion[]> = {
  hair_salon: [
    { name: 'Saç kesimi', category: 'Saç', durationText: '45' },
    { name: 'Boya', category: 'Saç', durationText: '90' },
    { name: 'Fön', category: 'Saç', durationText: '30' },
    { name: 'Keratin bakım', category: 'Bakım', durationText: '120' },
  ],
  barbershop: [
    { name: 'Saç kesimi', category: 'Saç', durationText: '30' },
    { name: 'Sakal tıraşı', category: 'Sakal', durationText: '20' },
    { name: 'Saç ve sakal', category: 'Saç', durationText: '45' },
  ],
  beauty_center: [
    { name: 'Cilt bakımı', category: 'Cilt', durationText: '60' },
    { name: 'Kaş tasarımı', category: 'Güzellik', durationText: '30' },
    { name: 'Ağda', category: 'Vücut', durationText: '30' },
  ],
  nail_studio: [
    { name: 'Manikür', category: 'Tırnak', durationText: '45' },
    { name: 'Pedikür', category: 'Tırnak', durationText: '60' },
    { name: 'Kalıcı oje', category: 'Tırnak', durationText: '60' },
  ],
  spa: [
    { name: 'Klasik masaj', category: 'Masaj', durationText: '60' },
    { name: 'Köpük masajı', category: 'Hammam', durationText: '45' },
  ],
  massage: [
    { name: 'Klasik masaj', category: 'Klasik', durationText: '60' },
    { name: 'Aromaterapi masajı', category: 'Aromaterapi', durationText: '60' },
  ],
  tattoo_piercing: [
    { name: 'Küçük dövme', category: 'Dövme', durationText: '90' },
    { name: 'Kulak piercing', category: 'Piercing', durationText: '20' },
  ],
  aesthetic_clinic: [
    { name: 'Ön görüşme', category: 'Muayene', durationText: '30' },
    { name: 'Cilt bakımı', category: 'Medikal cilt', durationText: '45' },
  ],
  dentist: [
    { name: 'Muayene', category: 'Muayene', durationText: '30' },
    { name: 'Diş beyazlatma', category: 'Estetik', durationText: '60' },
  ],
  hair_transplant: [
    { name: 'Ön görüşme', category: 'Konsültasyon', durationText: '30' },
    { name: 'Kontrol', category: 'Kontrol', durationText: '20' },
  ],
}
export const suggestionsFor = (businessType: string): Suggestion[] => (Object.hasOwn(SUGGESTIONS, businessType) ? SUGGESTIONS[businessType] : [])

/** Fiyatı satıcı bilir: öneri fiyatsız gelir, kullanıcı yazmadan hizmet kaydedilmez. */
export function pickToServiceValues(pick: PickedService): ServiceValues {
  return { name: pick.name, category: pick.category, durationText: pick.durationText, priceText: pick.priceText, bufferText: '0', isOnlineBookable: true, isActive: true }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function validateInvite(values: InviteValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = values.fullName.trim()
  if (name.length < 2 || name.length > 100) errors.fullName = 'Ad soyadı 2 ile 100 karakter arasında yazın.'
  if (!EMAIL_RE.test(values.email.trim())) errors.email = 'E-posta adresini kontrol edin. Örnek: ad@ornek.com'
  return errors
}

export type ReadyTask = { id: 'first-appointment' | 'copy-link' | 'review-hours'; label: string; href: string | null }
export function readyTasks(slug: string): ReadyTask[] {
  const base = `/panel/${encodeURIComponent(slug)}`
  return [
    { id: 'first-appointment', label: 'İlk randevuyu oluşturun', href: `${base}/takvim` },
    { id: 'copy-link', label: 'Randevu bağlantınızı kopyalayın', href: null },
    { id: 'review-hours', label: 'Çalışma saatlerini gözden geçirin', href: `${base}/ayarlar/calisma-saatleri` },
  ]
}
