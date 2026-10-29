'use client'

import { useState } from 'react'
import { approveRequest, fetchCustomerCandidates, rejectRequest, type ApproveChoice } from '@/features/appointments/api'
import { clockLabel, type DayAppointment } from '@/features/appointments/day-logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { useMe } from '@/lib/v2/session'
import { Button } from '@/ui/button'
import { Radio, RadioGroup } from '@/ui/choice'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { formatDate } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { ErrorState } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { Banner } from '@/ui/banner'

// Online randevu talebini onaylama / reddetme (S2 uçları). Doğrulanmamış talepte aynı telefonla kayıtlı müşteri varsa
// salon bilinçli seçer: o müşteriye bağla ya da yeni müşteri olarak ekle. Seçim yapılmadan onay açılmaz.
const CREATE = 'create'

export function ApprovalSheet({ request, onClose, onChanged }: { request: DayAppointment | null; onClose: () => void; onChanged: () => void }) {
  return (
    <Sheet
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Online randevu talebi"
      description={request ? 'Onaylayınca randevu kesinleşir.' : undefined}
    >
      {request ? <ApprovalBody key={request.id} request={request} onClose={onClose} onChanged={onChanged} /> : null}
    </Sheet>
  )
}

function ApprovalBody({ request, onClose, onChanged }: { request: DayAppointment; onClose: () => void; onChanged: () => void }) {
  const client = useApiClient()
  const toast = useToast()
  const slug = useMe().tenant.slug
  const [choice, setChoice] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)

  // Doğrulanmamış ya da müşterisi bağlanamamış (aynı telefonda birden çok kart) talep eşleştirme ister.
  const needsMatch = request.unverified || request.customerId === null
  const candidates = useApiQuery(needsMatch ? `candidates:${request.id}` : null, (c, signal) => fetchCustomerCandidates(c, slug, request.id, signal))
  const candidateList = candidates.data ?? []
  const hasCandidates = candidateList.length > 0
  const candidatesReady = !needsMatch || (candidates.data !== undefined && !candidates.error)
  const canApprove = candidatesReady && !candidates.loading && busy === null && (!hasCandidates || choice !== '')

  async function run(kind: 'approve' | 'reject') {
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'approve') {
        const body: ApproveChoice | undefined = !hasCandidates ? undefined : choice === CREATE ? { customerAction: 'create' } : { customerAction: 'link', customerId: choice }
        await approveRequest(client, slug, request.id, body)
        toast.show({ message: 'Randevu talebi onaylandı.' })
      } else {
        await rejectRequest(client, slug, request.id)
        toast.show({ message: 'Randevu talebi reddedildi.' })
      }
      onChanged()
      onClose()
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })
      setError(apiError.text())
      // Talep başka biri tarafından işlendiyse ya da aday listesi eskidiyse ekran gerçeğe döner.
      if (apiError.code === 'NOT_PENDING') onChanged()
      if (apiError.code === 'CUSTOMER_MATCH_REQUIRED') candidates.refetch()
    } finally {
      setBusy(null)
      setConfirmReject(false)
    }
  }

  return (
    <div className="grid gap-4 pb-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
        <dt className="text-text-muted">Müşteri</dt>
        <dd className="m-0 font-medium">{request.customerName}</dd>
        {request.customerPhone ? (
          <>
            <dt className="text-text-muted">Telefon</dt>
            <dd className="m-0 tabular-nums">{request.customerPhone}</dd>
          </>
        ) : null}
        <dt className="text-text-muted">Hizmet</dt>
        <dd className="m-0">{request.serviceName}</dd>
        <dt className="text-text-muted">Uzman</dt>
        <dd className="m-0">{request.staffName}</dd>
        <dt className="text-text-muted">Zaman</dt>
        <dd className="m-0 tabular-nums">
          {formatDate(request.start, 'long')} · {clockLabel(request.start)} – {clockLabel(request.end)}
        </dd>
      </dl>

      {needsMatch && candidates.error ? (
        <ErrorState subject="Eşleşen müşteriler" onRetry={candidates.refetch} retrying={candidates.loading} lastLoadedAt={candidates.loadedAt} className="px-0" />
      ) : null}

      {needsMatch && hasCandidates ? (
        <RadioGroup legend="Bu telefonla kayıtlı müşteri var. Bu kişi mi?" value={choice} onValueChange={setChoice}>
          {candidateList.map((c) => (
            <Radio key={c.id} value={c.id} label={c.fullName} description={c.phone} />
          ))}
          <Radio value={CREATE} label="Yeni müşteri olarak kaydet" description="Listedeki kişilerden hiçbiri değilse." />
          {choice === CREATE ? <p className="mt-1 text-sm text-text-muted">Bu telefon başka bir müşteride de kayıtlı kalacak.</p> : null}
        </RadioGroup>
      ) : null}

      {error ? <Banner tone="error">{error}</Banner> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="danger" disabled={busy !== null} onClick={() => setConfirmReject(true)}>
          Talebi reddet
        </Button>
        <Button disabled={!canApprove} loading={busy === 'approve'} loadingText="Onaylanıyor…" onClick={() => void run('approve')}>
          Talebi onayla
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReject}
        onOpenChange={setConfirmReject}
        title="Talebi reddetmek istiyor musunuz?"
        description={`${request.customerName} için ${clockLabel(request.start)} randevusu iptal edilir. Bu işlem geri alınamaz.`}
        actionLabel="Talebi reddet"
        loading={busy === 'reject'}
        loadingText="Reddediliyor…"
        onConfirm={() => void run('reject')}
      />
    </div>
  )
}
