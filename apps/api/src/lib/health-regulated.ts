// Sağlık mevzuatına tabi işletme türleri (hukuk-uyum §10.7): bu türlerde SMS ve bildirim
// metinlerinde hizmet adı geçmez (özel nitelikli kişisel veri çıkarımı).
// Geçici yer: packages/shared'e taşınacak (müdür kararı, A8). Büyük/küçük harf dönüşümü yapılmaz:
// tür Prisma enum değeridir, tam eşleşir.
const HEALTH_REGULATED_TYPES: ReadonlySet<string> = new Set(['aesthetic_clinic', 'dentist', 'hair_transplant'])

export function isHealthRegulated(businessType: string | null | undefined): boolean {
  return businessType != null && HEALTH_REGULATED_TYPES.has(businessType)
}
