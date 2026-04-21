'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Scissors } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { OnboardingProgress } from './OnboardingProgress'
import { Step1Salon } from './steps/Step1Salon'
import { Step2Services } from './steps/Step2Services'
import { Step3Staff } from './steps/Step3Staff'
import { Step4WhatsApp } from './steps/Step4WhatsApp'
import { Step5Done } from './steps/Step5Done'

const STEP_TITLES = [
  'Salon Bilgileri',
  'İlk Hizmeti Ekle',
  'İlk Personeli Ekle',
  'WhatsApp Bağlantısı',
  'Hazır!',
]

const STEP_DESCRIPTIONS = [
  'Salonunuzun temel bilgilerini girin',
  'Sunduğunuz hizmetleri ekleyin',
  'Personelinizi sisteme kaydedin',
  'Müşterilerinize WhatsApp bildirimi gönderin',
  'Kurulumunuz tamamlandı',
]

export default function OnboardingPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted)
  const [hydrated, setHydrated] = useState(false)
  const [step, setStep] = useState(1)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!token) {
      router.replace('/login')
      return
    }
    if (onboardingCompleted && user) {
      router.replace(`/tenant/${user.tenantSlug}/dashboard`)
    }
  }, [hydrated, token, onboardingCompleted, user, router])

  if (!hydrated || !token || !user) return null

  const slug = user.tenantSlug

  function next() {
    setStep((s) => Math.min(s + 1, 5))
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-3 shadow-md">
            <Scissors className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">BeautyOS Kurulum</h1>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <OnboardingProgress step={step} totalSteps={5} />
        </div>

        {/* Step card */}
        <div className="bg-white rounded-xl border border-salon-border shadow-card p-6">
          {step < 5 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">{STEP_TITLES[step - 1]}</h2>
              <p className="text-sm text-salon-muted mt-0.5">{STEP_DESCRIPTIONS[step - 1]}</p>
            </div>
          )}

          {step === 1 && <Step1Salon slug={slug} onNext={next} />}
          {step === 2 && <Step2Services slug={slug} onNext={next} onBack={back} />}
          {step === 3 && <Step3Staff slug={slug} onNext={next} onBack={back} />}
          {step === 4 && <Step4WhatsApp onNext={next} onBack={back} />}
          {step === 5 && <Step5Done slug={slug} />}
        </div>
      </div>
    </div>
  )
}
