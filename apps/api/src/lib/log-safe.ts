// Log'a yazilan hata nesneleri tek yerden temizlenir (KVKK, proje kurali 7). Axios hatalari istek URL'sini (bot jetonu),
// govdeyi (ad, telefon) ve basliklari; Prisma hatalari ise mesajlarinda arguman degerlerini tasir.

const MAX_MESSAGE = 300

/** Serbest metindeki bilinen sir kaliplarini maskeler: bot jetonu, ?key=/token= degerleri, e-posta, uzun rakam dizileri (telefon). */
export function scrubText(input: string): string {
  return input
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[gizli]')
    .replace(/([?&;]|\b)(key|token|apikey|api_key|access_token|secret|password)=[^&\s"']+/gi, '$1$2=[gizli]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, 'Bearer [gizli]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[e-posta]')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '[sayi]')
    .slice(0, MAX_MESSAGE)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Hata (ya da hata metni) icin log'a girebilecek guvenli ozet.
 * - Axios: yalniz { status, code, message }.
 * - Prisma: yalniz { type, code }; mesaj arguman degerlerini icerir, hic yazilmaz.
 * - Digeri: { type, message, stack } (hepsi scrubText'ten gecer).
 */
export function safeError(value: unknown): unknown {
  if (typeof value === 'string') return scrubText(value)
  if (!isRecord(value)) return value
  const name = typeof value.name === 'string' ? value.name : 'Error'
  const code = typeof value.code === 'string' ? value.code : undefined

  if (name.startsWith('PrismaClient')) {
    return { type: name, ...(code ? { code } : {}) }
  }

  if (value.isAxiosError === true) {
    const response = isRecord(value.response) ? value.response : undefined
    const status = typeof response?.status === 'number' ? response.status : undefined
    const message = typeof value.message === 'string' ? scrubText(value.message) : undefined
    return { ...(status !== undefined ? { status } : {}), ...(code ? { code } : {}), ...(message ? { message } : {}) }
  }

  if (value instanceof Error) {
    return {
      type: name,
      ...(code ? { code } : {}),
      message: scrubText(value.message),
      ...(value.stack ? { stack: value.stack.split('\n').slice(0, 8).map(scrubText).join('\n') } : {}),
    }
  }
  // Hata olmayan nesne (ornegin SDK'nin dondurdugu govde): icerigi kontrol edilemez, yalniz tur yazilir.
  return { type: name }
}

/** Ad, telefon, e-posta, jeton ve kimlik bilgisi alanlari her derinlikte (pino redact joker yolu bir seviyedir) silinir. */
export const REDACT_KEYS = [
  'phone', 'from', 'to', 'msisdn', 'recipient', 'chatId',
  'fullName', 'customerName', 'email', 'text', 'message_text', 'body',
  'password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'resetToken',
  'authorization', 'cookie', 'otp',
] as const

export const REDACT_PATHS: string[] = [
  ...REDACT_KEYS,
  ...REDACT_KEYS.map((key) => `*.${key}`),
  ...REDACT_KEYS.map((key) => `*.*.${key}`),
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
]
