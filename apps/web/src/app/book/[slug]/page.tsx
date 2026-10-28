'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Calendar, Check, Clock, User, AlertCircle, MapPin, Phone, MessageCircle } from 'lucide-react'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        },
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

interface TenantInfo {
  name: string
  publicBookingEnabled: boolean
  address: string | null
  phone: string | null
  whatsappNumber: string | null
  mapsUrl: string | null
  workingHours: unknown
  brandColor: string | null
  logoUrl: string | null
  coverUrl: string | null
  aboutText: string | null
}

interface Service {
  id: string
  name: string
  durationMinutes: number
  category: string | null
}

interface StaffMember {
  id: string
  fullName: string
  title: string
}

interface Slot {
  id: string
  label: string
  available: boolean
  staffId: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = (body as { error?: { message?: string } })?.error?.message ?? 'Bir hata oluştu'
    throw new Error(message)
  }
  return body as T
}

function formatDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTR(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
}

type Step = 'service' | 'staff' | 'date' | 'slot' | 'contact' | 'done'

export default function PublicBookingPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const [step, setStep] = useState<Step>('service')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('') // '' or staffId or 'any'
  const [date, setDate] = useState<string>(formatDateInput(new Date()))
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [confirmedRef, setConfirmedRef] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string>('')
  const [redirectNotice, setRedirectNotice] = useState<string>('')

  // SMS doğrulama durumu
  const [verifyCodeSent, setVerifyCodeSent] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifyCooldown, setVerifyCooldown] = useState(0)
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const [turnstileReady, setTurnstileReady] = useState(false)
  const [captchaNotice, setCaptchaNotice] = useState('')

  const { data: tenantInfo, isLoading: tenantLoading, error: tenantError } = useQuery({
    queryKey: ['public-tenant', slug],
    queryFn: () => publicFetch<TenantInfo>(`/api/v1/tenants/${slug}/public/tenant`),
    retry: false,
  })

  const { data: servicesData } = useQuery({
    queryKey: ['public-services', slug],
    queryFn: () => publicFetch<{ data: Service[] }>(`/api/v1/tenants/${slug}/public/services`),
    enabled: !!tenantInfo?.publicBookingEnabled,
  })

  const { data: staffData } = useQuery({
    queryKey: ['public-staff', slug, selectedService?.id],
    queryFn: () => publicFetch<{ data: StaffMember[] }>(`/api/v1/tenants/${slug}/public/staff?serviceId=${selectedService!.id}`),
    enabled: !!selectedService,
  })

  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['public-slots', slug, selectedService?.id, selectedStaffId, date],
    queryFn: () =>
      publicFetch<{ slots: Slot[] }>(
        `/api/v1/tenants/${slug}/public/slots?serviceId=${selectedService!.id}&staffId=${selectedStaffId}&date=${date}`,
      ),
    enabled: !!selectedService && !!selectedStaffId && step === 'slot',
  })

  const sendCodeMutation = useMutation({
    mutationFn: () =>
      publicFetch<{ ok: true; devCode?: string }>(`/api/v1/tenants/${slug}/public/verify/send`, {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim() }),
      }),
    onSuccess: (data) => {
      setVerifyCodeSent(true)
      setVerifyError('')
      // Geliştirme kodu üretimde hiçbir koşulda gösterilmez (API de üretimde döndürmez)
      setDevCodeHint(process.env.NODE_ENV !== 'production' ? (data.devCode ?? null) : null)
      // 60 sn cooldown başlat (frontend tarafı; backend zaten 3dk koruyor)
      setVerifyCooldown(60)
      const iv = setInterval(() => {
        setVerifyCooldown((c) => {
          if (c <= 1) { clearInterval(iv); return 0 }
          return c - 1
        })
      }, 1000)
    },
    onError: (err: Error) => setVerifyError(err.message),
  })

  const confirmCodeMutation = useMutation({
    mutationFn: () =>
      publicFetch<{ ok: true; phone: string }>(`/api/v1/tenants/${slug}/public/verify/confirm`, {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), code: verifyCode.trim() }),
      }),
    onSuccess: () => {
      setPhoneVerified(true)
      setVerifyError('')
    },
    onError: (err: Error) => setVerifyError(err.message),
  })

  const bookMutation = useMutation({
    mutationFn: () =>
      publicFetch<{ referenceCode: string }>(`/api/v1/tenants/${slug}/public/book`, {
        method: 'POST',
        body: JSON.stringify({
          serviceId: selectedService!.id,
          staffId: selectedSlot!.staffId,
          startAt: selectedSlot!.id,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          captchaToken: captchaToken || undefined,
        }),
      }),
    onSuccess: (data) => {
      setConfirmedRef(data.referenceCode)
      setStep('done')
    },
    onError: (err: Error) => {
      // CAPTCHA token tek kullanımlık — hata sonrası sıfırla
      if (TURNSTILE_SITE_KEY && window.turnstile && turnstileWidgetId.current) {
        window.turnstile.reset(turnstileWidgetId.current)
        setCaptchaToken('')
      }
      const msg = err.message.toLowerCase()
      // Geçmiş saat → tarih seçimine geri dön
      if (msg.includes('geçmiş') || msg.includes('past_time')) {
        setSelectedSlot(null)
        setRedirectNotice('Seçtiğiniz saat geçmişte kaldı. Lütfen yeni bir tarih seçin.')
        setStep('date')
        return
      }
      // Slot dolu → tekrar slot listesine dön
      if (msg.includes('dolu') || msg.includes('slot_taken')) {
        setSelectedSlot(null)
        setRedirectNotice('Seçtiğiniz saat bu sırada dolduruldu. Başka bir saat seçin.')
        setStep('slot')
      }
    },
  })

  // Turnstile widget'ı yalnız iletişim adımındayken ve betik yüklenmişken çizilir; adımdan çıkınca kaldırılır,
  // böylece geri dönüşte yeni <div>'e yeniden çizilir ve eski token kalmaz.
  useEffect(() => {
    if (step !== 'contact' || !TURNSTILE_SITE_KEY || !turnstileReady) return
    if (!turnstileRef.current || !window.turnstile) return
    turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => {
        setCaptchaToken(token)
        setCaptchaNotice('')
      },
      'expired-callback': () => {
        setCaptchaToken('')
        setCaptchaNotice('Güvenlik doğrulamasının süresi doldu. Lütfen kutuyu yeniden onaylayın.')
      },
      'error-callback': () => {
        setCaptchaToken('')
        setCaptchaNotice('Güvenlik doğrulaması çalışmadı. Sayfayı yenileyip tekrar deneyin; reklam engelleyiciniz varsa kapatın.')
      },
    })
    return () => {
      if (turnstileWidgetId.current && window.turnstile) window.turnstile.remove(turnstileWidgetId.current)
      turnstileWidgetId.current = null
      setCaptchaToken('')
    }
  }, [step, turnstileReady])

  useEffect(() => {
    setSelectedSlot(null)
    setRedirectNotice('')
  }, [date, selectedStaffId])

  if (tenantLoading) {
    return <CenterMessage>Yükleniyor…</CenterMessage>
  }

  if (tenantError || !tenantInfo) {
    return (
      <CenterMessage icon={<AlertCircle size={32} className="text-red-500" />}>
        Salon bulunamadı.
      </CenterMessage>
    )
  }

  if (!tenantInfo.publicBookingEnabled) {
    return (
      <CenterMessage icon={<AlertCircle size={32} className="text-amber-500" />}>
        <p className="font-medium text-gray-900 mb-1">{tenantInfo.name}</p>
        <p>Bu salon şu anda online rezervasyon kabul etmiyor.</p>
        {tenantInfo.phone && (
          <p className="text-sm mt-3">Telefon: <a href={`tel:${tenantInfo.phone}`} className="text-primary">{tenantInfo.phone}</a></p>
        )}
      </CenterMessage>
    )
  }

  const services = servicesData?.data ?? []
  const staff = staffData?.data ?? []
  const slots = slotsData?.slots ?? []

  const brandColor = tenantInfo.brandColor || '#6B48FF'
  const cssVars = { '--brand': brandColor } as React.CSSProperties

  return (
    <>
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={() => setTurnstileReady(true)}
          onReady={() => setTurnstileReady(true)}
          onError={() => setCaptchaNotice('Güvenlik doğrulaması yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin; reklam engelleyiciniz varsa kapatın.')}
        />
      )}
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white" style={cssVars}>
      <div className="max-w-md mx-auto">
        {/* Cover */}
        {tenantInfo.coverUrl && (
          <div className="w-full h-40 sm:h-48 overflow-hidden">
            <img
              src={tenantInfo.coverUrl}
              alt="Kapak"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}

        <div className="p-4 sm:p-6">
          {/* Header — logo + name */}
          <header className="text-center mb-4 pt-2">
            {tenantInfo.logoUrl && (
              <img
                src={tenantInfo.logoUrl}
                alt={tenantInfo.name}
                className="w-20 h-20 rounded-full mx-auto mb-3 object-cover border-2 border-white shadow"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <h1 className="text-2xl font-bold text-gray-900">{tenantInfo.name}</h1>
            {tenantInfo.aboutText && (
              <p className="text-sm text-zinc-600 mt-2 max-w-sm mx-auto leading-relaxed">{tenantInfo.aboutText}</p>
            )}
          </header>

          {/* Contact strip */}
          {(tenantInfo.phone || tenantInfo.whatsappNumber || tenantInfo.mapsUrl) && (
            <div className="flex justify-center gap-2 mb-4">
              {tenantInfo.phone && (
                <a
                  href={`tel:${tenantInfo.phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 rounded-full text-xs text-gray-700 hover:bg-zinc-50"
                >
                  <Phone size={12} /> Ara
                </a>
              )}
              {tenantInfo.whatsappNumber && (
                <a
                  href={`https://wa.me/${tenantInfo.whatsappNumber.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs text-green-700 hover:bg-green-100"
                >
                  <MessageCircle size={12} /> WhatsApp
                </a>
              )}
              {tenantInfo.mapsUrl && (
                <a
                  href={tenantInfo.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 rounded-full text-xs text-gray-700 hover:bg-zinc-50"
                >
                  <MapPin size={12} /> Yol Tarifi
                </a>
              )}
            </div>
          )}

          {/* Address */}
          {tenantInfo.address && (
            <div className="text-center text-xs text-zinc-500 mb-5">
              <p>{tenantInfo.address}</p>
            </div>
          )}

        {step !== 'service' && step !== 'done' && (
          <button
            type="button"
            onClick={() => {
              if (step === 'staff') setStep('service')
              else if (step === 'date') setStep('staff')
              else if (step === 'slot') setStep('date')
              else if (step === 'contact') setStep('slot')
            }}
            className="flex items-center gap-1 text-sm text-zinc-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft size={14} /> Geri
          </button>
        )}

        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 sm:p-5">
          {/* Step: Service */}
          {step === 'service' && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Hizmet seçin</h2>
              {services.length === 0 && (
                <p className="text-sm text-zinc-500">Henüz hizmet eklenmemiş.</p>
              )}
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedService(s)
                    setStep('staff')
                  }}
                  className="w-full p-3 border border-zinc-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    {s.category && <p className="text-xs text-zinc-500 mt-0.5">{s.category}</p>}
                  </div>
                  <span className="text-xs text-zinc-400 shrink-0">{s.durationMinutes} dk</span>
                </button>
              ))}
            </div>
          )}

          {/* Step: Staff */}
          {step === 'staff' && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Personel seçin</h2>
              <button
                onClick={() => {
                  setSelectedStaffId('any')
                  setStep('date')
                }}
                className="w-full p-3 border border-zinc-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Fark etmez</p>
                  <p className="text-xs text-zinc-500">İlk müsait personeli seç</p>
                </div>
              </button>
              {staff.map((sp) => (
                <button
                  key={sp.id}
                  onClick={() => {
                    setSelectedStaffId(sp.id)
                    setStep('date')
                  }}
                  className="w-full p-3 border border-zinc-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {sp.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{sp.fullName}</p>
                    <p className="text-xs text-zinc-500 truncate">{sp.title}</p>
                  </div>
                </button>
              ))}
              {staff.length === 0 && (
                <p className="text-sm text-zinc-500">Bu hizmeti yapan personel bulunamadı.</p>
              )}
            </div>
          )}

          {/* Step: Date */}
          {step === 'date' && (
            <div className="space-y-3">
              {redirectNotice && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  {redirectNotice}
                </div>
              )}
              <h2 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Calendar size={18} /> Tarih seçin
              </h2>
              <input
                type="date"
                value={date}
                min={formatDateInput(new Date())}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={() => setStep('slot')}
                disabled={!date}
                style={{ backgroundColor: brandColor }}
                className="w-full py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                Saatleri Gör
              </button>
            </div>
          )}

          {/* Step: Slot */}
          {step === 'slot' && (
            <div className="space-y-3">
              {redirectNotice && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  {redirectNotice}
                </div>
              )}
              <h2 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Clock size={18} /> Saat seçin
              </h2>
              <p className="text-xs text-zinc-500 mb-2">{formatDateTR(date)}</p>
              {slotsLoading && <p className="text-sm text-zinc-500">Yükleniyor…</p>}
              {!slotsLoading && slots.length === 0 && (
                <p className="text-sm text-zinc-500">Bu tarihte boş saat yok. Başka bir tarih deneyin.</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {slots.filter((s) => s.available).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSlot(s)
                      setStep('contact')
                    }}
                    className="py-2.5 border border-zinc-200 rounded-lg text-sm font-medium text-gray-900 hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step: Contact */}
          {step === 'contact' && selectedSlot && selectedService && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900 mb-1">İletişim Bilgileri</h2>
              <div className="p-3 bg-primary/5 rounded-lg text-sm space-y-1 mb-2">
                <p className="font-medium text-gray-900">{selectedService.name}</p>
                <p className="text-zinc-600">{formatDateTR(date)} · {selectedSlot.label}</p>
              </div>
              <input
                type="text"
                placeholder="Ad Soyad"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="Telefon (05XX XXX XX XX)"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      // Telefon değişince doğrulamayı sıfırla
                      if (phoneVerified) {
                        setPhoneVerified(false)
                        setVerifyCodeSent(false)
                        setVerifyCode('')
                        setDevCodeHint(null)
                      }
                    }}
                    disabled={phoneVerified}
                    className="flex-1 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-zinc-50"
                  />
                  {!phoneVerified && (
                    <button
                      onClick={() => sendCodeMutation.mutate()}
                      disabled={phone.trim().length < 7 || sendCodeMutation.isPending || verifyCooldown > 0}
                      className="px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 whitespace-nowrap"
                    >
                      {sendCodeMutation.isPending
                        ? 'Gönderiliyor…'
                        : verifyCooldown > 0
                        ? `${verifyCooldown}sn`
                        : verifyCodeSent
                        ? 'Yeniden'
                        : 'Kod Gönder'}
                    </button>
                  )}
                  {phoneVerified && (
                    <span className="px-3 py-2 text-xs font-medium rounded-lg bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1 whitespace-nowrap">
                      <Check size={13} strokeWidth={2.5} /> Doğrulandı
                    </span>
                  )}
                </div>

                {verifyCodeSent && !phoneVerified && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6 haneli kod"
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono tracking-widest"
                        autoFocus
                      />
                      <button
                        onClick={() => confirmCodeMutation.mutate()}
                        disabled={verifyCode.length !== 6 || confirmCodeMutation.isPending}
                        className="px-4 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-50 whitespace-nowrap"
                        style={{ backgroundColor: brandColor }}
                      >
                        {confirmCodeMutation.isPending ? '…' : 'Doğrula'}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Telefonunuza gönderilen 6 haneli kodu giriniz. Kod 10 dakika geçerlidir.
                    </p>
                    {process.env.NODE_ENV !== 'production' && devCodeHint && (
                      <p className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        🛈 Geliştirme modu — kod: <strong>{devCodeHint}</strong>
                      </p>
                    )}
                  </div>
                )}

                {verifyError && (
                  <p className="text-xs text-red-500">{verifyError}</p>
                )}
              </div>

              {TURNSTILE_SITE_KEY && (
                <div ref={turnstileRef} className="flex justify-center" />
              )}
              {TURNSTILE_SITE_KEY && !captchaToken && (
                <p className="text-[11px] text-amber-600 text-center" role="status">
                  {captchaNotice || (turnstileReady ? 'Göndermek için güvenlik doğrulamasını tamamlayın.' : 'Güvenlik doğrulaması yükleniyor…')}
                </p>
              )}
              {bookMutation.isError && (
                <p className="text-xs text-red-500">{(bookMutation.error as Error).message}</p>
              )}
              <button
                onClick={() => bookMutation.mutate()}
                disabled={
                  name.trim().length < 2
                  || phone.trim().length < 7
                  || !phoneVerified
                  || bookMutation.isPending
                  || (!!TURNSTILE_SITE_KEY && !captchaToken)
                }
                style={{ backgroundColor: brandColor }}
                className="w-full py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {bookMutation.isPending ? 'Gönderiliyor…' : 'Randevu Talebini Gönder'}
              </button>
              {!phoneVerified && phone.trim().length >= 7 && !verifyCodeSent && (
                <p className="text-[11px] text-amber-600 text-center">
                  ⚠ Randevu için önce telefonunuzu doğrulamanız gerekir.
                </p>
              )}
              <p className="text-[11px] text-zinc-500 text-center">
                Randevunuz salon tarafından onaylandıktan sonra kesinleşir.
              </p>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && confirmedRef && (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
                <Check size={32} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Talebiniz alındı!</h2>
              <p className="text-sm text-zinc-500">
                {selectedService?.name}<br />
                {formatDateTR(date)} · {selectedSlot?.label}
              </p>
              <p className="text-sm text-gray-700 max-w-xs mx-auto leading-relaxed">
                Randevu talebiniz salonun onayına gönderildi.
                Onaylanınca size haber verilecek.
              </p>
              <div className="inline-block px-3 py-1.5 bg-zinc-100 rounded text-xs font-mono text-zinc-700">
                Referans: {confirmedRef}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-zinc-400 mt-6">
          BeautyOS ile randevu sistemi
        </p>
        </div>
      </div>
    </div>
    </>
  )
}

function CenterMessage({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-zinc-50 to-white">
      <div className="text-center max-w-sm space-y-3">
        {icon && <div className="flex justify-center">{icon}</div>}
        <div className="text-zinc-600">{children}</div>
      </div>
    </div>
  )
}
