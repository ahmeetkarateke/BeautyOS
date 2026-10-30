import { errorText, NETWORK_ERROR, type ErrorContext } from '@/content/errors'

// v2 API istemcisi (ADR-UI-11). Erişim token'ı YALNIZ bellekte tutulur (localStorage/sessionStorage yok);
// sayfa açılışında `restoreSession` HttpOnly yenileme çerezi ile yeni token alır. Eşzamanlı 401'ler tek yenilemeyi bekler.

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfterSec?: number
  readonly requestId?: string
  readonly details?: unknown
  private readonly context: ErrorContext

  constructor(init: { status: number; code: string; retryAfterSec?: number; requestId?: string; details?: unknown }) {
    // `message` teknik kalır (log için); kullanıcıya yalnız userMessage gösterilir.
    super(`${init.status} ${init.code}`)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.retryAfterSec = init.retryAfterSec
    this.requestId = init.requestId
    this.details = init.details
    this.context = { retryAfterSec: init.retryAfterSec, reference: init.requestId }
  }

  /** Kullanıcıya gösterilecek Türkçe metin. Bağlam (ör. 'login', 'trial') gerektiğinde verilir. */
  text(context?: ErrorContext): string {
    return this.code === 'NETWORK' ? NETWORK_ERROR : errorText(this.code, { ...this.context, ...context })
  }

  get userMessage(): string {
    return this.text()
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
}

export type ApiClientConfig = {
  baseUrl: string
  fetchImpl?: typeof fetch
  /** Yenileme de başarısız olunca (oturum gerçekten bitti) bir kez çağrılır. */
  onSessionExpired?: () => void
  /** 402 SUBSCRIPTION_REQUIRED alındığında. */
  onSubscriptionRequired?: () => void
}

const REFRESH_PATH = '/api/v1/auth/refresh'
// Bu uçlarda 401 "yanlış şifre / geçersiz bağlantı / çıkış" demektir; oturum yenilemesi denenmez.
// Açık liste: /auth/me burada DEĞİLDİR (süresi dolan token ile çağrılır, yenilenmesi gerekir).
const NO_REFRESH_PATHS: readonly string[] = ['login', 'register', 'refresh', 'forgot-password', 'reset-password', 'admin-login', 'logout', 'invitations/lookup', 'invitations/accept'].map(
  (name) => `/api/v1/auth/${name}`,
)
const isAuthPath = (path: string) => NO_REFRESH_PATHS.some((p) => path === p || path.startsWith(`${p}?`))

export function createApiClient(config: ApiClientConfig) {
  const doFetch = config.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  let accessToken: string | null = null
  let refreshing: Promise<boolean> | null = null

  function buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = `${config.baseUrl}${path}`
    if (!query) return url
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value))
    const qs = params.toString()
    return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url
  }

  async function send(path: string, options: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = {}
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    try {
      return await doFetch(buildUrl(path, options.query), {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: 'include',
        signal: options.signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new ApiError({ status: 0, code: 'NETWORK' })
    }
  }

  /** Tek uçuş: aynı anda gelen tüm 401'ler aynı sözü bekler. */
  function refreshToken(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const res = await doFetch(`${config.baseUrl}${REFRESH_PATH}`, { method: 'POST', credentials: 'include' })
        if (!res.ok) return false
        const data = (await res.json()) as { token?: unknown }
        if (typeof data.token !== 'string') return false
        accessToken = data.token
        return true
      } catch {
        return false
      }
    })().finally(() => {
      refreshing = null
    })
    return refreshing
  }

  async function toError(res: Response): Promise<ApiError> {
    const body = (await res.json().catch(() => null)) as { error?: { code?: unknown; retryAfterSec?: unknown; details?: unknown } } | null
    const envelope = body && typeof body.error === 'object' && body.error !== null ? body.error : null
    let code = envelope && typeof envelope.code === 'string' ? envelope.code : 'UNKNOWN'
    let retryAfterSec = envelope && typeof envelope.retryAfterSec === 'number' ? envelope.retryAfterSec : undefined
    if (res.status === 429) {
      if (code === 'UNKNOWN') code = 'RATE_LIMIT'
      const header = Number(res.headers.get('retry-after'))
      if (retryAfterSec === undefined && Number.isFinite(header) && header > 0) retryAfterSec = header
    }
    return new ApiError({
      status: res.status,
      code,
      retryAfterSec,
      requestId: res.headers.get('x-request-id') ?? undefined,
      details: envelope?.details,
    })
  }

  async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    let res = await send(path, options)

    if (res.status === 401 && !isAuthPath(path)) {
      if (await refreshToken()) {
        res = await send(path, options)
      } else {
        accessToken = null
        notifySessionExpiredOnce()
        throw new ApiError({ status: 401, code: 'UNAUTHORIZED' })
      }
    }

    if (!res.ok) {
      const error = await toError(res)
      if (error.status === 402 && error.code === 'SUBSCRIPTION_REQUIRED') config.onSubscriptionRequired?.()
      throw error
    }
    if (res.status === 204) return undefined as T
    const text = await res.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  // Aynı anda başarısız olan birkaç istek süre doldu bildirimini bir kez tetikler.
  let expiredNotified = false
  function notifySessionExpiredOnce() {
    if (expiredNotified) return
    expiredNotified = true
    config.onSessionExpired?.()
  }

  return {
    request,
    setAccessToken(token: string | null) {
      accessToken = token
      if (token) expiredNotified = false
    },
    getAccessToken: () => accessToken,
    /** Sayfa açılışı: çerezden yeni token almayı dener. Oturum yoksa false (süre doldu bildirimi yapmaz). */
    async restoreSession(): Promise<boolean> {
      const ok = await refreshToken()
      if (ok) expiredNotified = false
      return ok
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
