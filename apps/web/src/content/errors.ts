// API hata kodu -> kullanıcıya gösterilen Türkçe metin (metin-rehberi.md §4.1, §4.7, §4.8, §6).
// Sunucunun `message` alanı kullanıcıya hiç gösterilmez; yalnız `code` ve bağlam okunur.

export const GENERIC_ERROR = 'Beklenmeyen bir sorun oluştu. Birkaç dakika sonra tekrar deneyin. Sürerse destek ekibine yazın.'
export const NETWORK_ERROR = 'Bağlantı kurulamadı. Değişiklikler kaydedilmedi. Bağlantınızı kontrol edip tekrar deneyin.'

export type ErrorContext = {
  /** Aynı kodun birden çok metni olduğunda hangisi (ör. 'password-reset', 'trial', 'login'). */
  context?: string
  /** Uzmanın adı; verilmezse "Seçilen uzman". */
  expert?: string
  /** INTERNAL_ERROR için istek numarası. */
  reference?: string
  /** Sunucunun bildirdiği gerçek bekleme süresi (saniye). */
  retryAfterSec?: number
}

type Entry = string | ((ctx: ErrorContext) => string) | { default: string; [context: string]: string }

const expertName = (ctx: ErrorContext) => ctx.expert ?? 'Seçilen uzman'

const INTERNAL = (ctx: ErrorContext) =>
  ctx.reference ? `${GENERIC_ERROR} Referans: ${ctx.reference}` : GENERIC_ERROR

const TEXTS: Record<string, Entry> = {
  VALIDATION_ERROR: 'Girdiğiniz bilgileri kontrol edin.',
  NOT_FOUND: 'Bu kayıt bulunamadı. Silinmiş olabilir.',
  UNAUTHORIZED: 'Oturumunuzun süresi doldu. Yeniden giriş yapın.',
  INVALID_TOKEN: {
    default: 'Oturumunuzun süresi doldu. Yeniden giriş yapın.',
    'password-reset': 'Bu bağlantının süresi dolmuş. Yeni bir bağlantı isteyin.',
  },
  FORBIDDEN: {
    default: 'Bu işlem için yetkiniz yok. Gerekiyorsa salon sahibinden yetki isteyin.',
    admin: 'Bu sayfa yalnız BeautyOS yönetimine açık.',
    tenant: 'Bu salona erişiminiz yok. Doğru hesapla giriş yaptığınızdan emin olun.',
  },
  TENANT_DELETED: 'Salon hesabınız aktif değil. Destek ekibine yazın.',
  SUBSCRIPTION_REQUIRED: {
    default: 'Deneme süreniz doldu. Devam etmek için bir plan seçin.',
    trial: 'Deneme süreniz doldu. Devam etmek için bir plan seçin.',
    inactive: 'Planınız aktif değil. Devam etmek için planınızı yenileyin.',
  },
  CONFIG_ERROR: GENERIC_ERROR,
  INTERNAL_ERROR: INTERNAL,
  RATE_LIMIT: rateLimitText,
  INVALID_CREDENTIALS: 'E-posta veya şifre hatalı.',
  DUPLICATE_EMAIL: 'Bu e-posta adresiyle kayıtlı bir hesap var. Giriş yapın ya da başka bir adres yazın.',
  DUPLICATE_SLUG: 'Bu salon adresi kullanımda. Başka bir adres deneyin.',
  DUPLICATE_PHONE: 'Bu telefon numarasıyla kayıtlı bir müşteri var.',
  INVITE_LIMIT: 'Günlük davet sınırına ulaşıldı. Yarın tekrar deneyin.',
  LEGAL_VERSION_MISMATCH: 'Kullanım şartları güncellendi. Sayfayı yenileyip tekrar deneyin.',
  INVITATION_INVALID: 'Bu bağlantı geçersiz ya da süresi dolmuş.',
  INVITATION_EMAIL_IN_USE: 'Bu e-posta adresi başka bir hesapta kayıtlı. Giriş yapmayı deneyin.',
  INVALID_ACCOUNT: 'Seçilen hesap bulunamadı. Hesabı yeniden seçin.',
  INVALID_CUSTOMER: 'Müşteri bulunamadı. Listeden yeniden seçin.',
  INVALID_SUPPLIER: 'Tedarikçi bulunamadı. Listeden yeniden seçin.',
  INVALID_INVENTORY: 'Seçilen ürün bulunamadı. Listeyi yenileyin.',
  INVALID_PASSWORD: 'Mevcut şifreniz hatalı. Tekrar deneyin.',
  INVALID_PHONE: 'Telefon numarası geçersiz. 5xx xxx xx xx biçiminde yazın.',
  PHONE_NOT_VERIFIED: 'Önce telefon numaranızı doğrulayın.',
  CAPTCHA_FAILED: 'Güvenlik doğrulaması tamamlanamadı. Sayfayı yenileyip tekrar deneyin.',
  BOOKING_DISABLED: 'Bu salon şu an online randevu almıyor. Salonu arayarak randevu alın.',
  PAST_TIME: 'Geçmiş bir saate randevu alınamaz. İleri bir saat seçin.',
  SLOT_TAKEN: 'Bu saat doldu. Başka bir saat seçin.',
  SLOT_CONFLICT: conflictText,
  APPOINTMENT_CONFLICT: conflictText,
  // Metin rehberinde henüz yok (teknik-yazar yok): W10 ile eklendi, denetçi/teknik-yazar onayına işaretli.
  NOT_PENDING: 'Bu talep artık onay beklemiyor. Listeyi yenileyin.',
  CUSTOMER_MATCH_REQUIRED: 'Bu telefonla kayıtlı bir müşteri var. Talebi onaylamadan önce kimle eşleşeceğini seçin.',
  CUSTOMER_PHONE_MISMATCH: 'Seçtiğiniz müşterinin telefonu talepteki telefonla aynı değil. Listeden başka bir müşteri seçin ya da yeni müşteri olarak ekleyin.',
  CUSTOMER_NOT_FOUND: 'Seçtiğiniz müşteri bulunamadı. Listeyi yenileyip yeniden seçin.',
  TENANT_DAILY_LIMIT: 'Online randevu şu an alınamıyor. Salonu arayarak randevu alın.',
  TOO_SOON_FOR_APPROVAL: 'Bu saat için online randevu alınamıyor. En az 3 saat sonrasını seçin ya da salonu arayın.',
  RANGE_TOO_LARGE: 'Seçilen tarih aralığı çok geniş. En çok 31 gün seçebilirsiniz.',
  INVALID_RANGE: 'Tarih aralığı geçersiz. Başlangıç tarihi bitişten önce olmalı.',
  STAFF_NOT_SKILLED: (ctx) => `${expertName(ctx)} bu hizmeti vermiyor. Başka bir uzman seçin.`,
  STATUS_LOCKED: {
    default: 'Bu kayıt artık işlem kabul etmiyor.',
    appointment: 'Tamamlanan veya iptal edilen randevu değiştirilemez.',
  },
  // Metin rehberinde yok: W16/W19 ile eklendi, denetçi/teknik-yazar onayına işaretli.
  DAY_CLOSED: 'Bu günün kasası kapatılmış. Sahip ya da müdür günü yeniden açtıktan sonra işlem yapılabilir.',
  DAY_NOT_CLOSED: 'Bu gün zaten açık.',
  NOT_COMPLETED: 'Bu randevu henüz tamamlanmadığı için ödeme düzeltmesi yapılamaz.',
  APPOINTMENT_LOCKED:'Tamamlanan veya “Gelmedi” işaretli randevu silinemez.',
  // Metin rehberinde yok: W26 ile eklendi, denetçi/teknik-yazar onayına işaretli.
  PACKAGE_IN_USE: 'Bu paketi kullanan etkin müşteri paketi var. Önce onları tamamlayın ya da iptal edin.',
  PACKAGE_NOT_ACTIVE: 'Bu paket aktif değil.',
  NO_SESSIONS_LEFT: 'Bu pakette kalan seans yok. Yeni paket satabilirsiniz.',
  PACKAGE_EXPIRED: 'Paketin süresi dolmuş.',
  ALREADY_POSTED: 'Bu fatura zaten işlenmiş. Değiştirilemez.',
  ALREADY_PAID: 'Bu ödeme zaten alınmış.',
  CANCELLED: 'İptal edilen kayıt için ödeme alınamaz.',
  INSUFFICIENT_STOCK: 'Stokta yeterli ürün yok. Çıkış miktarı mevcut stoktan fazla.',
  CONFLICT: {
    default: 'Bu işlem mevcut kayıtla çakışıyor. Listeyi yenileyip tekrar deneyin.',
    'service-product': 'Bu ürün bu hizmete zaten bağlı.',
    'tip-edit': 'Dağıtılmış bahşiş düzenlenemez.',
    'tip-delete': 'Dağıtılmış bahşiş silinemez.',
  },
}

