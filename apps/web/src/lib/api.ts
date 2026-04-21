const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://beautyosapi-production.up.railway.app'

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('beautyos_token') : null

  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Bir sorun oluştu, lütfen tekrar deneyin.' }))
    throw new Error(error.message ?? 'Bir sorun oluştu, lütfen tekrar deneyin.')
  }

  return res.json()
}
