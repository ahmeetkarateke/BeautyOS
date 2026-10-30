'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { GENERIC_ERROR } from '@/content/errors'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { Banner } from '@/ui/banner'
import { Button, buttonClassName } from '@/ui/button'
import { focusFirstInvalid, InputField } from '@/ui/field'
import { requestPasswordReset } from './api'
import { AuthShell } from './auth-shell'
import { validateEmail } from './logic'

// Sonuç hesap var/yok bilgisini sızdırmaz: sunucu her zaman ok döner, ekran da her zaman aynı metni gösterir (P1).
export function ForgotScreen() {
  const client = useApiClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const problem = validateEmail(email)
    setError(problem ?? undefined)
    setFailure(null)
    if (problem) return void requestAnimationFrame(() => formRef.current && focusFirstInvalid(formRef.current))
    setPending(true)
    try {
      await requestPasswordReset(client, email)
      setSent(true)
    } catch (e) {
      setFailure(e instanceof ApiError ? e.text() : GENERIC_ERROR)
      setPending(false)
    }
  }

  if (sent) {
    return (
      <AuthShell title="E-postanızı kontrol edin" focusKey="gonderildi">
        <p className="text-text-secondary">
          Bu e-posta adresiyle bir hesap varsa, şifre sıfırlama bağlantısını gönderdik. Bağlantı 1 saat geçerlidir.
        </p>
        <p className="mt-3 text-text-secondary">
          E-posta gelmediyse istenmeyen klasörüne bakın ya da <Link href="/iletisim">destek ekibine yazın</Link>.
        </p>
        <Link href="/login" className={`${buttonClassName({ variant: 'secondary', fullWidth: true })} mt-6`}>
          Giriş ekranına dön
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Şifrenizi mi unuttunuz?" lead="E-posta adresinizi yazın; şifre sıfırlama bağlantısı gönderelim.">
      {failure ? <Banner tone="error" className="mb-5">{failure}</Banner> : null}
      <form ref={formRef} noValidate onSubmit={submit} className="grid gap-4">
        <InputField label="E-posta" type="email" autoComplete="email" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
        <Button type="submit" fullWidth loading={pending} loadingText="Gönderiliyor…">
          Bağlantı gönder
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="inline-flex min-h-11 items-center">
          Giriş ekranına dön
        </Link>
      </p>
    </AuthShell>
  )
}
