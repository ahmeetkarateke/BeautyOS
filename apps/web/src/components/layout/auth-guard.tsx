'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted)
  const hasHydrated = useAuthStore((s) => s._hasHydrated)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!hasHydrated) return
    if (!token) {
      router.push('/login')
      return
    }
    if (!onboardingCompleted && !pathname.startsWith('/onboarding')) {
      router.push('/onboarding')
    }
  }, [hasHydrated, token, onboardingCompleted, pathname, router])

  if (!hasHydrated) return null
  if (!token) return null
  if (!onboardingCompleted && !pathname.startsWith('/onboarding')) return null

  return <>{children}</>
}
