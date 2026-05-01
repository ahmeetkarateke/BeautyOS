'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'
import { Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const signupSchema = z
  .object({
    salonName: z.string().min(2, 'En az 2 karakter'),
    slug: z
      .string()
      .min(2, 'En az 2 karakter')
      .max(50, 'En fazla 50 karakter')
      .regex(/^[a-z0-9-]+$/, 'Sadece küçük harf, rakam ve tire kullanın'),
    fullName: z.string().min(2, 'En az 2 karakter'),
    email: z.string().email('Geçerli bir e-posta adresi girin'),
    password: z.string().min(8, 'En az 8 karakter'),
    confirmPassword: z.string().min(1, 'Şifre tekrarını girin'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Şifreler eşleşmiyor',
    path: ['confirmPassword'],
  })

type SignupForm = z.infer<typeof signupSchema>

interface RegisterResponse {
  token: string
  user: {
    id: string
    email: string
    name: string
    role: string
    tenantSlug: string
  }
}

export default function SignupPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [apiError, setApiError] = useState('')
  const slugEdited = useRef(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      salonName: '',
      slug: '',
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const salonName = watch('salonName')
  const slug = watch('slug')

  useEffect(() => {
    if (!slugEdited.current && salonName) {
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
          fullName: data.fullName,
          email: data.email,
          password: data.password,
        }),
      }),
    onSuccess: async (data) => {
      setApiError('')
      setAuth(data.user, data.token)
      try {
        await apiFetch(`/api/v1/tenants/${data.user.tenantSlug}/settings`)
      } catch {
        // ignore
      }
      router.push('/onboarding')
    },
    onError: (err: Error) => {
      setApiError(err.message)
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
            <CardTitle className="text-center text-xl">Ücretsiz Başla</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((data) => {
                setApiError('')
                mutate(data)
              })}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="salonName">Salon Adı</Label>
                <Input
                  id="salonName"
                  placeholder="Bella Güzellik Salonu"
                  error={errors.salonName?.message}
                  {...register('salonName')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug">Salon Adresi (Slug)</Label>
                <Input
                  id="slug"
                  placeholder="bella-guzellik"
                  error={errors.slug?.message}
                  {...register('slug', {
                    onChange: () => {
                      slugEdited.current = true
                    },
                  })}
                />
                {slug && !errors.slug && (
                  <p className="text-xs text-salon-muted">
                    beautyos.app/tenant/<span className="font-medium text-primary">{slug}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fullName">Ad Soyad</Label>
                <Input
                  id="fullName"
                  placeholder="Ayşe Yılmaz"
                  error={errors.fullName?.message}
                  {...register('fullName')}
                />
              </div>

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
                  placeholder="En az 8 karakter"
                  autoComplete="new-password"
                  error={errors.password?.message}
                  {...register('password')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />
              </div>

              {apiError && (
                <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm text-red-600">{apiError}</p>
                </div>
              )}

              <Button type="submit" className="w-full" loading={isPending}>
                Hesap Oluştur
              </Button>

              <p className="text-center text-sm text-salon-muted">
                Hesabın var mı?{' '}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Giriş yap
                </Link>
              </p>
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
