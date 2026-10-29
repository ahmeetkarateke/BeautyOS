'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useCan, useMe, useTerm } from '@/lib/v2/session'
import { Avatar } from '@/ui/avatar'
import { Banner } from '@/ui/banner'
import { Button, buttonClassName } from '@/ui/button'
import { Card } from '@/ui/card'
import { InputField } from '@/ui/field'
import { ListRow } from '@/ui/list-row'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState } from '@/ui/states'
import { canOpen, phoneLine, searchMode, searchPhase, STAFF_MIN_CHARS, visitLine, type CustomerRow } from './logic'
import { useCustomerPages } from './use-customer-pages'

// Müşteriler (tasarim.md §8.1 `musteriler`): arama + liste + sonsuz kaydırma. Uzman için liste yoktur: yalnız arama kipi (R4).
const DEBOUNCE_MS = 300

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

const capitalize = (text: string) => (text ? text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1) : text)

export function CustomersScreen() {
  const router = useRouter()
  const slug = useMe().tenant.slug
  const t = useTerm()
  const canWrite = useCan('customer.write')
  const staffMode = searchMode(useCan('customer.view_all'))
  const [input, setInput] = useState('')
  const term = useDebounced(input, DEBOUNCE_MS).trim()
  const phase = searchPhase(term, staffMode)
  const key = phase === 'list' ? 'customers:list' : phase === 'search' ? `customers:search:${term}` : null
  const pages = useCustomerPages(key, phase === 'search' ? term : undefined)
  const clients = t('client', 'plural')
  const base = `/panel/${encodeURIComponent(slug)}`

  // Sonsuz kaydırma: sayfa sonuna gelince yükle; "Daha fazla göster" düğmesi her zaman klavye ve dokunma yoludur.
  const sentinel = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef(pages.loadMore)
  useEffect(() => {
    loadMoreRef.current = pages.loadMore
  })
  useEffect(() => {
    const node = sentinel.current
    if (!node || typeof IntersectionObserver === 'undefined' || !pages.hasMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMoreRef.current()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [pages.hasMore, pages.rows.length])

  const addAction = canWrite ? { label: `${capitalize(t('client'))} ekle`, onClick: () => router.push(`${base}/musteri-yeni`) } : undefined

  let hint = 'Ad veya telefonla arayın.'
  if (staffMode) hint = `Ad veya telefonla arayın. En az ${STAFF_MIN_CHARS} karakter yazın. Telefon numarasını yalnız randevunuz olan kişilerde görürsünüz.`
  if (phase === 'short') hint = `Aramak için en az ${STAFF_MIN_CHARS} karakter yazın.`

  let body
  if (phase === 'idle' || phase === 'short') {
    body = (
      <Card>
        <EmptyState
          title={`${capitalize(t('client'))} bulmak için arayın.`}
          description={`Listeyi yalnız salon yönetimi görür. Siz adı ya da telefonu yazarak arayabilirsiniz.`}
          centered
        />
      </Card>
    )
  } else if (pages.first.error && !pages.first.data) {
    body = (
      <Card>
        <ErrorState
          subject={`${capitalize(t('client'))} listesi`}
          onRetry={pages.first.refetch}
          retrying={pages.first.loading}
          lastLoadedAt={pages.first.loadedAt}
          className="px-0"
        />
      </Card>
    )
  } else if (!pages.first.data) {
    body = (
      <SkeletonGroup>
        <Card>
          <div className="grid gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className={i % 2 ? 'w-2/3' : 'w-1/2'} />
            ))}
          </div>
        </Card>
      </SkeletonGroup>
    )
  } else if (pages.rows.length === 0) {
    body = (
      <Card>
        {phase === 'search' ? (
          <EmptyState
            title={`“${term}” ile eşleşen ${t('client')} yok.`}
            description="Yazımı kontrol edin ya da telefonun bir kısmını yazın."
            action={addAction}
            centered
          />
        ) : (
          <EmptyState
            title={`Henüz ${t('client')} kaydı yok.`}
            description="İlk kaydı ekleyin; randevu oluştururken de ekleyebilirsiniz."
            action={addAction}
            centered
          />
        )}
      </Card>
    )
  } else {
    body = (
      <Card>
        <ul className="m-0 grid list-none gap-0 p-0" aria-label={capitalize(clients)}>
          {pages.rows.map((row) => (
            <li key={row.id} className="border-b border-border-subtle last:border-b-0">
              <CustomerLine row={row} onOpen={() => router.push(`${base}/musteri/${encodeURIComponent(row.id)}`)} />
            </li>
          ))}
        </ul>
        {pages.loadMoreFailed ? (
          <Banner tone="error" className="mt-3">
            Devamı yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.
          </Banner>
        ) : null}
        {pages.hasMore ? (
          <div ref={sentinel} className="flex justify-center pt-3">
            <Button variant="secondary" loading={pages.loadingMore} loadingText="Yükleniyor…" onClick={() => void pages.loadMore()}>
              Daha fazla göster
            </Button>
          </div>
        ) : null}
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl leading-7 font-semibold">{capitalize(staffMode ? t('clientsMine') : clients)}</h1>
        {canWrite ? (
          <Link href={`${base}/musteri-yeni`} className={buttonClassName()}>
            {capitalize(t('client'))} ekle
          </Link>
        ) : null}
      </div>
      <InputField
        label={`${capitalize(t('client'))} ara`}
        type="search"
        inputMode="search"
        autoComplete="off"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        hint={hint}
      />
      {body}
    </div>
  )
}

function CustomerLine({ row, onOpen }: { row: CustomerRow; onOpen: () => void }) {
  const open = canOpen(row)
  const visits = visitLine(row)
  const subtitle = [phoneLine(row), open ? visits : 'Sizin müşteriniz değil'].filter(Boolean).join(' · ')
  return <ListRow leading={<Avatar name={row.fullName} />} title={row.fullName} subtitle={subtitle} onPress={open ? onOpen : undefined} />
}
