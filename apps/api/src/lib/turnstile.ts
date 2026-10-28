// Cloudflare Turnstile doğrulaması. Token, bu ortamın izinli web adreslerinden birinde çözülmüş olmalı:
// staging ve canlı aynı widget'ı paylaşabilir, hostname denetimi bir ortamın token'ının ötekinde geçmesini engeller.

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function allowedTurnstileHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  const sources = [...(env.ALLOWED_ORIGINS?.split(',') ?? []), env.FRONTEND_URL ?? '']
  const hosts = new Set<string>()
  for (const raw of sources) {
    const value = raw.trim()
    if (!value) continue
    try {
      hosts.add(new URL(value).hostname.toLowerCase())
    } catch {
      // Geçersiz adres yok sayılır; liste boş kalırsa üretimde doğrulama başarısız olur.
    }
  }
  return [...hosts]
}

export async function verifyTurnstile(token: string | undefined, remoteIp: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Production'da CAPTCHA zorunlu — secret yoksa booking reddedilir
    return process.env.NODE_ENV !== 'production'
  }
  if (!token) return false
  try {
    const params = new URLSearchParams({ secret, response: token })
    if (remoteIp) params.set('remoteip', remoteIp)
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = (await res.json()) as { success?: boolean; hostname?: string }
    if (data.success !== true) return false

    const allowed = allowedTurnstileHosts()
    if (allowed.length === 0) return process.env.NODE_ENV !== 'production'
    return typeof data.hostname === 'string' && allowed.includes(data.hostname.toLowerCase())
  } catch {
    return false
  }
}
