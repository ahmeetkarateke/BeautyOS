import { useAuthStore } from '../store/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://beautyosapi-production.up.railway.app'

let isRefreshing = false

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  _retry = false,
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('beautyos_token') : null

  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    credentials: 'include',
    ...options,
  })

  if (res.status === 402) {
    if (typeof window !== 'undefined') {
      const slug = useAuthStore.getState().user?.tenantSlug
      window.location.href = slug ? `/tenant/${slug}/subscription-required` : '/login'
    }
    throw new Error('SUBSCRIPTION_REQUIRED')
  }

  if (res.status === 429) {
    throw new Error('Çok fazla deneme, lütfen bir saat bekleyin.')
  }

  // Auth endpoint'leri (login/register/refresh/forgot/reset) için refresh denemesi yapma —
  // 401 burada "yanlış şifre" anlamında, "oturum süresi doldu" değil.
  const isAuthEndpoint = path.startsWith('/api/v1/auth/')

  if (res.status === 401 && !_retry && !isRefreshing && !isAuthEndpoint) {
    isRefreshing = true
    try {
      const refreshRes = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (refreshRes.ok) {
        const { token: newToken } = await refreshRes.json()
        localStorage.setItem('beautyos_token', newToken)
        isRefreshing = false
        return apiFetch<T>(path, options, true)
      }
    } catch {
      // network error during refresh — fall through to logout
    }
    isRefreshing = false
    useAuthStore.getState().logout()
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = body?.error?.message ?? body?.message ?? 'Bir sorun oluştu, lütfen tekrar deneyin.'
    throw new Error(message)
  }

  // 204 No Content veya boş body için JSON parse'a girme
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}
