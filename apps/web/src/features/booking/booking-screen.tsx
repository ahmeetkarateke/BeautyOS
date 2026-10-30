'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { GENERIC_ERROR } from '@/content/errors'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { buildDayRange, DayStrip } from '@/ui/day-strip'
import { focusFirstInvalid, InputField, PhoneField } from '@/ui/field'
import { formatDateTime, formatMoney } from '@/ui/format'
import { SelectionCard } from '@/ui/selection-card'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { ErrorState } from '@/ui/states'
import { TimeSlots } from '@/ui/time-slots'
import { book, confirmCode, fetchServices, fetchSlots, fetchStaff, fetchTenant, sendCode } from './api'
import type { Booked, PublicService, PublicSlot, PublicTenant } from './api'
import { bookFailure, doneCopy, shareMessage, slotDate, slotLabel, validateCode, validateInfo } from './logic'
import { PrivacyNoticeSheet } from './privacy-notice'
import { brandStyle, PublicShell } from './public-shell'
import { Turnstile } from './turnstile'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
type Step = 'service' | 'time' | 'info' | 'verify' | 'done'
const STEP_NAMES: Record<Exclude<Step, 'done'>, string> = { service: 'Hizmet', time: 'Uzman ve zaman', info: 'Bilgileriniz', verify: 'Doğrulama' }
const todayIstanbul = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
const errorText = (error: unknown) => (error instanceof ApiError ? error.text() : GENERIC_ERROR)
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

function CallSalon({ tenant, lead }: { tenant: PublicTenant; lead: string }) {
  return (
    <PublicShell title={tenant.name} style={brandStyle(tenant.brandColor)} lead={lead}>
      {tenant.phone ? (
        <a href={telHref(tenant.phone)} className="inline-flex min-h-11 items-center font-semibold">
          Salonu arayın: {tenant.phone}
        </a>
      ) : null}
    </PublicShell>
  )
}

