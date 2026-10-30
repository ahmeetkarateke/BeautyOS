'use client'

import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Card } from '@/ui/card'
import { formatDate, formatMoney } from '@/ui/format'
import { Skeleton } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { StatusBadge } from '@/ui/status-badge'
import { fetchMyPayouts } from './api'

// Primim (tasarim.md §8.1 `primim`): uzmanın kendi ödemeleri. Ay özeti (hizmet, ciro, prim, bahşiş) için uzmana açık uç yok: "Yakında".
const STATUS: Record<string, string> = { pending: 'Bekliyor', paid: 'Ödendi', cancelled: 'İptal edildi' }

export function PrimimScreen() {
  const me = useMe()
  if (me.role !== 'staff') return <Forbidden />
  return <PrimimBody />
}

function PrimimBody() {
  const slug = useMe().tenant.slug
  const query = useApiQuery('primim:payouts', (c, signal) => fetchMyPayouts(c, slug, signal))

  let list
  if (query.error && !query.data) {
    list = <ErrorState subject="Ödemeleriniz" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
  } else if (!query.data) {
    list = <Skeleton className="w-2/3" />
  } else if (query.data.length === 0) {
    list = <EmptyState title="Henüz ödeme kaydı yok." description="Prim ödemeleriniz yapıldıkça burada görünür." centered />
  } else {
    list = (
      <ul aria-label="Ödemelerim" className="m-0 grid list-none gap-0 p-0">
        {query.data.map((p) => (
          <li key={p.id} className="grid gap-0.5 border-b border-border-subtle py-3 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium tabular-nums">
                {formatDate(`${p.periodStart}T12:00:00+03:00`, 'short')} – {formatDate(`${p.periodEnd}T12:00:00+03:00`, 'short')}
              </span>
              <span className="font-semibold tabular-nums">{formatMoney(p.netAmount)}</span>
            </div>
            <span className="text-sm text-text-muted">
              {STATUS[p.status] ?? 'Bilinmiyor'}
              {p.paidAt ? ` · ${formatDate(p.paidAt, 'short')}` : ''}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <h1 className="text-xl leading-7 font-semibold">Primim</h1>
      <Card>
        <p className="flex items-center gap-2 text-base text-text-secondary">
          Bu ayın hizmet, ciro ve prim özeti <StatusBadge status="soon" />
        </p>
      </Card>
      <Card>
        <div className="grid gap-3">
          <h2 className="text-base leading-6 font-semibold">Ödemelerim</h2>
          {list}
        </div>
      </Card>
    </div>
  )
}
