'use client'

import { useState, useEffect } from 'react'
import { useForm, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Building2, Lock, Check, Plug, Plus, X, RotateCcw, Bot } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SECTOR_DATA, DEFAULT_SECTOR } from '@/lib/sector-data'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
  workingHours: z.string().min(1, 'Çalışma saatlerini giriniz').max(200),
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
  { id: 'integrations', label: 'Entegrasyonlar', icon: Plug },
  { id: 'bot', label: 'Bot Ayarları', icon: Bot },
]

// ─── Salon settings form ──────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { value: 'barbershop',    label: 'Berber / Kuaför' },
  { value: 'beauty_center', label: 'Güzellik Merkezi / Spa' },
  { value: 'nail_studio',   label: 'Nail Art Stüdyosu' },
  { value: 'aesthetic',     label: 'Estetik & Medikal Estetik' },
  { value: 'other',         label: 'Diğer' },
] as const

interface BotFaq {
  question: string
  answer: string
}

interface TenantSettings {
  id: string
  name: string
  slug: string
  settings: {
    phone?: string
    address?: string
    workingHours?: string
    businessType?: string
    followUpEnabled?: boolean
    serviceCategories?: string[]
    botIntro?: string
    botTone?: string
    botRules?: string
    botFaqs?: BotFaq[]
    botHidePrices?: boolean
  }
}

function SalonSettingsForm({ tenantSlug }: { tenantSlug: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['tenant-settings', tenantSlug],
    queryFn: () => apiFetch<TenantSettings>(`/api/v1/tenants/${tenantSlug}/settings`),
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<SalonFormValues>({
    resolver: zodResolver(salonSchema),
    defaultValues: { name: '', phone: '', address: '', workingHours: '09:00-19:00' },
  })

  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('19:00')
  const { field: whField } = useController({ name: 'workingHours', control })

  function handleTimeChange(type: 'start' | 'end', value: string) {
    if (type === 'start') {
      setStartTime(value)
      whField.onChange(`${value}-${endTime}`)
    } else {
      setEndTime(value)
      whField.onChange(`${startTime}-${value}`)
    }
  }

  useEffect(() => {
    if (data) {
      const wh = data.settings?.workingHours ?? '09:00-19:00'
      const match = wh.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/)
      if (match) {
        setStartTime(match[1])
        setEndTime(match[2])
      }
      reset({
        name: data.name,
        phone: data.settings?.phone ?? '',
        address: data.settings?.address ?? '',
        workingHours: wh,
      })
    }
  }, [data, reset])

  const mutation = useMutation({
    mutationFn: (values: SalonFormValues) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      }),
    onSuccess: () => toast('Salon bilgileri kaydedildi'),
    onError: (err: Error) => toast(err.message, 'error'),
  })

  if (isLoading) {
    return (
      <div className="space-y-5">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
      </div>
    )
  }

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
        <Label>Çalışma Saatleri</Label>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={startTime}
            onChange={(e) => handleTimeChange('start', e.target.value)}
            className="flex-1 h-10 px-3 rounded-md border border-salon-border bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-salon-muted text-sm shrink-0">—</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => handleTimeChange('end', e.target.value)}
            className="flex-1 h-10 px-3 rounded-md border border-salon-border bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {errors.workingHours && <p className="text-xs text-red-500">{errors.workingHours.message}</p>}
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

// ─── Advanced settings ────────────────────────────────────────────────────────

