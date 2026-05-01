'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Scissors, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { MouseOrbs } from '@/components/ui/mouse-orbs'

const schema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin'),
})
type FormData = z.infer<typeof schema>

const CUBIC: [number, number, number, number] = [0.23, 1, 0.32, 1]

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: FormData) =>
      apiFetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => setSent(true),
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center relative overflow-hidden px-6 py-12">
      <MouseOrbs />

      <div
        className="fixed inset-0 pointer-events-none z-[1]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
          backgroundRepeat: 'repeat',
          opacity: 0.4,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: CUBIC }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold text-base">BeautyOS</span>
          </div>
        </div>

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
          {sent ? (
            <div className="text-center py-4">
              <div className="flex justify-center mb-4">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
              </div>
              <h1 className="text-xl font-bold text-white mb-2">Mail Gönderildi</h1>
              <p className="text-white/50 text-sm mb-6">
                Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Giriş sayfasına dön
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-xl font-bold text-white">Şifremi Unuttum</h1>
                <p className="text-white/40 text-sm mt-1">E-postanı gir, sana link gönderelim</p>
              </div>

              <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-4">
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
                      e.currentTarget.style.border = errors.email
                        ? '1px solid rgba(239,68,68,0.6)'
                        : '1px solid rgba(255,255,255,0.10)'
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    }}
                  />
                  {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>}
                </div>

                {error && (
                  <div
                    className="rounded-xl px-4 py-3"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
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
                      Link Gönder <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-center text-sm text-white/35 pt-1">
                  <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
                    ← Giriş sayfasına dön
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          © {new Date().getFullYear()} BeautyOS. Tüm hakları saklıdır.
        </p>
      </motion.div>
    </div>
  )
}
