'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'
import { apiFetch } from '@/lib/api'

interface Step5DoneProps {
  slug: string
}

export function Step5Done({ slug }: Step5DoneProps) {
  const router = useRouter()
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  async function handleDashboard() {
    setSaving(true)
    try {
      await apiFetch(`/api/v1/tenants/${slug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ onboardingCompleted: true }),
      })
    } catch {
      // non-critical — proceed anyway
    }
    completeOnboarding()
    router.push(`/tenant/${slug}/dashboard`)
  }

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-8">
      <div
        className="w-24 h-24 rounded-full bg-primary flex items-center justify-center shadow-lg transition-all duration-700 ease-out"
        style={{
          transform: visible ? 'scale(1)' : 'scale(0)',
          opacity: visible ? 1 : 0,
        }}
      >
        <svg
          className="w-12 h-12 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
            style={{
              strokeDasharray: 30,
              strokeDashoffset: visible ? 0 : 30,
              transition: 'stroke-dashoffset 0.5s ease-out 0.3s',
            }}
          />
        </svg>
      </div>

      <div
        className="space-y-2 transition-all duration-500 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          transitionDelay: '0.4s',
        }}
      >
        <h2 className="text-2xl font-semibold text-gray-900">Salonunuz hazır!</h2>
        <p className="text-salon-muted text-sm max-w-xs">
          Tebrikler! Temel kurulumu tamamladınız. Dashboard&apos;dan randevularınızı,
          hizmetlerinizi ve personelinizi yönetebilirsiniz.
        </p>
      </div>

      <div
        className="transition-all duration-500 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transitionDelay: '0.6s',
        }}
      >
        <Button size="lg" onClick={handleDashboard} disabled={saving}>
          Dashboard&apos;a Git
        </Button>
      </div>
    </div>
  )
}
