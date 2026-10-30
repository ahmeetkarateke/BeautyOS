'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createService } from '@/features/services/api'
import { validateService } from '@/features/services/logic'
import { fetchSettings, patchSettings, type SalonSettings } from '@/features/settings/api'
import { validateSalon } from '@/features/settings/logic'
import { hoursBody, salonRows, validateHours, type HourRow } from '@/features/staff/logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button, buttonClassName } from '@/ui/button'
import { Card } from '@/ui/card'
import { Checkbox, Switch } from '@/ui/choice'
import { InputField, SelectField } from '@/ui/field'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { ErrorState, Forbidden } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { completeOnboarding, inviteStaff } from './api'
import {
  BUSINESS_TYPE_OPTIONS,
  nextStep,
  pickToServiceValues,
  prevStep,
  readyTasks,
  stepProgress,
  stepsFor,
  suggestionsFor,
  validateInvite,
  type InviteValues,
  type PickedService,
  type StepId,
} from './logic'

// Kurulum sihirbazı (W31, tasarim.md §8.3). Yalnız sahip ve müdür; her adım kendi isteğini atar, atlanan adım hiçbir şey yazmaz.
const failureText = (err: unknown) => (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text()

type StepProps = { settings: SalonSettings; onDone: () => void; onSkip: () => void; onBack: () => void }

function Actions({
  busy,
  onBack,
  onSkip,
  submitLabel = 'Kaydet ve devam et',
  onSubmit,
}: {
  busy?: boolean
  onBack?: () => void
  onSkip?: () => void
  submitLabel?: string
  onSubmit: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <Button loading={busy} loadingText="Kaydediliyor…" onClick={onSubmit}>
        {submitLabel}
      </Button>
      {onSkip ? (
        <Button variant="text" onClick={onSkip} disabled={busy}>
          Şimdilik atla
        </Button>
      ) : null}
      {onBack ? (
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          Geri
        </Button>
      ) : null}
    </div>
  )
}

function useStepSave() {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  async function run(work: () => Promise<void>, then: () => void) {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await work()
      then()
    } catch (err) {
      setFailure(failureText(err))
    } finally {
      setBusy(false)
    }
  }
  return { busy, failure, run }
}

function TypeStep({ onDone }: StepProps) {
  const client = useApiClient()
  const me = useMe()
  const [value, setValue] = useState(me.tenant.businessType)
  const { busy, failure, run } = useStepSave()
  const canChange = me.role === 'owner'
  return (
    <div className="grid gap-4">
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <SelectField
        label="İşletme türü"
        value={value}
        disabled={!canChange}
        hint={canChange ? 'Hizmet önerileri ve ekran metinleri türe göre değişir.' : 'İşletme türünü yalnız salon sahibi değiştirebilir.'}
        onChange={(event) => setValue(event.target.value)}
      >
        {BUSINESS_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectField>
      <Actions
        busy={busy}
        submitLabel="Devam et"
        onSubmit={() =>
          void run(async () => {
            if (canChange && value !== me.tenant.businessType) await patchSettings(client, me.tenant.slug, { businessType: value })
          }, onDone)
        }
      />
    </div>
  )
}

function SalonStep({ settings, onDone, onBack }: StepProps) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const [values, setValues] = useState({ name: settings.name, phone: settings.settings?.phone ?? '', address: settings.settings?.address ?? '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { busy, failure, run } = useStepSave()
  const change = (field: keyof typeof values, text: string) => {
    setValues((v) => ({ ...v, [field]: text }))
    setErrors({})
  }
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const found = validateSalon(values)
        setErrors(found)
        if (Object.keys(found).length === 0)
          void run(() => patchSettings(client, slug, { name: values.name.trim(), phone: values.phone.trim(), address: values.address.trim() }), onDone)
      }}
    >
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <InputField label="Salon adı" value={values.name} onChange={(e) => change('name', e.target.value)} error={errors.name} autoComplete="organization" />
      <InputField label="Telefon" type="tel" value={values.phone} onChange={(e) => change('phone', e.target.value)} error={errors.phone} autoComplete="tel" />
      <InputField label="Adres" value={values.address} onChange={(e) => change('address', e.target.value)} error={errors.address} autoComplete="street-address" />
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" loading={busy} loadingText="Kaydediliyor…">
          Kaydet ve devam et
        </Button>
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          Geri
        </Button>
      </div>
    </form>
  )
}

