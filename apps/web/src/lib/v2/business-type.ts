// İşletme türüne dayalı sağlık düzenlemesi kararı TEK yerde (hukuk-uyum §10.3, §10.7). Terim setine değil işletme türüne bakar.
// Bu türlerde hizmet adı sağlık verisine dair çıkarım sağlar: hazır mesajda, bildirimlerde ve (ileride) SMS'te yer almaz.
const HEALTH_REGULATED = new Set(['dentist', 'aesthetic_clinic', 'hair_transplant'])

export function isHealthRegulated(businessType: string | null | undefined): boolean {
  return HEALTH_REGULATED.has(businessType ?? '')
}
