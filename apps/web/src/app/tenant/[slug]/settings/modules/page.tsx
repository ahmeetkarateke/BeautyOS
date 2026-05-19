'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Eski URL — Ayarlar → Modüller sekmesine yönlendir.
export default function ModulesRedirectPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  useEffect(() => {
    router.replace(`/tenant/${params.slug}/settings?tab=modules`)
  }, [router, params.slug])
  return null
}
