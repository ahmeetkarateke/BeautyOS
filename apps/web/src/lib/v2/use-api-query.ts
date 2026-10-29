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

type Result<T> = { id: string; data?: T; error?: ApiError; loadedAt?: Date }

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

  const requestId = key === null ? null : `${key}#${attempt}`

  useEffect(() => {
    if (requestId === null) return
    const controller = new AbortController()
    fetcherRef
      .current(client, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ id: requestId, data, loadedAt: new Date() })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        // Önceki başarılı veri korunur: hata bloğu son yükleme saatini yazabilsin.
        setResult((previous) => ({ id: requestId, data: previous?.data, loadedAt: previous?.loadedAt, error: toApiError(error) }))
      })
    return () => controller.abort()
  }, [client, requestId])

  const refetch = useCallback(() => setAttempt((n) => n + 1), [])
  const settled = result !== null && result.id === requestId

  return {
    data: result?.data,
    error: settled ? result.error : undefined,
    loading: requestId !== null && !settled,
    loadedAt: result?.loadedAt,
    refetch,
  }
}
