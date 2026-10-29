'use client'

import { createContext, use } from 'react'
import type { ReactNode } from 'react'
import type { ApiClient } from './api-client'

// Oturumun apiClient'ı React ağacına buradan verilir. İstemci tek örnektir (token bellekte, tek yenileme sözü);
// ekranlar `createApiClient` çağırmaz, `useApiClient()` kullanır.
const ApiClientContext = createContext<ApiClient | null>(null)

export function ApiClientProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiClientContext value={client}>{children}</ApiClientContext>
}

export function useApiClient(): ApiClient {
  const client = use(ApiClientContext)
  if (!client) throw new Error('useApiClient, ApiClientProvider içinde kullanılmalıdır.')
  return client
}

/** Çıkış: sunucuda oturumu kapatır (başarısız olsa da yerel token silinir) ve giriş ekranına götürür. */
export async function signOut(client: ApiClient, navigate: (path: string) => void = (path) => window.location.assign(path)) {
  try {
    await client.request('/api/v1/auth/logout', { method: 'POST' })
  } catch {
    // Ağ yoksa bile yerel oturum kapanır; çerez süresiyle kendiliğinden biter.
  }
  client.setAccessToken(null)
  navigate('/login')
}
