'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { GENERIC_ERROR } from '@/content/errors'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { LegalCheckbox } from '@/ui/choice'
import { focusFirstInvalid, InputField, PasswordField, PhoneField, SelectField } from '@/ui/field'
import { register } from './api'
import { AuthShell } from './auth-shell'
import { MAIN_BUSINESS_TYPES, OTHER_BUSINESS_TYPES, panelPathFor, slugify, toRegisterBody, validateStep1, validateStep2 } from './logic'

type Navigate = (path: string) => void
const defaultNavigate: Navigate = (path) => window.location.assign(path)
type Errors = Record<string, string>

// Kayıt iki adımdır (tasarim.md §8.3). Adres önerisi işletme adından üretilir; kullanıcı adrese dokununca öneri durur.
export function SignupScreen({ navigate = defaultNavigate }: { navigate?: Navigate }) {
  const client = useApiClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [salonName, setSalonName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [type, setType] = useState('')
  const [otherType, setOtherType] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  // K3 (isteğe bağlı ticari ileti izni): sunucu alanı gelene kadar yalnız arayüzde tutulur, API'ye gönderilmez.
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const focusInvalid = () => requestAnimationFrame(() => formRef.current && focusFirstInvalid(formRef.current))

  function changeName(value: string) {
    setSalonName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  function nextStep(event: FormEvent) {
    event.preventDefault()
    const found = validateStep1({ salonName, slug, type, otherType })
    setErrors(found)
    if (Object.keys(found).length > 0) return focusInvalid()
    setStep(2)
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const found = validateStep2({ fullName, phone, email, password, acceptTerms })
    setErrors(found)
    setFailure(null)
    if (Object.keys(found).length > 0) return focusInvalid()
    setPending(true)
    try {
      const session = await register(client, toRegisterBody({ salonName, slug, type, otherType }, { fullName, phone, email, password, acceptTerms }))
      navigate(panelPathFor(session.tenantSlug))
    } catch (error) {
      setPending(false)
      if (!(error instanceof ApiError)) return setFailure(GENERIC_ERROR)
      // Alanla ilgili çakışmalar kullanıcıyı doğru alana götürür.
      if (error.code === 'DUPLICATE_SLUG') {
        setErrors({ slug: error.text() })
        setStep(1)
        return focusInvalid()
      }
      if (error.code === 'DUPLICATE_EMAIL') {
        setErrors({ email: error.text() })
        return focusInvalid()
      }
      setFailure(error.text({ context: 'register' }))
    }
  }

  if (step === 1) {
    return (
      <AuthShell title="İşletmenizi tanıtın" lead="30 gün ücretsiz. Kart bilgisi istenmez." stepLabel="Adım 1/2" focusKey="adim-1">
        <form ref={formRef} noValidate onSubmit={nextStep} className="grid gap-4">
          <InputField label="İşletme adı" autoComplete="organization" value={salonName} onChange={(e) => changeName(e.target.value)} error={errors.salonName} />
          <SelectField label="İşletme türü" value={type} onChange={(e) => setType(e.target.value)} error={errors.type}>
            <option value="">Seçin</option>
            {MAIN_BUSINESS_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </SelectField>
          {type === 'other' ? (
            <SelectField label="Hangi alanda çalışıyorsunuz?" value={otherType} onChange={(e) => setOtherType(e.target.value)}>
              <option value="">Seçin</option>
              {OTHER_BUSINESS_TYPES.map((t) => (
                <option key={t.label} value={t.id}>
                  {t.label}
                </option>
              ))}
            </SelectField>
          ) : null}
          <InputField
            label="Online randevu adresi"
            hint={`beautyossapp.com/book/${slug || 'adresiniz'}`}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value.toLowerCase())
            }}
            error={errors.slug}
          />
          <Button type="submit" fullWidth>
            Devam et
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-text-secondary">
          Hesabınız var mı?{' '}
          <Link href="/login" className="inline-flex min-h-11 items-center">
            Giriş yapın
          </Link>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Hesap bilgileriniz" stepLabel="Adım 2/2" focusKey="adim-2">
      {failure ? <Banner tone="error" className="mb-5">{failure}</Banner> : null}
      <form ref={formRef} noValidate onSubmit={create} className="grid gap-4">
        <InputField label="Ad soyad" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
        <PhoneField label="Telefon" value={phone} onValueChange={setPhone} error={errors.phone} />
        <InputField label="E-posta" type="email" autoComplete="email" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <PasswordField
          label="Şifre"
          autoComplete="new-password"
          hint="En az 8 karakter; harf ve rakam içermeli."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <div>
          <LegalCheckbox
            checked={acceptTerms}
            onCheckedChange={setAcceptTerms}
            aria-invalid={errors.acceptTerms ? true : undefined}
            label={
              <>
                <Link href="/sartlar" target="_blank">
                  Kullanım şartlarını
                </Link>{' '}
                ve{' '}
                <Link href="/gizlilik" target="_blank">
                  gizlilik politikasını
                </Link>{' '}
                okudum, kabul ediyorum.
              </>
            }
          />
          {errors.acceptTerms ? (
            <p role="alert" className="text-sm leading-5 text-danger">
              {errors.acceptTerms}
            </p>
          ) : null}
          <LegalCheckbox
            checked={marketingOptIn}
            onCheckedChange={setMarketingOptIn}
            label={
              <>
                BeautyOS’un yeni özellik ve kampanya duyurularını e-postayla almak istiyorum. <span className="text-text-muted">(İsteğe bağlı)</span>
              </>
            }
          />
          <p className="mt-1 text-sm text-text-secondary">
            Kişisel verilerinizin nasıl işlendiğini{' '}
            <Link href="/kvkk" target="_blank">
              aydınlatma metninde
            </Link>{' '}
            bulabilirsiniz.
          </p>
        </div>
        <Button type="submit" fullWidth loading={pending} loadingText="Hesap oluşturuluyor…">
          Hesap oluştur
        </Button>
        <Button variant="text" onClick={() => setStep(1)}>
          Geri dön
        </Button>
      </form>
    </AuthShell>
  )
}
