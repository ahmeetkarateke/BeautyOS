'use client'

import { useState } from 'react'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { fetchCustomerPage } from './api'
import type { CustomerRow } from './logic'

// Sonsuz kaydırma: ilk sayfa useApiQuery'den, sonrakiler imleçle eklenir. Ek sayfalar sorgu anahtarına bağlıdır:
// arama değişince eski aramanın satırları hiçbir zaman karışmaz (W10-1 dersi).
type More = { key: string; rows: CustomerRow[]; next: string | null; failed: boolean }

export function useCustomerPages(key: string | null, search: string | undefined) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const first = useApiQuery(key, (c, signal) => fetchCustomerPage(c, slug, { search }, signal))
  const [more, setMore] = useState<More | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const extra = more && more.key === key ? more : null
  const rows = first.data ? [...first.data.rows, ...(extra?.rows ?? [])] : []
  const next = first.data ? (extra ? extra.next : first.data.nextCursor) : null

  async function loadMore() {
    if (key === null || !next || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchCustomerPage(client, slug, { search, cursor: next })
      setMore((previous) => {
        const kept = previous && previous.key === key ? previous.rows : []
        const seen = new Set([...(first.data?.rows ?? []), ...kept].map((r) => r.id))
        return { key, rows: [...kept, ...page.rows.filter((r) => !seen.has(r.id))], next: page.nextCursor, failed: false }
      })
    } catch {
      // Hata sessiz kalmaz: imleç korunur, "Daha fazla göster" yanında hata çıkar.
      setMore((previous) => ({ key, rows: previous && previous.key === key ? previous.rows : [], next, failed: true }))
    } finally {
      setLoadingMore(false)
    }
  }

  return { first, rows, hasMore: next !== null, loadingMore, loadMoreFailed: extra?.failed ?? false, loadMore }
}
