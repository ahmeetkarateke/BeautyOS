'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { focusFirstInvalid, InputField, PasswordField } from '@/ui/field'
import { login } from './api'
import { AuthShell } from './auth-shell'
import { panelPathFor, validateLogin } from './logic'

type Navigate = (path: string) => void
const defaultNavigate: Navigate = (path) => window.location.assign(path)

export function LoginScreen({ navigate = defaultNavigate }: { navigate?: Navigate }) {
  const client = useApiClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const found = validateLogin({ email, password })
    setErrors(found)
    setFailure(null)
    if (Object.keys(found).length > 0) {
      // Hatalı alanlar bu çizimden sonra aria-invalid alır; odak onlardan ilkine gider.
      requestAnimationFrame(() => formRef.current && focusFirstInvalid(formRef.current))
      return
    }
    setPending(true)
    try {
      const session = await login(client, { email, password })
      navigate(panelPathFor(session.tenantSlug))
    } catch (error) {
      setFailure(error instanceof ApiError ? error.text({ context: 'login' }) : 'Beklenmeyen bir sorun oluştu. Birkaç dakika sonra tekrar deneyin.')
      setPending(false)
    }
  }

  return (
    <AuthShell title="Giriş yap" lead="Randevu, müşteri ve kasa işleriniz tek yerde.">
      {failure ? <Banner tone="error" className="mb-5">{failure}</Banner> : null}
      <form ref={formRef} noValidate onSubmit={submit} className="grid gap-4" data-testid="giris-formu">
        <InputField
          label="E-posta"
          type="email"
          autoComplete="email"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField label="Şifre" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <div className="text-right">
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm">
            Şifremi unuttum
          </Link>
        </div>
        <Button type="submit" fullWidth loading={pending} loadingText="Giriş yapılıyor…">
          Giriş yap
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-secondary">
        Hesabınız yok mu?{' '}
        <Link href="/signup" className="inline-flex min-h-11 items-center">
          Ücretsiz deneyin
        </Link>
      </p>
    </AuthShell>
  )
}
