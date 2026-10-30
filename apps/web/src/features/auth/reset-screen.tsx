'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { GENERIC_ERROR } from '@/content/errors'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useHashToken } from '@/lib/v2/hash-token'
import { Banner } from '@/ui/banner'
import { Button, buttonClassName } from '@/ui/button'
import { focusFirstInvalid, PasswordField } from '@/ui/field'
import { resetPassword } from './api'
import { AuthShell } from './auth-shell'
import { validateNewPassword } from './logic'

const EXPIRED = 'Bu bağlantının süresi dolmuş. Yeni bir bağlantı isteyin.'

function ExpiredLink({ title }: { title: string }) {
  return (
    <AuthShell title={title} focusKey="gecersiz">
      <Banner tone="warning">{EXPIRED}</Banner>
      <Link href="/forgot-password" className={`${buttonClassName({ fullWidth: true })} mt-6`}>
        Yeni bağlantı iste
      </Link>
    </AuthShell>
  )
}

// Belirteç # parçasından okunur (ADR-0046): `#token=<değer>`.
export function ResetScreen() {
  const client = useApiClient()
  const tokenState = useHashToken()
  const formRef = useRef<HTMLFormElement>(null)
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [expired, setExpired] = useState(false)
  const [done, setDone] = useState(false)

  if (tokenState.status === 'reading') return <AuthShell title="Yeni şifre belirleyin" focusKey="okunuyor">{null}</AuthShell>
  if (tokenState.status === 'missing' || expired) return <ExpiredLink title="Bağlantı geçersiz" />

  if (done) {
    return (
      <AuthShell title="Şifreniz değişti" lead="Yeni şifrenizle giriş yapabilirsiniz." focusKey="bitti">
        <Link href="/login" className={buttonClassName({ fullWidth: true })}>
          Giriş yap
        </Link>
      </AuthShell>
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending || tokenState.status !== 'ready') return
    const found: Record<string, string> = {}
    const weak = validateNewPassword(password)
    if (weak) found.password = weak
    else if (repeat !== password) found.repeat = 'İki şifre aynı olmalı.'
    setErrors(found)
    setFailure(null)
    if (Object.keys(found).length > 0) return void requestAnimationFrame(() => formRef.current && focusFirstInvalid(formRef.current))
    setPending(true)
    try {
      await resetPassword(client, { token: tokenState.token, password })
      setDone(true)
    } catch (error) {
      setPending(false)
      if (error instanceof ApiError && error.code === 'INVALID_TOKEN') return setExpired(true)
      setFailure(error instanceof ApiError ? error.text({ context: 'password-reset' }) : GENERIC_ERROR)
    }
  }

  return (
    <AuthShell title="Yeni şifre belirleyin">
      {failure ? <Banner tone="error" className="mb-5">{failure}</Banner> : null}
      <form ref={formRef} noValidate onSubmit={submit} className="grid gap-4">
        <PasswordField
          label="Yeni şifre"
          autoComplete="new-password"
          hint="En az 8 karakter; harf ve rakam içermeli."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <PasswordField label="Yeni şifre (tekrar)" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} error={errors.repeat} />
        <Button type="submit" fullWidth loading={pending} loadingText="Kaydediliyor…">
          Şifreyi değiştir
        </Button>
      </form>
    </AuthShell>
  )
}
