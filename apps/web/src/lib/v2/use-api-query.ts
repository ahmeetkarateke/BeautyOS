'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from './api-client'
import type { ApiClient } from './api-client'
import { useApiClient } from './api-context'

// Ekranların okuma çağrıları için küçük veri kancası (yükleniyor / hata / veri / yeniden dene).
// Anahtar (key) değişince yeni istek atılır; null anahtar isteği kapatır (izin yoksa çağrı yapılmaz).
// Yeniden denemede eski veri görünür kalır, `loading` true olur; sonuç yarış durumunda eski isteğe ait ise yok sayılır.
export type QueryState<T> = {
  data: T | undefined
  error: ApiError | undefined
  /** İstek sürüyor (ilk yükleme ya da yeniden deneme). Anahtar null ise false. */
  loading: boolean
  /** Son başarılı yükleme zamanı; hata bloğu "Son başarılı yükleme: 14:12" yazar. */
  loadedAt: Date | undefined
  refetch: () => void
}

// owner: sonucun ait olduğu sorgu anahtarı. Başka anahtarın verisi hiçbir zaman döndürülmez (yanlış dönemin tutarı sessizce görünmesin).
type Result<T> = { id: string; owner: string; data?: T; error?: ApiError; loadedAt?: Date }

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError({ status: 0, code: 'NETWORK' })
}

export function useApiQuery<T>(key: string | null, fetcher: (client: ApiClient, signal: AbortSignal) => Promise<T>): QueryState<T> {
  const client = useApiClient()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result<T> | null>(null)
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const scope = key ?? ''
  const requestId = key === null ? null : `${key}#${attempt}`

  useEffect(() => {
    if (requestId === null) return
    const controller = new AbortController()
    fetcherRef
      .current(client, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ id: requestId, owner: scope, data, loadedAt: new Date() })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // Aynı anahtarın önceki başarılı verisi korunur (hata bloğu son yükleme saatini yazabilsin); başka anahtarınki korunmaz.
        setResult((previous) => {
          const same = previous?.owner === scope
          return { id: requestId, owner: scope, data: same ? previous.data : undefined, loadedAt: same ? previous.loadedAt : undefined, error: toApiError(error) }
        })
      })
    return () => controller.abort()
  }, [client, requestId, scope])

  const refetch = useCallback(() => setAttempt((n) => n + 1), [])
  const settled = result !== null && result.id === requestId
  const current = key !== null && result !== null && result.owner === scope ? result : null

  return {
    data: current?.data,
    error: settled ? result.error : undefined,
    loading: requestId !== null && !settled,
    loadedAt: current?.loadedAt,
    refetch,
  }
}
