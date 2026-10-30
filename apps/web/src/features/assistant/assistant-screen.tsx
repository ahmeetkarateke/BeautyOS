'use client'

import { useState } from 'react'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { formatDateTime } from '@/ui/format'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { fetchConversations } from './api'
import { botFeaturesEnabled, channelLabel, outcomeLabel } from './logic'

export function AssistantScreen() {
  const me = useMe()
  if (me.role !== 'owner') return <Forbidden />
  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <h1 className="text-xl leading-7 font-semibold">Mesaj asistanı</h1>
      {botFeaturesEnabled() ? <Conversations slug={me.tenant.slug} /> : <Disabled />}
    </div>
  )
}

function Disabled() {
  return (
    <Card>
      <EmptyState
        title="Mesaj asistanı şu an kapalı."
        description="Müşterilerinizle Telegram ve WhatsApp üzerinden yazışan asistan henüz hesabınızda etkin değil. Açıldığında konuşmalar burada listelenir."
      />
    </Card>
  )
}

function Conversations({ slug }: { slug: string }) {
  const [pages, setPages] = useState(1)
  return (
    <Card>
      <ul className="m-0 grid list-none gap-0 divide-y divide-border p-0">
        {Array.from({ length: pages }, (_, index) => (
          <ConversationPageRows key={index} slug={slug} page={index + 1} isLast={index + 1 === pages} onMore={() => setPages((p) => p + 1)} />
        ))}
      </ul>
    </Card>
  )
}

function ConversationPageRows({ slug, page, isLast, onMore }: { slug: string; page: number; isLast: boolean; onMore: () => void }) {
  const query = useApiQuery(`assistant-${slug}-${page}`, (c, signal) => fetchConversations(c, slug, page, signal))
  if (query.error && !query.data) {
    return (
      <li>
        <ErrorState subject="Konuşmalar" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
      </li>
    )
  }
  if (!query.data) {
    return (
      <li>
        <SkeletonGroup>
          <div className="grid gap-3 py-3">
            <Skeleton className="w-1/2" />
            <Skeleton className="w-2/3" />
          </div>
        </SkeletonGroup>
      </li>
    )
  }
  const { data, meta } = query.data
  if (page === 1 && data.length === 0) {
    return (
      <li>
        <EmptyState title="Henüz konuşma yok." description="Müşteriler asistanla yazışınca konuşmalar burada görünür." />
      </li>
    )
  }
  return (
    <>
      {data.map((c) => (
        <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
          <div className="min-w-0">
            <p className="m-0 font-medium">{outcomeLabel(c.outcome)}</p>
            <p className="m-0 text-sm text-text-muted">
              {channelLabel(c.channel)} · {c.turnCount} mesaj{c.referenceCode ? ` · Kod ${c.referenceCode}` : ''}
            </p>
          </div>
          <p className="m-0 text-sm text-text-muted tabular-nums">{formatDateTime(c.endedAt ?? c.startedAt)}</p>
        </li>
      ))}
      {isLast && page < meta.totalPages ? (
        <li className="pt-3">
          <Button variant="secondary" onClick={onMore}>
            Daha fazla göster
          </Button>
        </li>
      ) : null}
    </>
  )
}
