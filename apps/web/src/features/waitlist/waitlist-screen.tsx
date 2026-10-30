'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Avatar } from '@/ui/avatar'
import { Button, buttonClassName } from '@/ui/button'
import { Card } from '@/ui/card'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { SegmentedControl } from '@/ui/segmented-control'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { AddToWaitlistSheet } from './add-sheet'
import { fetchWaitlist, removeFromWaitlist } from './api'
import { canNotify, preferenceLine, sortEntries, statusLabel, type WaitEntry } from './logic'
import { NotifySheet } from './notify-sheet'

// Bekleme listesi (tasarim.md §8.1 `bekleme`): liste, Müşteriye haber ver, Listeden çıkar, Listeye ekle.
// Randevuya çevirme sunucuda mevcut bir randevuya bağlama olarak var; arayüzü sonraki parçadır (şimdilik Randevu oluştur bağlantısı).
const VIEWS = [
  { value: 'open', label: 'Açık' },
  { value: 'closed', label: 'Kapanan' },
] as const

export function WaitlistScreen() {
  const me = useMe()
  if (!(me.permissions as readonly string[]).includes('waitlist.view')) return <Forbidden />
  return <WaitlistBody />
}

function WaitlistBody() {
  const me = useMe()
  const client = useApiClient()
  const toast = useToast()
  const slug = me.tenant.slug
  const canWrite = (me.permissions as readonly string[]).includes('waitlist.write')
  const query = useApiQuery('waitlist', (c, signal) => fetchWaitlist(c, slug, signal))
  const [view, setView] = useState<'open' | 'closed'>('open')
  const [adding, setAdding] = useState(false)
  const [notifying, setNotifying] = useState<WaitEntry | null>(null)
  const [removing, setRemoving] = useState<WaitEntry | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  const entries = useMemo(() => sortEntries(query.data ?? []).filter((e) => (view === 'open' ? canNotify(e.status) : !canNotify(e.status))), [query.data, view])
  const base = `/panel/${encodeURIComponent(slug)}`

  async function remove(entry: WaitEntry) {
    setRemoveBusy(true)
    try {
      await removeFromWaitlist(client, slug, entry.id)
      toast.show({ message: 'Listeden çıkarıldı.' })
    } catch (err) {
      toast.show({ message: (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text(), tone: 'error' })
    } finally {
      setRemoveBusy(false)
      setRemoving(null)
      query.refetch()
    }
  }

  let body
  if (query.error && !query.data) {
    body = (
      <Card>
        <ErrorState subject="Bekleme listesi" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
      </Card>
    )
  } else if (!query.data) {
    body = (
      <SkeletonGroup>
        <Card>
          <div className="grid gap-4">
            <Skeleton className="w-1/2" />
            <Skeleton className="w-2/3" />
            <Skeleton className="w-1/3" />
          </div>
        </Card>
      </SkeletonGroup>
    )
  } else if (entries.length === 0) {
    body = (
      <Card>
        <EmptyState
          title={view === 'open' ? 'Bekleme listesi boş.' : 'Kapanan kayıt yok.'}
          description={view === 'open' ? 'Uygun saat bulunamayan müşteriyi listeye ekleyin; saat açılınca ona haber verirsiniz.' : undefined}
          action={view === 'open' && canWrite ? { label: 'Listeye ekle', onClick: () => setAdding(true) } : undefined}
          centered
        />
      </Card>
    )
  } else {
    body = (
      <Card>
        <ul aria-label={view === 'open' ? 'Açık kayıtlar' : 'Kapanan kayıtlar'} className="m-0 grid list-none gap-0 p-0">
          {entries.map((entry) => (
            <li key={entry.id} className="grid gap-2 border-b border-border-subtle py-3 last:border-b-0">
              <div className="flex items-start gap-3">
                <Avatar name={entry.customerName} />
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-medium">{entry.customerName}</span>
                  <span className="text-sm text-text-muted">{preferenceLine(entry)}</span>
                  {entry.notes ? <span className="text-sm text-text-secondary [overflow-wrap:anywhere]">{entry.notes}</span> : null}
                </div>
                <span className="flex-none text-sm text-text-secondary">{statusLabel(entry.status)}</span>
              </div>
              {canWrite && canNotify(entry.status) ? (
                <div className="flex flex-wrap gap-2 pl-12">
                  <Button size="sm" onClick={() => setNotifying(entry)}>
                    Haber ver
                  </Button>
                  <Link href={`${base}/takvim?yeni=1`} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
                    Randevu oluştur
                  </Link>
                  <Button size="sm" variant="text" onClick={() => setRemoving(entry)}>
                    Listeden çıkar
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    )
  }

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl leading-7 font-semibold">Bekleme listesi</h1>
        {canWrite ? <Button onClick={() => setAdding(true)}>Listeye ekle</Button> : null}
      </div>
      <SegmentedControl aria-label="Kayıt durumu" options={VIEWS} value={view} onValueChange={(value) => setView(value as 'open' | 'closed')} />
      {body}
      {adding ? (
        <AddToWaitlistSheet
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false)
            query.refetch()
          }}
        />
      ) : null}
      {notifying ? (
        <NotifySheet
          entry={notifying}
          onClose={() => setNotifying(null)}
          onDone={() => {
            setNotifying(null)
            query.refetch()
          }}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !removeBusy) setRemoving(null)
          }}
          title="Listeden çıkarılsın mı?"
          description={`${removing.customerName} bekleme listesinden çıkar ve ona haber verilmez. Gerekirse yeniden ekleyebilirsiniz.`}
          actionLabel="Listeden çıkar"
          loading={removeBusy}
          loadingText="Çıkarılıyor…"
          onConfirm={() => void remove(removing)}
        />
      ) : null}
    </div>
  )
}