function AdvancedSettingsPanel({ tenantSlug }: { tenantSlug: string }) {
  const qc = useQueryClient()
  const [businessType, setBusinessType] = useState('')
  const [followUpEnabled, setFollowUpEnabled] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [newCat, setNewCat] = useState('')

  const { data } = useQuery({
    queryKey: ['tenant-settings', tenantSlug],
    queryFn: () => apiFetch<TenantSettings>(`/api/v1/tenants/${tenantSlug}/settings`),
  })

  useEffect(() => {
    if (data) {
      const bt = data.settings?.businessType ?? 'other'
      setBusinessType(bt)
      setFollowUpEnabled(data.settings?.followUpEnabled ?? false)
      const saved = data.settings?.serviceCategories
      setCategories(saved && saved.length > 0 ? saved : (SECTOR_DATA[bt] ?? DEFAULT_SECTOR).categories)
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-settings', tenantSlug] }),
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function saveCategories(cats: string[]) {
    setCategories(cats)
    mutation.mutate({ serviceCategories: cats })
  }

  function addCategory() {
    const trimmed = newCat.trim()
    if (!trimmed || categories.includes(trimmed)) return
    saveCategories([...categories, trimmed])
    setNewCat('')
  }

  function removeCategory(cat: string) {
    saveCategories(categories.filter((c) => c !== cat))
  }

  function resetToDefaults() {
    const defaults = (SECTOR_DATA[businessType] ?? DEFAULT_SECTOR).categories
    saveCategories(defaults)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="adv-business-type">İşletme Türü</Label>
        <select
          id="adv-business-type"
          value={businessType}
          onChange={(e) => {
            setBusinessType(e.target.value)
            mutation.mutate({ businessType: e.target.value })
          }}
          className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          {BUSINESS_TYPES.map((bt) => (
            <option key={bt.value} value={bt.value}>{bt.label}</option>
          ))}
        </select>
      </div>

      {/* Hizmet Kategorileri */}
      <div className="space-y-3 pt-4 border-t border-salon-border">
        <div className="flex items-center justify-between">
          <Label>Hizmet Kategorileri</Label>
          <button
            type="button"
            onClick={resetToDefaults}
            className="flex items-center gap-1 text-xs text-salon-muted hover:text-gray-700 transition-colors"
            title="Sektör varsayılanlarına sıfırla"
          >
            <RotateCcw className="w-3 h-3" />
            Varsayılana sıfırla
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-salon-bg border border-salon-border text-sm text-gray-700"
            >
              {cat}
              <button
                type="button"
                onClick={() => removeCategory(cat)}
                className="text-salon-muted hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }}
            placeholder="Yeni kategori adı"
            className="flex-1 border border-salon-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={addCategory}
            disabled={!newCat.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ekle
          </button>
        </div>
        <p className="text-xs text-salon-muted">Değişiklikler otomatik kaydedilir.</p>
      </div>

      <div className="flex items-start justify-between gap-4 pt-4 border-t border-salon-border">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Takip Randevuları</p>
          <p className="text-xs text-salon-muted mt-1 leading-relaxed">
            İşlem sonrası otomatik kontrol günleri oluşturma. Botoks, lazer, kalıcı makyaj gibi
            takip gerektiren hizmetler için uygundur.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={followUpEnabled}
          onClick={() => {
            const next = !followUpEnabled
            setFollowUpEnabled(next)
            mutation.mutate({ followUpEnabled: next })
          }}
          className={cn(
            'relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200',
            followUpEnabled ? 'bg-primary' : 'bg-gray-200',
          )}
        >
          <span
            className={cn(
              'absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
              followUpEnabled ? 'translate-x-4' : 'translate-x-0',
            )}
          />
        </button>
      </div>
    </div>
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

// ─── Integrations ─────────────────────────────────────────────────────────────

function IntegrationsPanel() {
  return (
    <div className="space-y-6">
      {/* WhatsApp */}
      <div className="rounded-lg border border-salon-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#25D366' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.849L.057 23.704a.75.75 0 0 0 .92.92l5.855-1.475A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.733 9.733 0 0 1-4.95-1.35l-.355-.21-3.676.926.99-3.593-.23-.37A9.751 9.751 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">WhatsApp Business</p>
              <p className="text-xs text-salon-muted">AI destekli randevu botu</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Onay Bekleniyor
          </span>
        </div>
        <p className="text-xs text-salon-muted leading-relaxed">
          Meta WhatsApp Business API başvurusu devam ediyor. Onay geldiğinde bu sayfadan numaranızı bağlayabileceksiniz.
          Ortalama onay süresi 3–5 iş günüdür.
        </p>
        <div className="rounded-md bg-salon-bg p-3 text-xs text-salon-muted space-y-1">
          <p className="font-medium text-gray-700">Beklenen özellikler:</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>7/24 otomatik randevu alma</li>
            <li>T-24h ve T-2h hatırlatma mesajları</li>
            <li>Müşteri profili tanıma</li>
          </ul>
        </div>
      </div>

      {/* Telegram (test kanalı) */}
      <div className="rounded-lg border border-salon-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#229ED9]">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Telegram Bot</p>
              <p className="text-xs text-salon-muted">Test & geliştirme kanalı</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Aktif
          </span>
        </div>
        <p className="text-xs text-salon-muted leading-relaxed">
          WhatsApp onayı beklenirken AI bot Telegram üzerinden test edilebilir.
          Bot aynı randevu akışını, slot sorgulama ve onay sistemini kullanır.
        </p>
      </div>
    </div>
  )
}

// ─── Bot settings ─────────────────────────────────────────────────────────────

const BOT_TONES = [
  { value: 'formal', label: 'Resmi' },
  { value: 'friendly', label: 'Samimi' },
  { value: 'energetic', label: 'Enerjik' },
]

function BotSettingsForm({ tenantSlug }: { tenantSlug: string }) {
  const [botIntro, setBotIntro] = useState('')
  const [botTone, setBotTone] = useState('friendly')
  const [botRules, setBotRules] = useState('')
  const [botFaqs, setBotFaqs] = useState<BotFaq[]>([])
  const [botHidePrices, setBotHidePrices] = useState(false)
  const [initialized, setInitialized] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-settings', tenantSlug],
    queryFn: () => apiFetch<TenantSettings>(`/api/v1/tenants/${tenantSlug}/settings`),
  })

  useEffect(() => {
    if (data && !initialized) {
      setBotIntro(data.settings?.botIntro ?? '')
      const storedTone = data.settings?.botTone
      const toneMap: Record<string, string> = { resmi: 'formal', samimi: 'friendly', enerjik: 'energetic' }
      setBotTone(toneMap[storedTone ?? ''] ?? storedTone ?? 'friendly')
      setBotRules(data.settings?.botRules ?? '')
      setBotFaqs(data.settings?.botFaqs ?? [])
      setBotHidePrices(data.settings?.botHidePrices ?? false)
      setInitialized(true)
    }
  }, [data, initialized])

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ botIntro, botTone, botRules, botFaqs, botHidePrices }),
      }),
    onSuccess: () => toast('Bot ayarları kaydedildi'),
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function addFaq() {
    setBotFaqs((prev) => [...prev, { question: '', answer: '' }])
  }

  function removeFaq(index: number) {
    setBotFaqs((prev) => prev.filter((_, i) => i !== index))
  }

  function updateFaq(index: number, field: 'question' | 'answer', value: string) {
    setBotFaqs((prev) => prev.map((faq, i) => (i === index ? { ...faq, [field]: value } : faq)))
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* İşletme Tanıtımı */}
      <div className="space-y-2">
        <Label htmlFor="botIntro">İşletme Tanıtımı</Label>
        <textarea
          id="botIntro"
          value={botIntro}
          onChange={(e) => setBotIntro(e.target.value)}
          rows={4}
          placeholder="Müşterilerinize kendinizi nasıl tanıtmak istersiniz? (ör: 10 yıllık deneyimli ekibimizle...)"
          className="w-full rounded-md border border-salon-border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-salon-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
        />
      </div>

      {/* Bot Tonu */}
      <div className="space-y-2">
        <Label>Bot Tonu</Label>
        <div className="flex gap-2">
          {BOT_TONES.map((tone) => (
            <button
              key={tone.value}
              type="button"
              onClick={() => setBotTone(tone.value)}
              className={cn(
                'flex-1 h-10 rounded-lg border text-sm font-medium transition-colors',
                botTone === tone.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-salon-border bg-white text-gray-700 hover:border-primary/50',
              )}
            >
              {tone.label}
            </button>
          ))}
        </div>
      </div>

      {/* Özel Kurallar */}
      <div className="space-y-2">
        <Label htmlFor="botRules">Özel Kurallar</Label>
        <textarea
          id="botRules"
          value={botRules}
          onChange={(e) => setBotRules(e.target.value)}
          rows={4}
          placeholder="Bot'un bilmesi gereken kurallar (ör: Sadece bayan müşteri alıyoruz, randevu iptali 2 saat önceden yapılmalı)"
          className="w-full rounded-md border border-salon-border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-salon-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
        />
      </div>

      {/* Sık Sorulan Sorular */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Sık Sorulan Sorular</Label>
          <button
            type="button"
            onClick={addFaq}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-salon-border bg-white text-xs font-medium text-gray-700 hover:border-primary/50 hover:text-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Soru Ekle
          </button>
        </div>

        {botFaqs.length === 0 && (
          <p className="text-xs text-salon-muted py-2">
            Henüz soru eklenmedi. "Soru Ekle" butonuyla soru-cevap çifti ekleyin.
          </p>
        )}

        <div className="space-y-3">
          {botFaqs.map((faq, index) => (
            <div key={index} className="rounded-lg border border-salon-border bg-salon-bg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-salon-muted">Soru {index + 1}</span>
                <button
                  type="button"
                  onClick={() => removeFaq(index)}
                  className="text-salon-muted hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={faq.question}
                onChange={(e) => updateFaq(index, 'question', e.target.value)}
                placeholder="Soru"
                className="w-full h-9 rounded-md border border-salon-border bg-white px-3 text-sm text-gray-900 placeholder:text-salon-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <textarea
                value={faq.answer}
                onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                rows={2}
                placeholder="Cevap"
                className="w-full rounded-md border border-salon-border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-salon-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Fiyat Bilgisi Verme */}
      <div className="flex items-start justify-between gap-4 pt-4 border-t border-salon-border">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Fiyat Bilgisi Verme</p>
          <p className="text-xs text-salon-muted mt-1 leading-relaxed">
            Açıksa bot hiçbir koşulda fiyat paylaşmaz, müşteriyi salonu aramaya yönlendirir.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={botHidePrices}
            onClick={() => setBotHidePrices((v) => !v)}
            className={cn(
              'relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200',
              botHidePrices ? 'bg-primary' : 'bg-gray-200',
            )}
          >
            <span
              className={cn(
                'absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
                botHidePrices ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </button>
          <span className="text-xs text-salon-muted">{botHidePrices ? 'Açık' : 'Kapalı'}</span>
        </div>
      </div>

      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
        {mutation.isPending ? 'Kaydediliyor...' : (
          <>
            {mutation.isSuccess && <Check className="w-4 h-4" />}
            Değişiklikleri Kaydet
          </>
        )}
      </Button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabId = 'salon' | 'account' | 'integrations' | 'bot'

export default function SettingsPage({ params }: PageProps) {
  const [activeTab, setActiveTab] = useState<TabId>('salon')
  const user = useAuthStore((s) => s.user)
  const router = useRouter()

  useEffect(() => {
    if (user?.role === 'staff') router.replace(`/tenant/${params.slug}/dashboard`)
  }, [user, params.slug, router])

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
              onClick={() => setActiveTab(tab.id as TabId)}
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

      {activeTab === 'salon' && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Salon Bilgileri</CardTitle></CardHeader>
            <CardContent><SalonSettingsForm tenantSlug={params.slug} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Gelişmiş Özellikler</CardTitle></CardHeader>
            <CardContent><AdvancedSettingsPanel tenantSlug={params.slug} /></CardContent>
          </Card>
        </div>
      )}
      {activeTab === 'account' && (
        <Card>
          <CardHeader><CardTitle>Şifre Değiştir</CardTitle></CardHeader>
          <CardContent><PasswordForm tenantSlug={params.slug} /></CardContent>
        </Card>
      )}
      {activeTab === 'integrations' && (
        <Card>
          <CardHeader><CardTitle>Entegrasyonlar</CardTitle></CardHeader>
          <CardContent><IntegrationsPanel /></CardContent>
        </Card>
      )}
      {activeTab === 'bot' && (
        <Card>
          <CardHeader><CardTitle>Bot Ayarları</CardTitle></CardHeader>
          <CardContent><BotSettingsForm tenantSlug={params.slug} /></CardContent>
        </Card>
      )}
    </div>
  )
}