function conflictText(ctx: ErrorContext): string {
  return `${expertName(ctx)} için bu saatte başka bir randevu var. Başka bir saat ya da uzman seçin.`
}

// §4.8: bağlama göre sabit süre; sunucu gerçek süreyi bildirirse o kullanılır.
const RATE_LIMITS: Record<string, string> = {
  login: 'Çok fazla yanlış giriş denemesi. 15 dakika sonra tekrar deneyin. Şifrenizi unuttuysanız “Şifremi unuttum”u kullanın.',
  register: 'Çok fazla kayıt denemesi yapıldı. 1 saat sonra tekrar deneyin.',
  booking: 'Çok fazla randevu denemesi yapıldı. 1 saat sonra tekrar deneyin.',
  'phone-verification': 'Çok fazla doğrulama isteği gönderildi. 1 saat sonra tekrar deneyin.',
  search: 'Çok hızlı işlem yapıyorsunuz. 1 dakika sonra tekrar deneyin.',
}

function waitText(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} saniye`
  if (seconds < 3600) return `${Math.round(seconds / 60)} dakika`
  return `${Math.round(seconds / 3600)} saat`
}

function rateLimitText(ctx: ErrorContext): string {
  if (ctx.retryAfterSec !== undefined) return `Çok fazla istek gönderildi. ${waitText(ctx.retryAfterSec)} sonra tekrar deneyin.`
  return (ctx.context && RATE_LIMITS[ctx.context]) || 'Çok fazla istek gönderildi. 15 dakika sonra tekrar deneyin.'
}

export const KNOWN_ERROR_CODES: readonly string[] = Object.keys(TEXTS)

export function errorText(code: string | undefined, ctx: ErrorContext = {}): string {
  const entry = code !== undefined && Object.hasOwn(TEXTS, code) ? TEXTS[code] : undefined
  if (entry === undefined) return GENERIC_ERROR
  if (typeof entry === 'string') return entry
  if (typeof entry === 'function') return entry(ctx)
  return (ctx.context !== undefined && Object.hasOwn(entry, ctx.context) ? entry[ctx.context] : undefined) ?? entry.default
}
