import { toNationalDigits } from '@/ui/phone'

// Salon rengi sunucudan gelir ve stile yazılır: yalnız #rrggbb kabul edilir (CSS enjeksiyonu olmaz).
export function safeBrandColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null
}

/** Slot kimliği salon duvar saatidir ("2026-11-02T09:30:00"); saat dilimi dönüşümü yapılmadan okunur. */
export function slotLabel(slotId: string): string {
  return slotId.slice(11, 16)
}

export function slotDate(slotId: string): string {
  return slotId.slice(0, 10)
}

export type InfoValues = { fullName: string; phone: string }

export function validateInfo(values: InfoValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = values.fullName.trim()
  if (name.length < 2 || name.length > 100) errors.fullName = 'Adınızı ve soyadınızı yazın.'
  else if (/[<>]/.test(name)) errors.fullName = 'Adda < ve > karakterleri kullanılamaz.'
  if (toNationalDigits(values.phone).length !== 10) errors.phone = 'Telefon numaranızı 10 haneli yazın (5xx xxx xx xx).'
  return errors
}

export function validateCode(code: string): string | null {
  return /^\d{6}$/.test(code) ? null : '6 haneli kodu yazın.'
}

export type DoneCopy = { title: string; lead: string }

/** Onay metni sunucunun söylediğine göre seçilir: onay bekleyen randevuya "alındı" denmez. SMS vaadi yazılmaz (kurucu kararı 5). */
export function doneCopy(approvalRequired: boolean): DoneCopy {
  return approvalRequired
    ? { title: 'Randevu talebiniz alındı', lead: 'Salon onayladığında randevunuz kesinleşir. Onay için salon sizi arayabilir.' }
    : { title: 'Randevunuz alındı', lead: 'Randevu bilgileriniz aşağıda. Değiştirmek ya da iptal etmek için bağlantıyı kullanın.' }
}

/**
 * Salona gönderilecek hazır mesaj. Sağlık mevzuatına tabi işletmelerde (klinik, saç ekimi) hizmet adı geçmez (sağlık verisi çıkarımı).
 * Bayrak yoksa (eski yanıt) de geçmez: yalnız açıkça false ise yazılır.
 */
export function shareMessage(input: { salonName: string; referenceCode: string; when: string; serviceName?: string; isHealthRegulated?: boolean }): string {
  const what = input.isHealthRegulated === false && input.serviceName ? ` (${input.serviceName})` : ''
  return `Merhaba, ${input.salonName} için ${input.when} tarihli randevum${what} hakkında yazıyorum. Referans kodu: ${input.referenceCode}`
}

/** API telefonu 0 önekli ulusal biçimde bekler; doğrulama ve randevu isteklerinde aynı değer kullanılır. */
export function apiPhone(nationalDigits: string): string {
  return `0${nationalDigits}`
}

export type BookFailure = { step: 'time' | 'info' | 'verify' | 'stay'; clearSlot: boolean }

/** Randevu isteği hata kodundan, kullanıcının geri götürüleceği adımı seçer. */
export function bookFailure(code: string): BookFailure {
  switch (code) {
    case 'SLOT_TAKEN':
    case 'INVALID_SLOT':
    case 'PAST_TIME':
    case 'TOO_SOON_FOR_APPROVAL':
      return { step: 'time', clearSlot: true }
    case 'PHONE_NOT_VERIFIED':
      return { step: 'verify', clearSlot: false }
    case 'INVALID_PHONE':
      return { step: 'info', clearSlot: false }
    default:
      return { step: 'stay', clearSlot: false }
  }
}

const MANAGE_TEXTS: Record<string, string> = {
  BOOKING_NOT_FOUND: 'Randevu bağlantısı geçersiz ya da süresi dolmuş.',
  MODIFY_WINDOW_CLOSED: 'Randevuya 2 saatten az kaldı. Değişiklik için salonu arayın.',
  BOOKING_NOT_MODIFIABLE: 'Bu randevu artık değiştirilemez. Salonu arayın.',
  BOOKING_DISABLED: 'Salon şu an online randevu almıyor. Yeni saat için salonu arayın.',
  TOO_SOON: 'Seçtiğiniz saat çok yakın. Daha ileri bir saat seçin.',
  INVALID_SLOT: 'Seçtiğiniz saat uygun değil. Başka bir saat seçin.',
  SLOT_TAKEN: 'Bu saat doldu. Başka bir saat seçin.',
}

export function manageErrorText(code: string): string | null {
  return Object.hasOwn(MANAGE_TEXTS, code) ? MANAGE_TEXTS[code] : null
}

export function icsFileName(referenceCode: string): string {
  return `randevu-${referenceCode.replace(/[^A-Za-z0-9-]/g, '')}.ics`
}
