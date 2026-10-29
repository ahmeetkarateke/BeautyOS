// Açılış ortam kontrolü (G5-K1, G5-K2). Hata mesajlarına yalnız değişken ADI yazılır, değer asla.

export const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'ALLOWED_ORIGINS', 'PUBLIC_URL', 'FRONTEND_URL'] as const
export const MIN_JWT_SECRET_LENGTH = 32

/** Boşken kanalın kapalı kalacağı isteğe bağlı değişkenler. */
export const OPTIONAL_CHANNELS = [
  { variable: 'TELEGRAM_BOT_TOKEN', channel: 'Telegram' },
  { variable: 'NETGSM_USERCODE', channel: 'NetGSM SMS' },
  { variable: 'RESEND_API_KEY', channel: 'Resend e-posta' },
] as const

type Env = Record<string, string | undefined>

export interface EnvReport {
  /** Eksik ya da boş zorunlu değişken adları. */
  missing: string[]
  /** JWT_SECRET gibi uzunluk kuralını karşılamayan değişken adları. */
  weak: string[]
  /** Boş olduğu için kapalı kalan kanalların değişken adları. */
  disabled: string[]
}

const isBlank = (value: string | undefined): boolean => (value ?? '').trim().length === 0

export function checkEnv(env: Env, isProduction: boolean): EnvReport {
  const missing = isProduction ? REQUIRED_IN_PRODUCTION.filter((name) => isBlank(env[name])) : []
  const weak = isProduction && !isBlank(env.JWT_SECRET) && (env.JWT_SECRET ?? '').length < MIN_JWT_SECRET_LENGTH ? ['JWT_SECRET'] : []
  const disabled = OPTIONAL_CHANNELS.filter((c) => isBlank(env[c.variable])).map((c) => c.variable)
  return { missing, weak, disabled }
}

/** Başlatmayı durdurması gereken sorunların kısa, değer içermeyen açıklaması; sorun yoksa null. */
export function describeEnvProblems(report: EnvReport): string | null {
  const parts = [
    report.missing.length ? `eksik: ${report.missing.join(', ')}` : '',
    report.weak.length ? `${MIN_JWT_SECRET_LENGTH} karakterden kısa: ${report.weak.join(', ')}` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' | ') : null
}
