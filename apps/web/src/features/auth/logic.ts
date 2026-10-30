// Giriş, kayıt ve şifre ekranlarının saf mantığı. Kurallar sunucudaki zod şemalarıyla aynı sınırları kullanır
// (auth.route.ts); sunucu yine de doğrular, burada amaç kullanıcıya anlaşılır Türkçe hata vermektir.

export type BusinessTypeOption = { id: string; label: string }

// tasarim.md §7: 6 tür; ilk beşi doğrudan enum değeridir, "Diğer" alt tür sorar. Klinik modu estetik ve diş içindir (business-type.ts).
export const MAIN_BUSINESS_TYPES: readonly BusinessTypeOption[] = [
  { id: 'hair_salon', label: 'Kuaför' },
  { id: 'barbershop', label: 'Berber' },
  { id: 'beauty_center', label: 'Güzellik merkezi' },
  { id: 'aesthetic_clinic', label: 'Estetik kliniği' },
  { id: 'dentist', label: 'Diş hekimi' },
  { id: 'other', label: 'Diğer randevulu işletme' },
]

// "Diğer" altında sorulan alan (prototip). Saç ekimi şimdilik salon modunda kalır (business-type.ts).
export const OTHER_BUSINESS_TYPES: readonly BusinessTypeOption[] = [
  { id: 'nail_studio', label: 'Tırnak stüdyosu' },
  { id: 'spa', label: 'Spa ve güzellik merkezi' },
  { id: 'massage', label: 'Masaj salonu' },
  { id: 'tattoo_piercing', label: 'Dövme ve piercing' },
  { id: 'hair_transplant', label: 'Saç ekim merkezi' },
  { id: 'beauty_center', label: 'Başka' },
]

const MAIN_IDS = new Set(MAIN_BUSINESS_TYPES.filter((t) => t.id !== 'other').map((t) => t.id))
const OTHER_IDS = new Set(OTHER_BUSINESS_TYPES.map((t) => t.id))

/** Seçimi API enum değerine çevirir. Bilinmeyen değer istemciden sunucuya geçmez. */
export function resolveBusinessType(main: string, other?: string): string {
  if (MAIN_IDS.has(main)) return main
  return other !== undefined && OTHER_IDS.has(other) ? other : 'beauty_center'
}

// Türk I'sı: toLowerCase('İ') birleşik nokta üretir; Türkçe harfler önce açıkça eşlenir, sonra dil bağımsız küçültülür.
const TR_MAP: Record<string, string> = { ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i', I: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u' }
const SLUG_MAX = 30

/** İşletme adından adres önerisi üretir. */
export function slugify(name: string): string {
  const ascii = Array.from(name, (ch) => TR_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
  return ascii
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '')
}

export function validateSlug(slug: string): string | null {
  if (slug.length < 3) return 'Adres en az 3 karakter olmalı.'
  if (slug.length > SLUG_MAX) return `Adres en çok ${SLUG_MAX} karakter olabilir.`
  if (!/^[a-z0-9-]+$/.test(slug)) return 'Adreste yalnız küçük harf, rakam ve tire kullanabilirsiniz.'
  if (slug.startsWith('-') || slug.endsWith('-')) return 'Adres tire ile başlayıp bitemez.'
  return null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(email: string): string | null {
  const value = email.trim()
  if (!value) return 'E-posta adresini yazın.'
  return EMAIL_RE.test(value) ? null : 'E-posta adresi geçerli görünmüyor. Örnek: ad@ornek.com'
}

/** Yeni şifre kuralı sunucudaki strongPassword ile aynıdır. */
export function validateNewPassword(password: string): string | null {
  if (password.length < 8) return 'Şifre en az 8 karakter olmalı.'
  if (password.length > 128) return 'Şifre en çok 128 karakter olabilir.'
  if (!/[a-zA-Z]/.test(password)) return 'Şifrede en az bir harf olmalı.'
  if (!/[0-9]/.test(password)) return 'Şifrede en az bir rakam olmalı.'
  return null
}

type Errors = Record<string, string>

function collect(entries: [string, string | null][]): Errors {
  const errors: Errors = {}
  for (const [field, message] of entries) if (message) errors[field] = message
  return errors
}

/** Girişte şifre kuralı denetlenmez: eski hesapların şifresi bugünkü kurala uymayabilir. */
export function validateLogin(v: { email: string; password: string }): Errors {
  return collect([
    ['email', validateEmail(v.email)],
    ['password', v.password ? null : 'Şifrenizi yazın.'],
  ])
}

const minChars = (value: string, min: number, message: string) => (value.trim().length >= min ? null : message)

export type Step1 = { salonName: string; slug: string; type: string; otherType: string }
export type Step2 = { fullName: string; phone: string; email: string; password: string; acceptTerms: boolean; marketingOptIn: boolean }

export function validateStep1(v: Step1): Errors {
  return collect([
    ['salonName', minChars(v.salonName, 2, 'İşletme adı en az 2 karakter olmalı.')],
    ['slug', validateSlug(v.slug)],
    ['type', v.type ? null : 'İşletme türünü seçin.'],
  ])
}

export function validateStep2(v: Step2): Errors {
  return collect([
    ['fullName', minChars(v.fullName, 2, 'Ad soyad en az 2 karakter olmalı.')],
    ['phone', /^5\d{9}$/.test(v.phone) ? null : 'Telefon numarasını 5xx xxx xx xx biçiminde yazın.'],
    ['email', validateEmail(v.email)],
    ['password', validateNewPassword(v.password)],
    ['acceptTerms', v.acceptTerms ? null : 'Devam etmek için kullanım şartları ve gizlilik belgelerini kabul etmelisiniz.'],
  ])
}

export type RegisterBody = {
  salonName: string
  slug: string
  ownerFullName: string
  phone: string
  email: string
  password: string
  businessType: string
  // Yeni arayüz rızaları HER ZAMAN gönderir (alan yoksa sunucu eski arayüz sayar ve kabul kaydı yazmaz). K1 zorunlu, K3 yalnız işaretliyse.
  consents: { terms: true; marketingEmail?: true }
}

export function toRegisterBody(step1: Step1, step2: Step2): RegisterBody {
  return {
    salonName: step1.salonName.trim(),
    slug: step1.slug,
    ownerFullName: step2.fullName.trim(),
    phone: `+90${step2.phone}`,
    email: step2.email.trim(),
    password: step2.password,
    businessType: resolveBusinessType(step1.type, step1.otherType),
    consents: { terms: true, ...(step2.marketingOptIn ? { marketingEmail: true as const } : {}) },
  }
}

/** Giriş/kayıt sonrası iniş yolu. Salon kısaltması yalnız ipucudur; kiracıyı sunucu belirler. */
export function panelPathFor(slug: string): string {
  return `/panel/${encodeURIComponent(slug)}/bugun`
}