function HoursStep({ settings, onDone, onSkip, onBack }: StepProps) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const [rows, setRows] = useState<HourRow[]>(() => salonRows(settings.settings?.workingHours))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { busy, failure, run } = useStepSave()
  const patch = (day: string, change: Partial<HourRow>) => {
    setRows((current) => current.map((r) => (r.key === day ? { ...r, ...change } : r)))
    setErrors({})
  }
  return (
    <div className="grid gap-3">
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      {errors._all ? <Banner tone="error">{errors._all}</Banner> : null}
      <p className="text-sm text-text-muted">Müşteriler yalnız bu saatlerde randevu alabilir. Sonra Ayarlar bölümünden değiştirebilirsiniz.</p>
      {rows.map((row) => (
        <div key={row.key} className="grid gap-2 border-b border-border-subtle pb-3 last:border-b-0">
          <Switch label={row.label} checked={row.open} onCheckedChange={(open) => patch(row.key, { open })} />
          {row.open ? (
            <div className="grid grid-cols-2 gap-3">
              <InputField
                label={`${row.label} başlangıç`}
                type="time"
                value={row.start}
                onChange={(e) => patch(row.key, { start: e.target.value })}
                error={errors[row.key] || undefined}
              />
              <InputField label={`${row.label} bitiş`} type="time" value={row.end} onChange={(e) => patch(row.key, { end: e.target.value })} />
            </div>
          ) : null}
        </div>
      ))}
      <Actions
        busy={busy}
        onBack={onBack}
        onSkip={onSkip}
        onSubmit={() => {
          const found = validateHours(rows)
          setErrors(found)
          if (Object.keys(found).length === 0) void run(() => patchSettings(client, slug, { workingHours: hoursBody(rows) }), onDone)
        }}
      />
    </div>
  )
}

function ServicesStep({ onDone, onSkip, onBack }: StepProps) {
  const client = useApiClient()
  const me = useMe()
  const suggestions = suggestionsFor(me.tenant.businessType)
  const [picked, setPicked] = useState<Record<string, PickedService>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { busy, failure, run } = useStepSave()
  const toggle = (name: string, on: boolean) => {
    setPicked((current) => {
      const next = { ...current }
      const found = suggestions.find((x) => x.name === name)
      if (on && found) next[name] = { ...found, priceText: '' }
      else delete next[name]
      return next
    })
    setErrors({})
  }
  const list = Object.values(picked)
  return (
    <div className="grid gap-3">
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <p className="text-sm text-text-muted">
        {suggestions.length === 0
          ? 'Bu tür için öneri yok. Hizmetlerinizi sonra Hizmetler ekranından ekleyebilirsiniz.'
          : 'Sunduğunuz hizmetleri seçin ve fiyatını yazın. Süreyi sonra değiştirebilirsiniz.'}
      </p>
      {suggestions.map((s) => {
        const pick = picked[s.name]
        return (
          <div key={s.name} className="grid gap-2 border-b border-border-subtle pb-3 last:border-b-0">
            <Checkbox label={`${s.name} (${s.durationText} dk)`} checked={Boolean(pick)} onCheckedChange={(on) => toggle(s.name, on)} />
            {pick ? (
              <InputField
                label={`${s.name} fiyatı (TL)`}
                inputMode="decimal"
                value={pick.priceText}
                error={errors[s.name]}
                onChange={(e) => {
                  setPicked((c) => ({ ...c, [s.name]: { ...pick, priceText: e.target.value } }))
                  setErrors({})
                }}
              />
            ) : null}
          </div>
        )
      })}
      <Actions
        busy={busy}
        onBack={onBack}
        onSkip={onSkip}
        submitLabel={list.length === 0 ? 'Devam et' : 'Kaydet ve devam et'}
        onSubmit={() => {
          const found: Record<string, string> = {}
          for (const pick of list) {
            const first = Object.values(validateService(pickToServiceValues(pick)))[0]
            if (first) found[pick.name] = first
          }
          setErrors(found)
          if (Object.keys(found).length > 0) return
          void run(async () => {
            for (const pick of list) {
              const v = pickToServiceValues(pick)
              await createService(client, me.tenant.slug, {
                name: v.name,
                category: v.category,
                durationMinutes: Number(v.durationText),
                price: Number(v.priceText.replace(/\./g, '').replace(',', '.')),
                bufferMinutes: 0,
                isOnlineBookable: true,
              })
              // Yazılan öneri listeden düşer: hata sonrası yeniden denemede çift kayıt oluşmaz.
              setPicked((c) => {
                const next = { ...c }
                delete next[pick.name]
                return next
              })
            }
          }, onDone)
        }}
      />
    </div>
  )
}

