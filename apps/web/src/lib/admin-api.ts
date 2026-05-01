import { useAdminStore } from '../store/admin'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://beautyosapi-production.up.railway.app'

export async function adminApiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('beautyos_admin_token') : null

  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    credentials: 'include',
    ...options,
  })

  if (res.status === 401) {
    useAdminStore.getState().logoutAdmin()
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login'
    }
    throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message =
      body?.error?.message ?? body?.message ?? 'Bir sorun oluştu, lütfen tekrar deneyin.'
    throw new Error(message)
  }

  return res.json()
}
