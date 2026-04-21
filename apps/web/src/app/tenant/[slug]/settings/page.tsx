'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Building2, Lock, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/components/ui/toaster'

interface PageProps {
  params: { slug: string }
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const salonSchema = z.object({
  name: z.string().min(2, 'En az 2 karakter giriniz'),
  phone: z.string().min(7, 'Geçerli bir telefon numarası giriniz'),
  address: z.string().min(5, 'Adres en az 5 karakter olmalıdır'),
  workingHours: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/, 'Format: HH:MM-HH:MM (örn: 09:00-19:00)'),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mevcut şifrenizi giriniz'),
    newPassword: z.string().min(8, 'Şifre en az 8 karakter olmalıdır'),
    confirmPassword: z.string().min(1, 'Şifreyi tekrar giriniz'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Şifreler eşleşmiyor',
    path: ['confirmPassword'],
  })

type SalonFormValues = z.infer<typeof salonSchema>
type PasswordFormValues = z.infer<typeof passwordSchema>

// ─── Tab nav ──────────────────────────────────────────────────────────────────

const tabs = [
  { id: 'salon', label: 'Salon Profili', icon: Building2 },
  { id: 'account', label: 'Hesabım', icon: Lock },
]

// ─── Salon settings form ──────────────────────────────────────────────────────

function SalonSettingsForm({ tenantSlug }: { tenantSlug: string }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SalonFormValues>({
    resolver: zodResolver(salonSchema),
    defaultValues: { name: '', phone: '', address: '', workingHours: '09:00-19:00' },
  })

  const mutation = useMutation({
    mutationFn: (values: SalonFormValues) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      }),
    onSuccess: () => toast('Salon bilgileri kaydedildi'),
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Salon Adı</Label>
        <Input id="name" placeholder="Demo Güzellik Salonu" error={errors.name?.message} {...register('name')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefon</Label>
        <Input id="phone" type="tel" placeholder="+90 555 000 00 00" error={errors.phone?.message} {...register('phone')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Adres</Label>
        <Input id="address" placeholder="İstanbul, Türkiye" error={errors.address?.message} {...register('address')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="workingHours">Çalışma Saatleri</Label>
        <Input id="workingHours" placeholder="09:00-19:00" error={errors.workingHours?.message} {...register('workingHours')} />
        <p className="text-xs text-salon-muted">Format: HH:MM-HH:MM (örnek: 09:00-19:00)</p>
      </div>

      <Button type="submit" disabled={mutation.isPending} className="gap-2">
        {mutation.isPending ? 'Kaydediliyor...' : (
          <>
            {mutation.isSuccess && <Check className="w-4 h-4" />}
            Değişiklikleri Kaydet
          </>
        )}
      </Button>
    </form>
  )
}

// ─── Password change form ─────────────────────────────────────────────────────

function PasswordForm({ tenantSlug }: { tenantSlug: string }) {
  const user = useAuthStore((s) => s.user)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  })

  const mutation = useMutation({
    mutationFn: (data: PasswordFormValues) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/users/${user?.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      }),
    onSuccess: () => {
      toast('Şifre güncellendi')
      reset()
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Mevcut Şifre</Label>
        <Input id="currentPassword" type="password" placeholder="••••••••" error={errors.currentPassword?.message} {...register('currentPassword')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Yeni Şifre</Label>
        <Input id="newPassword" type="password" placeholder="••••••••" error={errors.newPassword?.message} {...register('newPassword')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</Label>
        <Input id="confirmPassword" type="password" placeholder="••••••••" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
      </Button>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage({ params }: PageProps) {
  const [activeTab, setActiveTab] = useState<'salon' | 'account'>('salon')

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Ayarlar</h1>
        <p className="text-sm text-salon-muted mt-1">Salon ve hesap ayarlarınızı yönetin</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-salon-border">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'salon' | 'account')}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-salon-muted hover:text-gray-900',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === 'salon' ? 'Salon Bilgileri' : 'Şifre Değiştir'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTab === 'salon' ? (
            <SalonSettingsForm tenantSlug={params.slug} />
          ) : (
            <PasswordForm tenantSlug={params.slug} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
