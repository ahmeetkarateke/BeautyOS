/** Veritabanindaki BusinessType degerleri (Prisma enum ile ayni olmali; esitlik testi apps/api'de). */
export const BUSINESS_TYPES = [
  'dentist',
  'aesthetic_clinic',
  'beauty_center',
  'hair_salon',
  'barbershop',
  'spa',
  'nail_studio',
  'massage',
  'tattoo_piercing',
  'hair_transplant',
  'other',
] as const

export type BusinessType = (typeof BUSINESS_TYPES)[number]

// Saglik mevzuatina tabi turler (hukuk-uyum 10.7): bildirim ve SMS metninde hizmet adi gecmez.
const HEALTH_REGULATED: ReadonlySet<string> = new Set<BusinessType>(['aesthetic_clinic', 'dentist', 'hair_transplant'])

/**
 * Isletme turu saglik mevzuatina tabi mi? Buyuk/kucuk harf donusumu yapilmaz: deger Prisma enum degeridir, tam eslesir
 * (bilinmeyen, bos ve string olmayan degerler false).
 */
export function isHealthRegulated(businessType: unknown): boolean {
  return typeof businessType === 'string' && HEALTH_REGULATED.has(businessType)
}
