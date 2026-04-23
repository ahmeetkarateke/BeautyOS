'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
})

type LoginForm = z.infer<typeof loginSchema>

interface LoginResponse {
  token: string
  user: {
    id: string
    email: string
    name: string
    role: string
    tenantSlug: string
  }
}

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Scissors className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">BeautyOS</h1>
          <p className="text-sm text-salon-muted mt-1">Salon yönetim platformu</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">Giriş Yap</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@salon.com"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  error={errors.password?.message}
                  {...register('password')}
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm text-red-600">
                    {error instanceof Error ? error.message : 'Bir sorun oluştu, lütfen tekrar deneyin.'}
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" loading={isPending}>
                Giriş Yap
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-salon-muted mt-6">
          © {new Date().getFullYear()} BeautyOS. Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  )
}
