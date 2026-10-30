// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient } from './api-client'

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function setup(handler: Handler) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return handler(String(url), init ?? {})
  })
  const onSessionExpired = vi.fn()
  const onSubscriptionRequired = vi.fn()
  const client = createApiClient({
    baseUrl: 'https://api.test',
    fetchImpl: fetchImpl as unknown as typeof fetch,
    onSessionExpired,
    onSubscriptionRequired,
  })
  return { client, calls, onSessionExpired, onSubscriptionRequired }
}

const auth = (init: RequestInit) => (init.headers as Record<string, string>)?.Authorization
const unauthorized = () => json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } })

describe('apiClient: oturum yenileme (ADR-UI-11)', () => {
  it('K1: eşzamanlı 5 adet 401 tek yenileme çağrısı yapar ve beşi de yeni token ile tekrarlanır', async () => {
    let refreshCalls = 0
    const { client, calls } = setup((url, init) => {
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls++
        return json(200, { token: 'yeni' })
      }
      return auth(init) === 'Bearer yeni' ? json(200, { ok: true }) : unauthorized()
    })
    client.setAccessToken('eski')
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => client.request<{ ok: boolean }>(`/api/v1/customers?i=${i}`)))
    expect(results).toEqual(Array(5).fill({ ok: true }))
    expect(refreshCalls).toBe(1)
    expect(calls.filter((c) => !c.url.includes('/auth/refresh'))).toHaveLength(10)
    expect(client.getAccessToken()).toBe('yeni')
  })

  it('K1: yenileme başarısız olursa token silinir, süre dolduğu bir kez bildirilir ve istekler UNAUTHORIZED ile reddedilir', async () => {
    const { client, onSessionExpired } = setup((url) =>
      url.endsWith('/auth/refresh') ? json(401, { error: { code: 'INVALID_TOKEN', message: 'x' } }) : unauthorized(),
    )
    client.setAccessToken('eski')
    const results = await Promise.allSettled([client.request('/api/v1/a'), client.request('/api/v1/b')])
    for (const r of results) {
      expect(r.status).toBe('rejected')
      expect((r as PromiseRejectedResult).reason).toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    }
    expect(client.getAccessToken()).toBeNull()
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('ADR-UI-11: tekrarlanan istek yine 401 verirse döngüye girmez (en çok bir yenileme)', async () => {
    let refreshCalls = 0
    const { client } = setup((url) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++
        return json(200, { token: 'yeni' })
      }
      return unauthorized()
    })
    client.setAccessToken('eski')
    await expect(client.request('/api/v1/a')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    expect(refreshCalls).toBe(1)
  })

  it('ADR-UI-11: giriş uçlarında 401 yanlış şifredir; yenileme denenmez', async () => {
    const { client, calls } = setup(() => json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'x' } }))
    await expect(client.request('/api/v1/auth/login', { method: 'POST', body: { email: 'a', password: 'b' } })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    })
    expect(calls).toHaveLength(1)
  })

  it('ADR-UI-11: sayfa açılışında restoreSession refresh çağırır ve token bellekte tutulur', async () => {
    const { client, calls } = setup(() => json(200, { token: 'acilis' }))
    expect(await client.restoreSession()).toBe(true)
    expect(client.getAccessToken()).toBe('acilis')
    expect(calls[0].url).toBe('https://api.test/api/v1/auth/refresh')
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.credentials).toBe('include')
  })

  it('ADR-UI-11: oturum yoksa restoreSession false döner ve süre doldu bildirimi yapmaz (ilk açılış)', async () => {
    const { client, onSessionExpired } = setup(unauthorized)
    expect(await client.restoreSession()).toBe(false)
    expect(client.getAccessToken()).toBeNull()
    expect(onSessionExpired).not.toHaveBeenCalled()
  })
})

