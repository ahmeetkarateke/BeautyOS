'use client'

import { useRouter } from 'next/navigation'
import { useEffect, use } from 'react'

// Eski URL — Ayarlar → Modüller sekmesine yönlendir.
export default function ModulesRedirectPage(props: { params: Promise<{ slug: string }> }) {
  const params = use(props.params)
  const router = useRouter()
  useEffect(() => {
    router.replace(`/tenant/${params.slug}/settings?tab=modules`)
  }, [router, params.slug])
  return null
}
