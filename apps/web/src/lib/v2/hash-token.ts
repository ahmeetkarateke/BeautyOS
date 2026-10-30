'use client'

import { useEffect, useRef, useState } from 'react'

// ADR-0046: gizli bağlantılarda belirteç URL'nin # parçasındadır (sunucu günlüğüne ve Referer'a düşmez).
// Sayfa onu okur, hemen adres çubuğundan siler ve YALNIZ bellekte tutar; localStorage/sessionStorage kullanılmaz.

/**
 * # parçasını okur ve adresten siler. Boş ya da yoksa null. Yüzde kodu çözülmez: belirteç olduğu gibi sunucuya gider.
 * `legacyQueryParam`: sunucu bağlantıyı # yerine ?param= ile gönderiyorsa (şifre sıfırlama e-postaları) geçici geri dönüş; o da adresten silinir.
 */
export function takeHashToken(legacyQueryParam?: string): string | null {
  const { hash, pathname, search } = window.location
  if (hash !== '') {
    window.history.replaceState(null, '', pathname + search)
    return hash.length > 1 ? hash.slice(1) : null
  }
  if (!legacyQueryParam) return null
  const params = new URLSearchParams(search)
  const token = params.get(legacyQueryParam)
  if (token === null) return null
  params.delete(legacyQueryParam)
  const rest = params.toString()
  window.history.replaceState(null, '', pathname + (rest ? `?${rest}` : ''))
  return token === '' ? null : token
}

export type HashTokenState = { status: 'reading' } | { status: 'missing' } | { status: 'ready'; token: string }

/** Belirteci bir kez alır. StrictMode'un çift efekti aynı sonucu kullanır (ikinci okuma hash'i artık bulamaz). */
export function useHashToken(legacyQueryParam?: string): HashTokenState {
  const [state, setState] = useState<HashTokenState>({ status: 'reading' })
  const taken = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (taken.current === undefined) taken.current = takeHashToken(legacyQueryParam)
    const token = taken.current
    setState(token ? { status: 'ready', token } : { status: 'missing' })
  }, [legacyQueryParam])
  return state
}
