'use client'

import { useState } from 'react'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { InputField, SelectField } from '@/ui/field'
import { formatDate } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { EmptyState, ErrorState } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { roleLabel } from '@/features/shell/shell-helpers'
import { cancelInvitation, createInvitation, fetchInvitations, resendInvitation, type SentInvite } from './invite-api'
import { emptyInvite, INVITE_ROLES, inviteBody, inviteErrorText, validateInvite, type InviteRole, type InviteValues } from './invite-logic'

const message = (err: unknown) => {
  const error = err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })
  return inviteErrorText(error.code, error.text())
}

/** Davet bağlantısı yalnız bellekte tutulur ve yalnız bu yanıtta görünür; sayfa yenilenince kaybolur. */
type Shown = SentInvite & { email: string }

export function InviteSection() {
  const me = useMe()
  const slug = me.tenant.slug
  const [adding, setAdding] = useState(false)
  const [shown, setShown] = useState<Shown | null>(null)
  const list = useApiQuery(`staff:invitations:${slug}`, (c, signal) => fetchInvitations(c, slug, signal))
  const base = { ...me }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)}>Personel davet et</Button>
      </div>
      {shown ? <LinkNotice shown={shown} onClose={() => setShown(null)} /> : null}
      <Card labelledBy="bekleyen-davetler">
        <h2 id="bekleyen-davetler" className="mb-2 mt-0 text-base font-semibold">
          Bekleyen davetler
        </h2>
        {list.error && !list.data ? (
          <ErrorState subject="Bekleyen davetler" onRetry={list.refetch} retrying={list.loading} lastLoadedAt={list.loadedAt} className="px-0" />
        ) : !list.data ? (
          <p role="status" className="m-0 text-sm text-text-muted">
            Yükleniyor…
          </p>
        ) : list.data.length === 0 ? (
          <EmptyState title="Bekleyen davet yok." description="Davet ettiğiniz kişi bağlantıyı açıp şifresini belirleyince personel listesine eklenir." />
        ) : (
          <ul aria-label="Bekleyen davetler" className="m-0 grid list-none gap-0 p-0">
            {list.data.map((invite) => (
              <PendingRow
                key={invite.id}
                slug={slug}
                invite={invite}
                roleText={roleLabel({ ...base, role: invite.role as InviteRole })}
                onChanged={list.refetch}
                onSent={(sent) => setShown({ ...sent, email: invite.email })}
              />
            ))}
          </ul>
        )}
      </Card>
      {adding ? (
        <InviteSheet
          slug={slug}
          onClose={() => setAdding(false)}
          onSent={(sent, email) => {
            setAdding(false)
            setShown({ ...sent, email })
            list.refetch()
          }}
        />
      ) : null}
    </>
  )
}

function LinkNotice({ shown, onClose }: { shown: Shown; onClose: () => void }) {
  const toast = useToast()
  async function copy() {
    try {
      await navigator.clipboard.writeText(shown.link)
      toast.show({ message: 'Bağlantı kopyalandı.' })
    } catch {
      toast.show({ message: 'Kopyalanamadı. Bağlantıyı elle seçip kopyalayın.' })
    }
  }
  return (
    <Banner tone={shown.emailSent ? 'success' : 'warning'} action={{ label: 'Kapat', onClick: onClose }}>
      <div className="grid gap-2">
        <p className="m-0">
          {shown.emailSent
            ? `Davet ${shown.email} adresine e-postayla gönderildi.`
            : 'E-posta gönderilemedi. Bağlantıyı kopyalayıp kişiye kendiniz iletin.'}{' '}
          Bağlantı yalnız şimdi gösterilir ve {formatDate(shown.expiresAt, 'short')} tarihine kadar geçerlidir.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly aria-label="Davet bağlantısı" value={shown.link} onFocus={(event) => event.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-3 text-sm" />
          <Button variant="secondary" onClick={() => void copy()}>
            Bağlantıyı kopyala
          </Button>
        </div>
      </div>
    </Banner>
  )
}

function PendingRow({
  slug,
  invite,
  roleText,
  onChanged,
  onSent,
}: {
  slug: string
  invite: { id: string; email: string; fullName: string; expiresAt: string; expired: boolean }
  roleText: string
  onChanged: () => void
  onSent: (sent: SentInvite) => void
}) {
  const client = useApiClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function resend() {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      onSent(await resendInvitation(client, slug, invite.id))
      onChanged()
    } catch (err) {
      setFailure(message(err))
    } finally {
      setBusy(false)
    }
  }
  async function cancel() {
    if (busy) return
    setBusy(true)
    try {
      await cancelInvitation(client, slug, invite.id)
      toast.show({ message: 'Davet iptal edildi.' })
      setConfirming(false)
      onChanged()
    } catch (err) {
      setFailure(message(err))
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="grid gap-2 border-b border-border-subtle py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 truncate font-medium">{invite.fullName}</p>
          <p className="m-0 truncate text-sm text-text-muted">
            {invite.email} · {roleText} · {invite.expired ? 'Süresi doldu' : `${formatDate(invite.expiresAt, 'short')} tarihine kadar geçerli`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void resend()}>
            Yeniden gönder
          </Button>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
            İptal et
          </Button>
        </div>
      </div>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => !busy && setConfirming(open)}
        title="Davet iptal edilsin mi?"
        description={`${invite.fullName} için gönderilen bağlantı çalışmaz hale gelir.`}
        actionLabel="Daveti iptal et"
        cancelLabel="Vazgeç"
        loading={busy}
        loadingText="İptal ediliyor…"
        onConfirm={() => void cancel()}
      />
    </li>
  )
}

function InviteSheet({ slug, onClose, onSent }: { slug: string; onClose: () => void; onSent: (sent: SentInvite, email: string) => void }) {
  const client = useApiClient()
  const me = useMe()
  const [values, setValues] = useState<InviteValues>(emptyInvite)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof InviteValues>(key: K, value: InviteValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  async function save() {
    if (busy) return
    const found = validateInvite(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    setFailure(null)
    try {
      onSent(await createInvitation(client, slug, inviteBody(values)), values.email.trim())
    } catch (err) {
      setFailure(message(err))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title="Personel davet et"
      description="Kişiye e-postayla bir bağlantı gider; bağlantıdan şifresini belirler ve hesabı açılır."
      footer={
        <Button disabled={busy} loading={busy} loadingText="Gönderiliyor…" onClick={() => void save()}>
          Daveti gönder
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <InputField label="Ad soyad" maxLength={100} autoComplete="off" value={values.fullName} onChange={(event) => set('fullName', event.target.value)} error={errors.fullName || undefined} />
        <InputField label="E-posta" type="email" inputMode="email" autoComplete="off" value={values.email} onChange={(event) => set('email', event.target.value)} error={errors.email || undefined} />
        <SelectField label="Rol" value={values.role} onChange={(event) => set('role', event.target.value as InviteRole)}>
          {INVITE_ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabel({ ...me, role })}
            </option>
          ))}
        </SelectField>
        <InputField label="Unvan" optional maxLength={100} value={values.title} onChange={(event) => set('title', event.target.value)} error={errors.title || undefined} />
      </div>
    </Sheet>
  )
}