function StaffStep({ onDone, onSkip, onBack }: StepProps) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const [values, setValues] = useState<InviteValues>({ fullName: '', email: '', role: 'staff' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sent, setSent] = useState<string[]>([])
  const { busy, failure, run } = useStepSave()
  const set = (change: Partial<InviteValues>) => {
    setValues((v) => ({ ...v, ...change }))
    setErrors({})
  }
  function send() {
    const found = validateInvite(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    void run(
      () => inviteStaff(client, slug, values),
      () => {
        setSent((s) => [...s, values.fullName.trim()])
        setValues({ fullName: '', email: '', role: 'staff' })
      },
    )
  }
  return (
    <div className="grid gap-3">
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <p className="text-sm text-text-muted">Çalışanlarınıza e-posta ile davet gönderin. Tek başınıza çalışıyorsanız bu adımı atlayın.</p>
      {sent.length > 0 ? <Banner tone="success">{`Davet gönderildi: ${sent.join(', ')}.`}</Banner> : null}
      <InputField label="Ad soyad" value={values.fullName} onChange={(e) => set({ fullName: e.target.value })} error={errors.fullName} />
      <InputField label="E-posta" type="email" value={values.email} onChange={(e) => set({ email: e.target.value })} error={errors.email} autoComplete="off" />
      <SelectField label="Rol" value={values.role} onChange={(e) => set({ role: e.target.value as InviteValues['role'] })}>
        <option value="staff">Uzman</option>
        <option value="receptionist">Resepsiyon</option>
        <option value="manager">Müdür</option>
      </SelectField>
      <div>
        <Button variant="secondary" loading={busy} loadingText="Gönderiliyor…" onClick={send}>
          Daveti gönder
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button onClick={onDone} disabled={busy}>
          Devam et
        </Button>
        <Button variant="text" onClick={onSkip} disabled={busy}>
          Sadece ben
        </Button>
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          Geri
        </Button>
      </div>
    </div>
  )
}

function LegalStep({ onDone, onSkip, onBack }: StepProps) {
  return (
    <div className="grid gap-3">
      <Banner tone="info">Aydınlatma metni şablonu henüz hazır değil. Hazır olunca sizi uyaracağız.</Banner>
      <p className="text-sm text-text-muted">Müşteri verisi topladığınız için aydınlatma metnini yayınlamanız gerekir. Bu adımı şimdilik atlayabilirsiniz.</p>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button onClick={onDone}>Devam et</Button>
        <Button variant="text" onClick={onSkip}>
          Şimdilik atla
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Geri
        </Button>
      </div>
    </div>
  )
}

function ReadyStep({ onBack }: StepProps) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function copyLink() {
    const link = `${window.location.origin}/book/${encodeURIComponent(slug)}`
    try {
      await navigator.clipboard.writeText(link)
      toast.show({ message: 'Bağlantı kopyalandı.' })
    } catch {
      toast.show({ message: `Bağlantıyı elle kopyalayın: ${link}` })
    }
  }
  async function finish() {
    setBusy(true)
    setFailure(null)
    try {
      await completeOnboarding(client, slug)
      window.location.assign(`/panel/${encodeURIComponent(slug)}/bugun`)
    } catch (err) {
      setFailure(failureText(err))
      setBusy(false)
    }
  }
  return (
    <div className="grid gap-4">
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <p className="text-text-muted">Salonunuz hazır. İlk adımlar:</p>
      <ul className="m-0 grid list-none gap-2 p-0">
        {readyTasks(slug).map((task) => (
          <li key={task.id}>
            {task.href ? (
              <Link href={task.href} className={buttonClassName({ variant: 'secondary', fullWidth: true })}>
                {task.label}
              </Link>
            ) : (
              <Button variant="secondary" fullWidth onClick={() => void copyLink()}>
                {task.label}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button loading={busy} loadingText="Kaydediliyor…" onClick={() => void finish()}>
          Panele git
        </Button>
        <Button variant="secondary" onClick={onBack} disabled={busy}>
          Geri
        </Button>
      </div>
    </div>
  )
}

const BODIES: Record<StepId, (props: StepProps) => ReactNode> = {
  type: (p) => <TypeStep {...p} />,
  salon: (p) => <SalonStep {...p} />,
  hours: (p) => <HoursStep {...p} />,
  services: (p) => <ServicesStep {...p} />,
  staff: (p) => <StaffStep {...p} />,
  legal: (p) => <LegalStep {...p} />,
  ready: (p) => <ReadyStep {...p} />,
}

export function SetupWizard() {
  const me = useMe()
  const allowed = me.role === 'owner' || me.role === 'manager'
  const query = useApiQuery(allowed ? 'settings:wizard' : null, (c, signal) => fetchSettings(c, me.tenant.slug, signal))
  const [step, setStep] = useState<StepId>('type')
  const heading = useRef<HTMLHeadingElement>(null)
  const first = useRef(true)
  useEffect(() => {
    // Adım değişince odak başlığa gider: ekran okuyucu ve klavye kullanıcısı yeni adımı duyar.
    if (first.current) first.current = false
    else heading.current?.focus()
  }, [step])

  if (!allowed) return <Forbidden />
  if (query.error) return <ErrorState subject="Kurulum bilgileri" onRetry={query.refetch} />
  if (!query.data)
    return (
      <SkeletonGroup>
        <Card>
          <Skeleton className="w-1/2" />
        </Card>
      </SkeletonGroup>
    )

  const steps = stepsFor(me.tenant.businessType)
  const current = steps.find((s) => s.id === step) ?? steps[0]
  const { index, total } = stepProgress(step)
  const props: StepProps = {
    settings: query.data,
    onDone: () => setStep(nextStep(step)),
    onSkip: () => setStep(nextStep(step)),
    onBack: () => setStep(prevStep(step)),
  }
  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid gap-2">
        <p className="text-sm text-text-muted">{`Adım ${index} / ${total}`}</p>
        <div
          role="progressbar"
          aria-label="Kurulum ilerlemesi"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index}
          className="h-1 rounded-full bg-surface-active"
        >
          <div className="h-1 rounded-full bg-primary" style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <h1 ref={heading} tabIndex={-1} className="text-xl leading-7 font-semibold outline-none">
          {current.label}
        </h1>
      </div>
      <Card>{BODIES[step](props)}</Card>
    </div>
  )
}
