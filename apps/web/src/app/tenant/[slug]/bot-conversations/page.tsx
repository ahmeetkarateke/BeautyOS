'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, ChevronLeft, ChevronRight, Phone, Calendar, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { formatDate } from '@/lib/utils'

interface ConversationSummary {
  id: string
  channel: string
  customerRef: string
  outcome: string
  referenceCode: string | null
  turnCount: number
  startedAt: string
  endedAt: string
}

interface ConversationDetail extends ConversationSummary {
  messages: Array<{ role: 'user' | 'assistant'; content: string; ts: number }>
}

interface Meta {
  total: number
  page: number
  limit: number
  totalPages: number
}

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  booked:    { label: 'Randevu Alındı', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'İptal Edildi',   color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  handoff:   { label: 'Yönlendirildi',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  abandoned: { label: 'Yarıda Bırakıldı', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
}

const CHANNEL_LABELS: Record<string, string> = {
  telegram:  'Telegram',
  whatsapp:  'WhatsApp',
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const cfg = OUTCOME_LABELS[outcome] ?? { label: outcome, color: 'bg-zinc-100 text-zinc-600' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function TranscriptModal({
  slug,
  conversationId,
  onClose,
}: {
  slug: string
  conversationId: string
  onClose: () => void
}) {
  const token = useAuthStore((s) => s.token)

  const { data, isLoading } = useQuery({
    queryKey: ['bot-conversation', conversationId],
    queryFn: () =>
      apiFetch<{ data: ConversationDetail }>(`/api/v1/tenants/${slug}/bot-conversations/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((json) => json.data),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <div>
            <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              {data ? (CHANNEL_LABELS[data.channel] ?? data.channel) + ' — ' + data.customerRef : '…'}
            </p>
            {data && (
              <p className="text-xs text-zinc-500 mt-0.5">
                {formatDate(data.startedAt)} · {data.turnCount} tur · <OutcomeBadge outcome={data.outcome} />
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {isLoading && (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          )}
          {data?.messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-pink-500 text-white rounded-br-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>

        {data?.referenceCode && (
          <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 flex items-center gap-1.5">
            <Hash size={12} />
            Randevu: <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{data.referenceCode}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BotConversationsPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const token = useAuthStore((s) => s.token)
  const [page, setPage] = useState(1)
  const [outcomeFilter, setOutcomeFilter] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['bot-conversations', slug, page, outcomeFilter],
    queryFn: () => {
      const qp = new URLSearchParams({ page: String(page), limit: '20' })
      if (outcomeFilter) qp.set('outcome', outcomeFilter)
      return apiFetch<{ data: ConversationSummary[]; meta: Meta }>(
        `/api/v1/tenants/${slug}/bot-conversations?${qp}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
    },
  })

  const conversations = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30">
          <MessageSquare size={20} className="text-pink-600 dark:text-pink-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Bot Konuşmaları</h1>
          <p className="text-sm text-zinc-500">Müşterilerin bot ile yaptığı yazışmalar</p>
        </div>
      </div>

      {/* Filtre */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['', 'booked', 'cancelled', 'handoff', 'abandoned'].map((o) => (
          <button
            key={o}
            onClick={() => { setOutcomeFilter(o); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              outcomeFilter === o
                ? 'bg-pink-500 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {o === '' ? 'Tümü' : (OUTCOME_LABELS[o]?.label ?? o)}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24 ml-auto" />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 text-sm">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
            Henüz konuşma kaydı yok
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      {CHANNEL_LABELS[c.channel] ?? c.channel}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-zinc-700 dark:text-zinc-300 font-medium truncate">
                      <Phone size={12} className="shrink-0" />
                      {c.customerRef}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <OutcomeBadge outcome={c.outcome} />
                    <span className="text-xs text-zinc-400">{c.turnCount} tur</span>
                    {c.referenceCode && (
                      <span className="text-xs text-zinc-400 font-mono">{c.referenceCode}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-zinc-400 flex items-center gap-1 justify-end">
                    <Calendar size={11} />
                    {formatDate(c.endedAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sayfalama */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-zinc-500">{meta.total} konuşma</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {page} / {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {selectedId && (
        <TranscriptModal
          slug={slug}
          conversationId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
