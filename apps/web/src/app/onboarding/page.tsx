'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Scissors } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { MouseOrbs } from '@/components/ui/mouse-orbs'
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

const CUBIC: [number, number, number, number] = [0.23, 1, 0.32, 1]

export default function OnboardingPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted)
  const [hydrated, setHydrated] = useState(false)
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)

  useEffect(() => { setHydrated(true) }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!token) { router.replace('/login'); return }
    if (onboardingCompleted && user) router.replace(`/tenant/${user.tenantSlug}/dashboard`)
  }, [hydrated, token, onboardingCompleted, user, router])

  if (!hydrated || !token || !user) return null

  const slug = user.tenantSlug

  function next() { setDirection(1); setStep((s) => Math.min(s + 1, 5)) }
  function back() { setDirection(-1); setStep((s) => Math.max(s - 1, 1)) }

  return (
    <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center p-4 relative overflow-hidden">
      <MouseOrbs />

      <div className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: CUBIC }}
          className="flex items-center justify-center gap-2.5 mb-8"
        >
          <div
            className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center"
            style={{ boxShadow: '0 0 20px rgba(107,72,255,0.5)' }}
          >
            <Scissors className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">BeautyOS Kurulum</span>
        </motion.div>

        {/* Progress */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mb-6"
        >
          <OnboardingProgress step={step} totalSteps={5} />
        </motion.div>

        {/* Glass card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: CUBIC }}
          className="rounded-2xl p-6 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 8px 40px rgba(107, 72, 255, 0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {/* Step header */}
          {step < 5 && (
            <div className="mb-5">
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-1">
                Adım {step} — {STEP_TITLES[step - 1]}
              </p>
              <p className="text-white/40 text-sm">{STEP_DESCRIPTIONS[step - 1]}</p>
            </div>
          )}

          {/* Step content with slide animation */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.35, ease: CUBIC } }}
              exit={{ opacity: 0, x: direction > 0 ? -30 : 30, transition: { duration: 0.22 } }}
            >
              {step === 1 && <Step1Salon slug={slug} onNext={next} />}
              {step === 2 && <Step2Services slug={slug} onNext={next} onBack={back} />}
              {step === 3 && <Step3Staff slug={slug} onNext={next} onBack={back} />}
              {step === 4 && <Step4WhatsApp onNext={next} onBack={back} />}
              {step === 5 && <Step5Done slug={slug} />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
