'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Scissors, ArrowRight, ArrowLeft, Building2, User, Eye, EyeOff, Check } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { MouseOrbs } from '@/components/ui/mouse-orbs'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const signupSchema = z
  .object({
    salonName: z.string().min(2, 'En az 2 karakter'),
    slug: z.string().min(2, 'En az 2 karakter').max(50, 'En fazla 50 karakter').regex(/^[a-z0-9-]+$/, 'Sadece küçük harf, rakam ve tire'),
    fullName: z.string().min(2, 'En az 2 karakter'),
    phone: z.string().regex(/^[0-9+\s()-]{7,20}$/, 'Geçerli bir telefon numarası girin').optional().or(z.literal('')),
    email: z.string().email('Geçerli bir e-posta adresi girin'),
    password: z.string().min(8, 'En az 8 karakter'),
    confirmPassword: z.string().min(1, 'Şifre tekrarını girin'),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'Şifreler eşleşmiyor', path: ['confirmPassword'] })

type SignupForm = z.infer<typeof signupSchema>

interface RegisterResponse {
  token: string
  user: { id: string; email: string; name: string; role: string; tenantSlug: string }
}

const CUBIC: [number, number, number, number] = [0.23, 1, 0.32, 1]

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: CUBIC } },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.25 } }),
}

const AuthInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: string; label: string; suffix?: React.ReactNode }
>(function AuthInput({ error, label, suffix, ...props }, ref) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-white/60 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          ref={ref}
          {...props}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e) }}
          className="w-full h-11 rounded-xl px-4 text-sm text-white placeholder-white/25 outline-none transition-all duration-200"
          style={{
            background: focused ? 'rgba(107,72,255,0.08)' : 'rgba(255,255,255,0.05)',
            border: error
              ? '1px solid rgba(239,68,68,0.6)'
              : focused
              ? '1px solid rgba(107,72,255,0.7)'
              : '1px solid rgba(255,255,255,0.10)',
            boxShadow: focused && !error ? '0 0 0 3px rgba(107,72,255,0.15)' : 'none',
            paddingRight: suffix ? '2.75rem' : undefined,
          }}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
})

