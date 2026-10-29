'use client'

import { useSyncExternalStore } from 'react'

// Ekran genişliği sorgusu. matchMedia yoksa (test, eski tarayıcı) false: telefon düzeni varsayılır.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}