export function BookingScreen({ slug, turnstileSiteKey = TURNSTILE_SITE_KEY }: { slug: string; turnstileSiteKey?: string }) {
  const client = useApiClient()
  const tenantQuery = useApiQuery(`tenant:${slug}`, (c, signal) => fetchTenant(c, slug, signal))
  const [step, setStep] = useState<Step>('service')
  const [service, setService] = useState<PublicService | null>(null)
  const [staffId, setStaffId] = useState('any')
  const [date, setDate] = useState(() => todayIstanbul())
  const [slot, setSlot] = useState<PublicSlot | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [captcha, setCaptcha] = useState('')
  // Turnstile belirteci tek kullanımlıktır: her başarısız istekten sonra bileşen yeniden kurulur, yeni belirteç alınır.
  const [captchaEpoch, setCaptchaEpoch] = useState(0)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [booked, setBooked] = useState<Booked | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus({ preventScroll: true }), [step, tenantQuery.data])

  const tenant = tenantQuery.data
  const verified = tenant?.bookingMode === 'verified'
  const serviceId = service?.id ?? null
  const services = useApiQuery(tenant?.publicBookingEnabled ? `services:${slug}` : null, (c, signal) => fetchServices(c, slug, signal))
  const staff = useApiQuery(serviceId ? `staff:${slug}:${serviceId}` : null, (c, signal) => fetchStaff(c, slug, serviceId as string, signal))
  const slots = useApiQuery(serviceId && step === 'time' ? `slots:${slug}:${serviceId}:${staffId}:${date}` : null, (c, signal) =>
    fetchSlots(c, slug, { serviceId: serviceId as string, staffId, date }, signal),
  )

  if (tenantQuery.error) {
    if (tenantQuery.error.status === 404) return <PublicShell title="Salon bulunamadı" lead="Adresi kontrol edin ya da salonun size gönderdiği bağlantıyı kullanın." />
    return (
      <PublicShell title="Online randevu">
        <ErrorState subject="Salon bilgileri" onRetry={tenantQuery.refetch} retrying={tenantQuery.loading} />
      </PublicShell>
    )
  }
  if (!tenant) {
    return (
      <PublicShell title="Online randevu">
        <SkeletonGroup>
          <Skeleton className="w-2/3" />
          <Skeleton className="w-full" />
        </SkeletonGroup>
      </PublicShell>
    )
  }
  if (!tenant.publicBookingEnabled) return <CallSalon tenant={tenant} lead="Bu salon şu an online randevu almıyor. Randevu için salonu arayın." />

  const style = brandStyle(tenant.brandColor)
  const stepNames: readonly Exclude<Step, 'done'>[] = verified ? ['service', 'time', 'info', 'verify'] : ['service', 'time', 'info']
  const stepLabel = step === 'done' ? undefined : `Adım ${stepNames.indexOf(step) + 1}/${stepNames.length} · ${STEP_NAMES[step]}`

  async function submitBooking() {
    if (!service || !slot) return
    setPending(true)
    setFailure(null)
    try {
      setBooked(
        await book(client, slug, {
          serviceId: service.id,
          staffId: slot.staffId ?? staffId,
          slotId: slot.id,
          fullName,
          nationalPhone: phone,
          captchaToken: captcha || undefined,
        }),
      )
      setStep('done')
    } catch (error) {
      setCaptcha('')
      setCaptchaEpoch((n) => n + 1)
      const next = error instanceof ApiError ? bookFailure(error.code) : { step: 'stay' as const, clearSlot: false }
      if (next.clearSlot) setSlot(null)
      setFailure(errorText(error))
      if (next.step !== 'stay') setStep(next.step)
    } finally {
      setPending(false)
    }
  }

  async function submitInfo(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const found = validateInfo({ fullName, phone })
    setErrors(found)
    if (Object.keys(found).length > 0) return void requestAnimationFrame(() => formRef.current && focusFirstInvalid(formRef.current))
    if (!verified) return void submitBooking()
    setPending(true)
    setFailure(null)
    try {
      await sendCode(client, slug, phone)
      setStep('verify')
    } catch (error) {
      setFailure(errorText(error))
    } finally {
      setPending(false)
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const problem = validateCode(code)
    setErrors(problem ? { code: problem } : {})
    if (problem) return
    setPending(true)
    setFailure(null)
    try {
      await confirmCode(client, slug, phone, code)
    } catch (error) {
      setFailure(errorText(error))
      setPending(false)
      return
    }
    setPending(false)
    await submitBooking()
  }

  const back = (to: Step) => () => {
    setFailure(null)
    setStep(to)
  }
  const failureBanner = failure ? <Banner tone="error">{failure}</Banner> : null

  if (step === 'done' && booked) {
    const copy = doneCopy(booked.approvalRequired)
    const when = formatDateTime(booked.startAt)
    const wa = tenant.whatsappNumber?.replace(/\D/g, '')
    const message = shareMessage({ salonName: tenant.name, referenceCode: booked.referenceCode, when, serviceName: service?.name, isHealthRegulated: tenant.isHealthRegulated })
    return (
      <PublicShell title={copy.title} lead={copy.lead} style={style} headingRef={heading}>
        <dl className="grid gap-1 rounded-card border border-border bg-surface p-4 text-base">
          <dt className="text-sm text-text-muted">Salon</dt>
          <dd className="font-semibold">{tenant.name}</dd>
          <dt className="mt-2 text-sm text-text-muted">Zaman</dt>
          <dd className="tabular-nums">{when}</dd>
          {service && tenant.isHealthRegulated === false ? (
            <>
              <dt className="mt-2 text-sm text-text-muted">Hizmet</dt>
              <dd>{service.name}</dd>
            </>
          ) : null}
          {booked.price !== undefined ? (
            <>
              <dt className="mt-2 text-sm text-text-muted">Tutar</dt>
              <dd className="tabular-nums">{formatMoney(booked.price)}</dd>
            </>
          ) : null}
          <dt className="mt-2 text-sm text-text-muted">Referans kodu</dt>
          <dd className="font-semibold tabular-nums">{booked.referenceCode}</dd>
        </dl>
        {booked.manageLink ? (
          <p className="text-sm text-text-secondary">
            Randevunuzu değiştirmek ya da iptal etmek için{' '}
            <a href={booked.manageLink} className="inline-flex min-h-11 items-center">
              bu bağlantıyı kullanın
            </a>
            . Randevudan 2 saat öncesine kadar değiştirilebilir; sonrasında salonu arayın.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-x-4">
          {tenant.phone ? (
            <a href={telHref(tenant.phone)} className="inline-flex min-h-11 items-center">
              Salonu arayın
            </a>
          ) : null}
          {wa ? (
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`} className="inline-flex min-h-11 items-center" rel="noopener noreferrer" target="_blank">
              WhatsApp ile yazın
            </a>
          ) : null}
        </div>
      </PublicShell>
    )
  }

  if (step === 'service') {
    return (
      <PublicShell title={tenant.name} lead={tenant.aboutText ?? 'Online randevu alın.'} style={style} stepLabel={stepLabel} headingRef={heading}>
        {services.error ? <ErrorState subject="Hizmet listesi" onRetry={services.refetch} retrying={services.loading} /> : null}
        {!services.data && !services.error ? (
          <SkeletonGroup>
            <Skeleton className="w-full" />
            <Skeleton className="w-full" />
          </SkeletonGroup>
        ) : null}
        {services.data?.length === 0 ? <p className="text-base text-text-secondary">Şu an online alınabilecek hizmet yok. Salonu arayın.</p> : null}
        <div className="grid gap-2" role="group" aria-label="Hizmet seçin">
          {services.data?.map((s) => (
            <SelectionCard
              key={s.id}
              title={s.name}
              description={`${s.durationMinutes} dk${s.category ? ` · ${s.category}` : ''}`}
              price={s.price !== undefined ? formatMoney(s.price) : undefined}
              selected={service?.id === s.id}
              onSelect={() => {
                setService(s)
                setStaffId('any')
                setSlot(null)
                setStep('time')
              }}
            />
          ))}
        </div>
      </PublicShell>
    )
  }

  if (step === 'time') {
    const days = buildDayRange(todayIstanbul(), 14).map((d) => ({ date: d }))
    const free = (slots.data ?? []).filter((s) => s.available)
    const pick = (id: string) => {
      setStaffId(id)
      setSlot(null)
    }
    return (
      <PublicShell title="Uzman ve zaman seçin" style={style} stepLabel={stepLabel} headingRef={heading}>
        {failureBanner}
        <div role="group" aria-label="Uzman seçin" className="grid gap-2">
          <SelectionCard title="Fark etmez" selected={staffId === 'any'} onSelect={() => pick('any')} />
          {staff.data?.map((p) => (
            <SelectionCard key={p.id} title={p.fullName} description={p.title ?? undefined} selected={staffId === p.id} onSelect={() => pick(p.id)} />
          ))}
        </div>
        <DayStrip
          days={days}
          selected={date}
          onSelect={(d) => {
            setDate(d)
            setSlot(null)
          }}
        />
        {slots.error ? (
          <ErrorState subject="Boş saatler" onRetry={slots.refetch} retrying={slots.loading} />
        ) : (
          <TimeSlots
            slots={free.map((s) => slotLabel(s.id))}
            selected={slot && slotDate(slot.id) === date ? slotLabel(slot.id) : null}
            loading={slots.loading && !slots.data}
            onSelect={(label) => setSlot(free.find((s) => slotLabel(s.id) === label) ?? null)}
          />
        )}
        <div className="sticky bottom-0 flex gap-2 bg-page py-3">
          <Button variant="secondary" onClick={back('service')}>
            Geri dön
          </Button>
          <Button fullWidth disabled={!slot} onClick={back('info')}>
            Devam et
          </Button>
        </div>
      </PublicShell>
    )
  }

  if (step === 'info') {
    return (
      <PublicShell title="Bilgileriniz" style={style} stepLabel={stepLabel} headingRef={heading}>
        {failureBanner}
        <form ref={formRef} noValidate onSubmit={submitInfo} className="grid gap-4">
          <InputField label="Ad soyad" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
          <PhoneField label="Telefon" value={phone} onValueChange={setPhone} error={errors.phone} />
          <p className="text-sm text-text-secondary">
            Kişisel verileriniz, randevunuzu oluşturmak ve size hatırlatma göndermek amacıyla {tenant?.name ?? 'salon'} tarafından işlenir. Ayrıntılar için{' '}
            <button type="button" onClick={() => setNoticeOpen(true)} className="inline-flex min-h-11 cursor-pointer items-center text-primary underline underline-offset-2">
              Aydınlatma Metni
            </button>’ni inceleyebilirsiniz.
          </p>
          {turnstileSiteKey ? <Turnstile key={captchaEpoch} siteKey={turnstileSiteKey} onToken={setCaptcha} /> : null}
          <Button type="submit" fullWidth loading={pending} loadingText={verified ? 'Kod gönderiliyor…' : 'Gönderiliyor…'}>
            {verified ? 'Kod gönder' : 'Randevu talebi gönder'}
          </Button>
          <Button variant="text" onClick={back('time')}>
            Geri dön
          </Button>
        </form>
        {tenant ? <PrivacyNoticeSheet open={noticeOpen} onOpenChange={setNoticeOpen} tenant={tenant} /> : null}
      </PublicShell>
    )
  }

  return (
    <PublicShell title="Telefonunuzu doğrulayın" lead="Telefonunuza gelen 6 haneli kodu yazın. Kod 10 dakika geçerlidir." style={style} stepLabel={stepLabel} headingRef={heading}>
      {failureBanner}
      <form noValidate onSubmit={submitCode} className="grid gap-4">
        <InputField label="Doğrulama kodu" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={errors.code} />
        <Button type="submit" fullWidth loading={pending} loadingText="Randevu oluşturuluyor…">
          Randevuyu onayla
        </Button>
        <Button variant="secondary" onClick={() => void sendCode(client, slug, phone).catch((e) => setFailure(errorText(e)))}>
          Kodu yeniden gönder
        </Button>
        <Button variant="text" onClick={back('info')}>
          Geri dön
        </Button>
      </form>
    </PublicShell>
  )
}