describe('apiClient: token saklama (K2)', () => {
  it('K2: token localStorage ve sessionStorage a yazılmaz', async () => {
    const storage = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() }
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', storage)
    const { client } = setup(() => json(200, { token: 'gizli-token' }))
    await client.restoreSession()
    client.setAccessToken('baska-token')
    expect(storage.setItem).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('apiClient: hata zarfı ve metinler', () => {
  it('ADR-UI-11: sunucu mesajı gösterilmez; userMessage code dan Türkçe gelir', async () => {
    const { client } = setup(() => json(409, { error: { code: 'DUPLICATE_PHONE', message: 'Customer with this tenant phone exists' } }))
    const error = await client.request('/api/v1/customers', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('DUPLICATE_PHONE')
    expect((error as ApiError).userMessage).toContain('Bu telefon numarasıyla kayıtlı bir müşteri var.')
    expect((error as ApiError).userMessage).not.toMatch(/tenant|Customer/)
  })

  it('ADR-UI-11: 402 SUBSCRIPTION_REQUIRED ayrılır ve abonelik yönlendirmesi tetiklenir', async () => {
    const { client, onSubscriptionRequired } = setup(() => json(402, { error: { code: 'SUBSCRIPTION_REQUIRED', message: 'x' } }))
    await expect(client.request('/api/v1/customers')).rejects.toMatchObject({ status: 402, code: 'SUBSCRIPTION_REQUIRED' })
    expect(onSubscriptionRequired).toHaveBeenCalledTimes(1)
  })

  it('ADR-UI-11: 429 RATE_LIMIT retryAfterSec i gövdeden ya da Retry-After başlığından alır', async () => {
    const a = setup(() => json(429, { error: { code: 'RATE_LIMIT', message: 'x', retryAfterSec: 900 } }))
    await expect(a.client.request('/api/v1/x')).rejects.toMatchObject({ status: 429, code: 'RATE_LIMIT', retryAfterSec: 900 })
    const b = setup(() => json(429, { error: { code: 'RATE_LIMIT', message: 'x' } }, { 'retry-after': '60' }))
    await expect(b.client.request('/api/v1/x')).rejects.toMatchObject({ retryAfterSec: 60 })
  })

  it('ADR-UI-11: ağ hatası "Failed to fetch" göstermez; NETWORK koduyla Bağlantı kurulamadı metni verir', async () => {
    const { client } = setup(() => {
      throw new TypeError('Failed to fetch')
    })
    const error = (await client.request('/api/v1/x').catch((e: unknown) => e)) as ApiError
    expect(error.code).toBe('NETWORK')
    expect(error.status).toBe(0)
    expect(error.userMessage).toContain('Bağlantı kurulamadı.')
    expect(error.userMessage).not.toContain('Failed')
  })

  it('ADR-UI-11: bilinmeyen kod ve zarfsız gövde genel hata metnine düşer', async () => {
    const { client } = setup(() => json(500, { error: 'Unauthorized' }))
    const error = (await client.request('/api/v1/x').catch((e: unknown) => e)) as ApiError
    expect(error.code).toBe('UNKNOWN')
    expect(error.userMessage).toContain('Beklenmeyen bir sorun oluştu.')
  })

  it('ADR-UI-11: INTERNAL_ERROR yanıtındaki istek numarası referans olarak metne girer', async () => {
    const { client } = setup(() => json(500, { error: { code: 'INTERNAL_ERROR', message: 'x' } }, { 'x-request-id': 'req-123' }))
    const error = (await client.request('/api/v1/x').catch((e: unknown) => e)) as ApiError
    expect(error.userMessage).toContain('Referans: req-123')
  })
})

describe('apiClient: istek biçimi', () => {
  it('ADR-UI-11: JSON gövde, Bearer başlığı, credentials include ve sorgu parametreleri', async () => {
    const { client, calls } = setup(() => json(200, { ok: 1 }))
    client.setAccessToken('t1')
    await client.request('/api/v1/customers', { method: 'POST', body: { name: 'Ayşe' }, query: { page: 2, q: 'ş ç', bos: undefined } })
    const { url, init } = calls[0]
    expect(url).toBe('https://api.test/api/v1/customers?page=2&q=%C5%9F+%C3%A7')
    expect(init.body).toBe('{"name":"Ayşe"}')
    expect(init.credentials).toBe('include')
    expect(auth(init)).toBe('Bearer t1')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('ADR-UI-11: 204 ve boş gövde undefined döner', async () => {
    const { client } = setup(() => new Response(null, { status: 204 }))
    expect(await client.request('/api/v1/x', { method: 'DELETE' })).toBeUndefined()
  })
})

describe('apiClient: yenilemesiz uçlar açık liste (denetim W5-1 Önemli)', () => {
  it('ADR-UI-11: /auth/me 401 verince oturum yenilenir ve istek tekrarlanır', async () => {
    let refreshCalls = 0
    const { client } = setup((url, init) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++
        return json(200, { token: 'yeni' })
      }
      return auth(init) === 'Bearer yeni' ? json(200, { role: 'owner' }) : unauthorized()
    })
    client.setAccessToken('eski')
    await expect(client.request('/api/v1/auth/me')).resolves.toEqual({ role: 'owner' })
    expect(refreshCalls).toBe(1)
  })

  it.each(['login', 'register', 'refresh', 'forgot-password', 'reset-password', 'admin-login', 'logout'])(
    'ADR-UI-11: /auth/%s 401 verince yenileme denenmez',
    async (name) => {
      const { client, calls } = setup(() => unauthorized())
      await expect(client.request(`/api/v1/auth/${name}`, { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 })
      expect(calls).toHaveLength(1)
    },
  )

  it('W28-1: 401 INVALID_PASSWORD yanlış şifredir; oturum yenilenmez, istek tekrarlanmaz', async () => {
    let refreshCalls = 0
    const { client, calls } = setup((url) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++
        return json(200, { token: 'yeni' })
      }
      return json(401, { error: { code: 'INVALID_PASSWORD', message: 'x' } })
    })
    client.setAccessToken('gecerli')
    await expect(client.request('/api/v1/tenants/salon/users/u1/password', { method: 'PATCH', body: {} })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_PASSWORD',
    })
    expect(refreshCalls).toBe(0)
    expect(calls).toHaveLength(1)
  })

  it('ADR-UI-11: 429 yanıtında sunucunun kendi hata kodu ezilmez', async () => {
    const { client } = setup(() => json(429, { error: { code: 'TENANT_DAILY_LIMIT', message: 'x' } }))
    await expect(client.request('/api/v1/public/book', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 429, code: 'TENANT_DAILY_LIMIT' })
  })

  it('ADR-UI-11: 429 yanıtında kod yoksa RATE_LIMIT olur', async () => {
    const { client } = setup(() => json(429, {}))
    await expect(client.request('/api/v1/x')).rejects.toMatchObject({ status: 429, code: 'RATE_LIMIT' })
  })
})