export default function SignupPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [apiError, setApiError] = useState('')
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { salonName: '', slug: '', fullName: '', phone: '', email: '', password: '', confirmPassword: '' },
  })

  const salonName = watch('salonName')

  useEffect(() => {
    if (salonName) {
      setValue('slug', slugify(salonName), { shouldValidate: false })
    }
  }, [salonName, setValue])

  const { mutate, isPending } = useMutation({
    mutationFn: (data: SignupForm) =>
      apiFetch<RegisterResponse>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          salonName: data.salonName,
          slug: data.slug,
          ownerFullName: data.fullName,
          ...(data.phone ? { phone: data.phone } : {}),
          email: data.email,
          password: data.password,
        }),
      }),
    onSuccess: async (data) => {
      setApiError('')
      setAuth(data.user, data.token)
      try { await apiFetch(`/api/v1/tenants/${data.user.tenantSlug}/settings`) } catch { /* ignore */ }
      router.push('/onboarding')
    },
    onError: (err: Error) => setApiError(err.message),
  })

  const goNext = async () => {
    const valid = await trigger(['salonName'])
    if (valid) { setDirection(1); setStep(2) }
  }

  const goBack = () => { setDirection(-1); setStep(1) }

  return (
    <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center relative overflow-hidden px-6 py-12">
      <MouseOrbs />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2.5 mb-8"
        >
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_16px_rgba(107,72,255,0.5)]">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-base">BeautyOS</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: CUBIC, delay: 0.08 }}
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
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-7">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300"
                    style={{
                      background: s < step ? '#6B48FF' : s === step ? 'rgba(107,72,255,0.2)' : 'rgba(255,255,255,0.06)',
                      border: s === step ? '1px solid rgba(107,72,255,0.7)' : s < step ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      color: s <= step ? 'white' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {s < step ? <Check className="w-3 h-3" /> : s}
                  </div>
                  {s < 2 && (
                    <div
                      className="h-px flex-1 transition-all duration-500"
                      style={{ background: step > 1 ? '#6B48FF' : 'rgba(255,255,255,0.08)' }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                {step === 1 ? (
                  <Building2 className="w-4 h-4 text-primary" />
                ) : (
                  <User className="w-4 h-4 text-primary" />
                )}
                <p className="text-xs text-primary font-medium uppercase tracking-wider">
                  {step === 1 ? 'Adım 1 / 2' : 'Adım 2 / 2'}
                </p>
              </div>
              <h1 className="text-xl font-bold text-white">
                {step === 1 ? 'Salonunuzu tanıtalım' : 'Hesap bilgileri'}
              </h1>
              <p className="text-white/40 text-sm mt-1">
                {step === 1 ? 'Salonunuza bir isim verin' : 'Giriş için kullanacağınız bilgiler'}
              </p>
            </div>

            <form onSubmit={handleSubmit((data) => { setApiError(''); mutate(data) })}>
              <AnimatePresence mode="wait" custom={direction}>
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-4"
                  >
                    <AuthInput
                      label="Salon Adı"
                      placeholder="Bella Güzellik Salonu"
                      error={errors.salonName?.message}
                      {...register('salonName')}
                    />

                    <button
                      type="button"
                      onClick={goNext}
                      className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 mt-2"
                      style={{
                        background: 'linear-gradient(135deg, #6B48FF 0%, #8B68FF 100%)',
                        boxShadow: '0 0 24px rgba(107,72,255,0.35)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 32px rgba(107,72,255,0.55)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 0 24px rgba(107,72,255,0.35)' }}
                    >
                      Devam Et <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="space-y-4"
                  >
                    <AuthInput
                      label="Ad Soyad"
                      placeholder="Ayşe Yılmaz"
                      error={errors.fullName?.message}
                      {...register('fullName')}
                    />
                    <AuthInput
                      label="Telefon (İsteğe bağlı)"
                      type="tel"
                      placeholder="0532 000 00 00"
                      autoComplete="tel"
                      error={errors.phone?.message}
                      {...register('phone')}
                    />
                    <AuthInput
                      label="E-posta"
                      type="email"
                      placeholder="ornek@salon.com"
                      autoComplete="email"
                      error={errors.email?.message}
                      {...register('email')}
                    />
                    <AuthInput
                      label="Şifre"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="En az 8 karakter"
                      autoComplete="new-password"
                      error={errors.password?.message}
                      {...register('password')}
                      suffix={
                        <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-white/30 hover:text-white/70 transition-colors">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />
                    <AuthInput
                      label="Şifre Tekrar"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      error={errors.confirmPassword?.message}
                      {...register('confirmPassword')}
                      suffix={
                        <button type="button" onClick={() => setShowConfirm((v) => !v)} className="text-white/30 hover:text-white/70 transition-colors">
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />

                    {apiError && (
                      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <p className="text-sm text-red-400">{apiError}</p>
                      </div>
                    )}

                    <div className="flex gap-3 mt-2">
                      <button
                        type="button"
                        onClick={goBack}
                        className="h-11 px-4 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-colors flex items-center gap-1.5 flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <ArrowLeft className="w-4 h-4" /> Geri
                      </button>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="flex-1 h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200"
                        style={{
                          background: isPending ? 'rgba(107,72,255,0.5)' : 'linear-gradient(135deg, #6B48FF 0%, #8B68FF 100%)',
                          boxShadow: isPending ? 'none' : '0 0 24px rgba(107,72,255,0.35)',
                        }}
                        onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.boxShadow = '0 0 32px rgba(107,72,255,0.55)' }}
                        onMouseLeave={(e) => { if (!isPending) e.currentTarget.style.boxShadow = '0 0 24px rgba(107,72,255,0.35)' }}
                      >
                        {isPending ? (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <>Hesap Oluştur <ArrowRight className="w-4 h-4" /></>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="text-center text-sm text-white/35 mt-5">
                Hesabın var mı?{' '}
                <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
                  Giriş yap
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
