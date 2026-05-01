'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminStore } from '@/store/admin'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const adminToken = useAdminStore((s) => s.adminToken)
  const hasHydrated = useAdminStore((s) => s._hasHydrated)
  const router = useRouter()

  useEffect(() => {
    if (!hasHydrated) return
    if (!adminToken) {
      router.push('/admin/login')
    }
  }, [hasHydrated, adminToken, router])

  if (!hasHydrated) return null
  if (!adminToken) return null
  return <>{children}</>
}
