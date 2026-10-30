'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { GENERIC_ERROR } from '@/content/errors'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useHashToken } from '@/lib/v2/hash-token'
import { Banner } from '@/ui/banner'
import { Button, buttonClassName } from '@/ui/button'
import { focusFirstInvalid, InputField, PasswordField, PhoneField } from '@/ui/field'
import { acceptInvitation, lookupInvitation } from './api'
import type { InvitationInfo } from './api'
import { AuthShell } from './auth-shell'
import { panelPathFor, validateNewPassword } from './logic'

type Navigate = (path: string) => void
const defaultNavigate: Navigate = (path) => window.location.assign(path)

const INVALID = 'Bu bağlantı geçersiz ya da süresi dolmuş.'
const ROLE_NAMES: Record<string, string> = { owner: 'Sahip', manager: 'Müdür', receptionist: 'Resepsiyon', staff: 'Uzman' }

type Lookup = { kind: 'loading' } | { kind: 'invalid' } | { kind: 'error'; message: string } | { kind: 'ready'; info: InvitationInfo }

function InvalidLink() {
  return (
    <AuthShell title="Bağlantı geçersiz" focusKey="gecersiz">
      <Banner tone="warning">{INVALID}</Banner>
      <p className="mt-4 text-text-secondary">Salon sahibinden yeni bir davet bağlantısı isteyin.</p>
      <Link href="/login" className={`${buttonClassName({ variant: 'secondary', fullWidth: true })} mt-6`}>
        Giriş ekranına git
      </Link>
    </AuthShell>
  )
}

// Davet belirteci # parçasından okunur, hemen adresten silinir ve yalnız bellekte tutulur; API çağrılarında gövdede gider (ADR-0046).
export function InviteScreen({ navigate = defaultNavigate }: { navigate?: Navigate }) {
  const client = useApiClient()
  const tokenState = useHashToken()
  const [lookup, setLookup] = useState<Lookup>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const token = tokenState.status === 'ready' ? tokenState.token : null

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    lookupInvitation(client, token, controller.signal)
      .then((info) => setLookup({ kind: 'ready', info }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && (error.code === 'INVITATION_INVALID' || error.status === 404)) return setLookup({ kind: 'invalid' })
        setLookup({ kind: 'error', message: error instanceof ApiError ? error.text() : GENERIC_ERROR })
      })
    return () => controller.abort()
  }, [client, token, attempt])

  if (tokenState.status === 'missing') return <InvalidLink />
  if (tokenState.status === 'reading' || lookup.kind === 'loading') {
    return (
      <AuthShell title="Davet kontrol ediliyor…" focusKey="yukleniyor">
        <p role="status" className="text-text-secondary">
          Yükleniyor…
        </p>
      </AuthShell>
    )
  }
  if (lookup.kind === 'invalid') return <InvalidLink />
  if (lookup.kind === 'error') {
    return (
      <AuthShell title="Davet açılamadı" focusKey="hata">
        <Banner tone="error">{lookup.message}</Banner>
        <Button
          fullWidth
          className="mt-6"
          onClick={() => {
            setLookup({ kind: 'loading' })
            setAttempt((n) => n + 1)
          }}
        >
          Tekrar dene
        </Button>
      </AuthShell>
    )
  }
  return <AcceptForm info={lookup.info} token={token ?? ''} navigate={navigate} />
}

function AcceptForm({ info, token, navigate }: { info: InvitationInfo; token: string; navigate: Navigate }) {
  const client = useApiClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [fullName, setFullName] = useState(info.fullName ?? '')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [invalid, setInvalid] = useState(false)

  if (invalid) return <InvalidLink />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const found: Record<string, string> = {}
    const weak = validateNewPassword(password)
    if (weak) found.password = weak
    if (phone && !/^5\d{9}$/.test(phone)) found.phone = 'Telefon numarasını 5xx xxx xx xx biçiminde yazın.'
    if (fullName.trim() && fullName.trim().length < 2) found.fullName = 'Ad soyad en az 2 karakter olmalı.'
    setErrors(found)
    setFailure(null)
    if (Object.keys(found).length > 0) return void requestAnimationFrame(() => formRef.current && focusFirstInvalid(formRef.current))
    setPending(true)
    try {
      const session = await acceptInvitation(client, {
        token,
        password,
        ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
        ...(phone ? { phone: `+90${phone}` } : {}),
      })
      navigate(panelPathFor(session.tenantSlug))
    } catch (error) {
      setPending(false)
      if (error instanceof ApiError && error.code === 'INVITATION_INVALID') return setInvalid(true)
      setFailure(error instanceof ApiError ? error.text() : GENERIC_ERROR)
    }
  }

  const role = ROLE_NAMES[info.role] ?? ''
  return (
    <AuthShell title={`${info.tenantName} sizi davet etti`} lead={role ? `Rolünüz: ${role}. Giriş için şifrenizi belirleyin.` : 'Giriş için şifrenizi belirleyin.'} focusKey="form">
      {failure ? (
        <Banner tone="error" className="mb-5">
          {failure}
        </Banner>
      ) : null}
      <form ref={formRef} noValidate onSubmit={submit} className="grid gap-4">
        <InputField label="E-posta" type="email" value={info.email} readOnly autoComplete="username" />
        <InputField label="Ad soyad" optional autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
        <PhoneField label="Telefon" optional value={phone} onValueChange={setPhone} error={errors.phone} />
        <PasswordField
          label="Şifre"
          autoComplete="new-password"
          hint="En az 8 karakter; harf ve rakam içermeli."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <p className="text-sm text-text-secondary">
          <Link href="/sartlar" target="_blank">
            Kullanım şartları
          </Link>{' '}
          ve{' '}
          <Link href="/gizlilik" target="_blank">
            gizlilik politikası
          </Link>{' '}
          hesabınız için geçerlidir.
        </p>
        <Button type="submit" fullWidth loading={pending} loadingText="Hesap oluşturuluyor…">
          Hesabımı oluştur
        </Button>
      </form>
    </AuthShell>
  )
}
