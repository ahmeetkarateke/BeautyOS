'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { apiFetch } from '@/lib/api'

interface Step5DoneProps {
  slug: string
}

export function Step5Done({ slug }: Step5DoneProps) {
  const router = useRouter()
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)
  const [saving, setSaving] = useState(false)

  async function handleDashboard() {
    setSaving(true)
    try {
      await apiFetch(`/api/v1/tenants/${slug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ onboardingCompleted: true }),
      })
    } catch {
      // non-critical
    }
    completeOnboarding()
    router.push(`/tenant/${slug}/dashboard`)
  }

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-6">
      {/* Animated check */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="relative"
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #6B48FF, #FF6B8A)',
            boxShadow: '0 0 40px rgba(107,72,255,0.5)',
          }}
        >
          <motion.svg
            className="w-10 h-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
          >
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            />
          </motion.svg>
        </div>
        {/* Pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: '2px solid rgba(107,72,255,0.4)' }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.45 }}
        className="space-y-2"
      >
        <h2 className="text-2xl font-bold text-white">Salonunuz hazır!</h2>
        <p className="text-white/40 text-sm max-w-xs">
          Tebrikler! Temel kurulumu tamamladınız. Dashboard&apos;dan randevularınızı, hizmetlerinizi ve personelinizi yönetebilirsiniz.
        </p>
      </motion.div>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-wrap justify-center gap-2"
      >
        {['Takvim', 'CRM', 'WhatsApp AI', 'Finans', 'Prim Takibi'].map((f) => (
          <span
            key={f}
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(107,72,255,0.12)', border: '1px solid rgba(107,72,255,0.25)', color: 'rgba(139,104,255,1)' }}
          >
            {f}
          </span>
        ))}
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        onClick={handleDashboard}
        disabled={saving}
        className="h-12 px-8 rounded-xl text-sm font-semibold text-white flex items-center gap-2.5 transition-all duration-200"
        style={{
          background: saving ? 'rgba(107,72,255,0.4)' : 'linear-gradient(135deg, #6B48FF 0%, #8B68FF 100%)',
          boxShadow: saving ? 'none' : '0 0 28px rgba(107,72,255,0.4)',
        }}
        onMouseEnter={(e) => { if (!saving) e.currentTarget.style.boxShadow = '0 0 36px rgba(107,72,255,0.6)' }}
        onMouseLeave={(e) => { if (!saving) e.currentTarget.style.boxShadow = '0 0 28px rgba(107,72,255,0.4)' }}
      >
        {saving ? (
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        Dashboard&apos;a Git
      </motion.button>
    </div>
  )
}
