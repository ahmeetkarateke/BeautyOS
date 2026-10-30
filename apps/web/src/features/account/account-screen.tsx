'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { ApiError, type ApiClient } from '@/lib/v2/api-client'
import { signOut, useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { InputField } from '@/ui/field'
import { useToast } from '@/ui/toast'
import { roleLabel } from '@/features/shell/shell-helpers'
import { emptyPassword, passwordBody, validatePassword, type PasswordValues } from './logic'

const message = (err: unknown) => (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text()

async function changePassword(client: ApiClient, slug: string, userId: string, payload: Record<string, string>) {
  await client.request<unknown>(`/api/v1/tenants/${encodeURIComponent(slug)}/users/${encodeURIComponent(userId)}/password`, {
    method: 'PATCH',
    body: payload,
  })
}

export function AccountScreen() {
  const me = useMe()
  const client = useApiClient()
  return (
    <div className="grid max-w-xl grid-cols-[minmax(0,1fr)] gap-4">
      <h1 className="text-xl leading-7 font-semibold">Hesabım</h1>
      <Card labelledBy="hesabim-profil">
        <h2 id="hesabim-profil" className="mb-3 mt-0 text-base font-semibold">
          Profil
        </h2>
        <dl className="m-0 grid gap-3">
          <div>
            <dt className="text-sm text-text-muted">Ad</dt>
            <dd className="m-0">{me.user.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">E-posta</dt>
            <dd className="m-0 break-all">{me.user.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">Rol</dt>
            <dd className="m-0">{roleLabel(me)}</dd>
          </div>
        </dl>
      </Card>
      <PasswordCard slug={me.tenant.slug} userId={me.user.id} />
      <div>
        <Button variant="secondary" icon={<LogOut aria-hidden="true" className="size-4" />} onClick={() => void signOut(client)}>
          Çıkış yap
        </Button>
      </div>
    </div>
  )
}

function PasswordCard({ slug, userId }: { slug: string; userId: string }) {
  const client = useApiClient()
  const toast = useToast()
  const [values, setValues] = useState<PasswordValues>(emptyPassword)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (key: keyof PasswordValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    const found = validatePassword(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    setFailure(null)
    try {
      await changePassword(client, slug, userId, passwordBody(values))
      // Sunucu şifre değişince tüm oturumları kapatır; yeniden girişe yönlendirilir.
      toast.show({ message: 'Şifreniz değişti. Yeniden giriş yapın.' })
      await signOut(client)
    } catch (err) {
      setFailure(message(err))
      setBusy(false)
    }
  }

  return (
    <Card labelledBy="hesabim-sifre">
      <h2 id="hesabim-sifre" className="mb-3 mt-0 text-base font-semibold">
        Şifre değiştir
      </h2>
      <form onSubmit={(event) => void save(event)} noValidate className="grid gap-4">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <InputField
          label="Mevcut şifre"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          value={values.current}
          onChange={(event) => set('current', event.target.value)}
          error={errors.current || undefined}
        />
        <InputField
          label="Yeni şifre"
          type="password"
          autoComplete="new-password"
          maxLength={129}
          hint="En az 8 karakter; en az bir harf ve bir rakam."
          value={values.next}
          onChange={(event) => set('next', event.target.value)}
          error={errors.next || undefined}
        />
        <InputField
          label="Yeni şifre (tekrar)"
          type="password"
          autoComplete="new-password"
          maxLength={129}
          value={values.confirm}
          onChange={(event) => set('confirm', event.target.value)}
          error={errors.confirm || undefined}
        />
        <div>
          <Button type="submit" disabled={busy} loading={busy} loadingText="Kaydediliyor…">
            Şifreyi değiştir
          </Button>
        </div>
      </form>
    </Card>
  )
}
