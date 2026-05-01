'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Scissors, Zap, CalendarDays, TrendingUp, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { MouseOrbs } from '@/components/ui/mouse-orbs'

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
})

type LoginForm = z.infer<typeof loginSchema>

interface LoginResponse {
  token: string
  user: { id: string; email: string; name: string; role: string; tenantSlug: string }
}

const features = [
  { icon: Zap, label: 'WhatsApp AI', desc: 'Otomatik randevu & müşteri yanıtları' },
  { icon: CalendarDays, label: 'Akıllı Takvim', desc: 'Drag & drop randevu yönetimi' },
  { icon: TrendingUp, label: 'Prim Takibi', desc: 'Personel performansı & gelir analizi' },
]

const CUBIC: [number, number, number, number] = [0.23, 1, 0.32, 1]

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.08 } } },
  item: {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: CUBIC } },
  },
}

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: LoginForm) =>
      apiFetch<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: async (data) => {
      setAuth(data.user, data.token)
      try {
        const settings = await apiFetch<{ onboardingCompleted: boolean }>(
          `/api/v1/tenants/${data.user.tenantSlug}/settings`,
        )
        if (settings.onboardingCompleted) {
          completeOnboarding()
          router.push(`/tenant/${data.user.tenantSlug}/dashboard`)
        } else {
          router.push('/onboarding')
        }
      } catch {
        router.push('/onboarding')
      }
    },
  })

  return (
    <div className="min-h-screen bg-[#0D0D1A] flex relative overflow-hidden">
      <MouseOrbs />

      {/* Ince noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[1]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.03\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat', opacity: 0.4 }}
      />

      {/* Sol brand panel */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: CUBIC }}
        className="hidden lg:flex flex-col justify-between w-1/2 px-16 py-14 relative z-10"
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(107,72,255,0.5)]">
            <Scissors className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">BeautyOS</span>
        </div>

        {/* Ana içerik */}
        <motion.div variants={stagger.container} initial="initial" animate="animate">
          <motion.p variants={stagger.item} className="text-sm font-medium text-primary mb-4 tracking-widest uppercase">
            Türkiye&apos;nin #1 Salon Platformu
          </motion.p>
          <motion.h2
            variants={stagger.item}
            className="text-4xl xl:text-5xl font-bold text-white leading-[1.15] mb-6"
          >
            Salonunuzu geleceğe
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#6B48FF] to-[#FF6B8A]">
              taşıyın.
            </span>
          </motion.h2>
          <motion.p variants={stagger.item} className="text-white/50 text-base mb-12 max-w-sm leading-relaxed">
            WhatsApp AI, akıllı takvim ve otomatik prim takibi ile salonunuzu bir üst seviyeye çıkarın.
          </motion.p>

          <div className="space-y-4">
            {features.map((f) => (
              <motion.div key={f.label} variants={stagger.item} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{f.label}</p>
                  <p className="text-white/40 text-xs mt-0.5">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Alt trust */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <div className="flex -space-x-2">
            {['A', 'E', 'Z'].map((l, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full border-2 border-[#0D0D1A] flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: ['#6B48FF', '#FF6B8A', '#4F8EFF'][i] }}
              >
                {l}
              </div>
            ))}
          </div>
          <p className="text-white/40 text-xs">
            <span className="text-white/80 font-semibold">500+</span> salon güveniyor
          </p>
        </motion.div>
      </motion.div>

      {/* Sağ form panel */}
      <div className="flex flex-col justify-center items-center w-full lg:w-1/2 px-6 py-12 relative z-10">
        {/* Mobilde logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex lg:hidden items-center gap-2.5 mb-10"
        >
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-base">BeautyOS</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: CUBIC, delay: 0.1 }}
          className="w-full max-w-sm"
        >
          {/* Glass kart */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 8px 40px rgba(107, 72, 255, 0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div className="mb-7">
              <h1 className="text-xl font-bold text-white">Tekrar hoş geldin</h1>
              <p className="text-white/40 text-sm mt-1">Salonuna giriş yap</p>
            </div>

            <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider">E-posta</label>
                <input
                  type="email"
                  placeholder="ornek@salon.com"
                  autoComplete="email"
                  {...register('email')}
                  className="w-full h-11 rounded-xl px-4 text-sm text-white placeholder-white/25 outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: errors.email ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.10)',
                    boxShadow: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.border = '1px solid rgba(107,72,255,0.7)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,72,255,0.15)'
                    e.currentTarget.style.background = 'rgba(107,72,255,0.08)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.border = errors.email ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.10)'
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  }}
                />
                {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
              </div>

              {/* Şifre */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/60 uppercase tracking-wider">Şifre</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register('password')}
                    className="w-full h-11 rounded-xl px-4 pr-11 text-sm text-white placeholder-white/25 outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: errors.password ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.10)',
                      boxShadow: 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = '1px solid rgba(107,72,255,0.7)'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(107,72,255,0.15)'
                      e.currentTarget.style.background = 'rgba(107,72,255,0.08)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = errors.password ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.10)'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>}
                <div className="flex justify-end mt-1">
                  <Link href="/forgot-password" className="text-xs text-white/35 hover:text-primary transition-colors">
                    Şifremi unuttum
                  </Link>
                </div>
              </div>

              {error && (
                <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-sm text-red-400">
                    {error instanceof Error ? error.message : 'Bir sorun oluştu, lütfen tekrar deneyin.'}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 mt-2"
                style={{
                  background: isPending
                    ? 'rgba(107,72,255,0.5)'
                    : 'linear-gradient(135deg, #6B48FF 0%, #8B68FF 100%)',
                  boxShadow: isPending ? 'none' : '0 0 24px rgba(107,72,255,0.35)',
                }}
                onMouseEnter={(e) => {
                  if (!isPending) e.currentTarget.style.boxShadow = '0 0 32px rgba(107,72,255,0.55)'
                }}
                onMouseLeave={(e) => {
                  if (!isPending) e.currentTarget.style.boxShadow = '0 0 24px rgba(107,72,255,0.35)'
                }}
              >
                {isPending ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <>
                    Giriş Yap <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-center text-sm text-white/35 pt-1">
                Hesabın yok mu?{' '}
                <Link href="/signup" className="text-primary hover:text-primary/80 font-medium transition-colors">
                  Ücretsiz başla
                </Link>
              </p>
            </form>
          </div>

          <p className="text-center text-xs text-white/20 mt-6">
            © {new Date().getFullYear()} BeautyOS. Tüm hakları saklıdır.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
