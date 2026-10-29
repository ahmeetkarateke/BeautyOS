// İşletme türüne dayalı kararlar TEK yerde (hukuk-uyum §10.3, §10.7); terim setine değil işletme türüne bakar.
const CLINIC_MODE = new Set(['dentist', 'aesthetic_clinic'])
// Saç ekimi: şimdilik YALNIZ mesaj kuralı (müdür kararı); salon modunda kalır, klinik kısıtları uygulanmaz.
const HIDES_SERVICE_IN_MESSAGES = new Set([...CLINIC_MODE, 'hair_transplant'])

/** Klinik modu (2FA, fotoğraf/kampanya kısıtları, klinik notu, terimler): yalnız estetik kliniği ve diş kliniği. */
export function isClinicMode(businessType: string | null | undefined): boolean {
  return CLINIC_MODE.has(businessType ?? '')
}

/** Hazır mesajda, hatırlatmada ve SMS/WhatsApp metninde hizmet adı geçmez: sağlık verisine dair çıkarım sağlar. */
export function hidesServiceInMessages(businessType: string | null | undefined): boolean {
  return HIDES_SERVICE_IN_MESSAGES.has(businessType ?? '')
}
