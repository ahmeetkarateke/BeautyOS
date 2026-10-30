'use client'

import { useEffect, useRef, useState } from 'react'

// ADR-0046: gizli bağlantılarda belirteç URL'nin # parçasındadır (sunucu günlüğüne ve Referer'a düşmez).
// Sayfa onu okur, hemen adres çubuğundan siler ve YALNIZ bellekte tutar; localStorage/sessionStorage kullanılmaz.

/**
 * # parçasını okur ve adresten siler. Boş ya da yoksa null. Yüzde kodu çözülmez: belirteç olduğu gibi sunucuya gider.
 * Şifre sıfırlama e-postası `#token=<değer>` biçiminde gelir; `token=` öneki atılır. Sorgu (`?token=`) artık okunmaz: sunucu günlüğüne düşerdi.
 */
export function takeHashToken(): string | null {
  const { hash, pathname, search } = window.location
  if (hash === '') return null
  window.history.replaceState(null, '', pathname + search)
  const value = hash.slice(1).replace(/^token=/, '')
  return value === '' ? null : value
}

export type HashTokenState = { status: 'reading' } | { status: 'missing' } | { status: 'ready'; token: string }

/** Belirteci bir kez alır. StrictMode'un çift efekti aynı sonucu kullanır (ikinci okuma hash'i artık bulamaz). */
export function useHashToken(): HashTokenState {
  const [state, setState] = useState<HashTokenState>({ status: 'reading' })
  const taken = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (taken.current === undefined) taken.current = takeHashToken()
    const token = taken.current
    setState(token ? { status: 'ready', token } : { status: 'missing' })
  }, [])
  return state
}
