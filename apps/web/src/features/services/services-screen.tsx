'use client'

import { useMemo, useState } from 'react'
import { useMe, useTerm } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { ListRow } from '@/ui/list-row'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { fetchAllServices } from './api'
import { groupByCategory, OTHER_CATEGORY, serviceMeta, type ServiceRow } from './logic'
import { ServiceSheet } from './service-sheet'

// Hizmetler (tasarim.md §8.1 `hizmetler`): kategori kartları; yalnız sahip ve müdür düzenler.
const capitalize = (text: string) => (text ? text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1) : text)

export function ServicesScreen() {
  const me = useMe()
  if (me.role !== 'owner' && me.role !== 'manager') {
    return <Forbidden />
  }
  return <ServicesList />
}

function ServicesList() {
  const slug = useMe().tenant.slug
  const t = useTerm()
  const query = useApiQuery('services:all', (c, signal) => fetchAllServices(c, slug, signal))
  const [editing, setEditing] = useState<ServiceRow | 'new' | null>(null)
  const groups = useMemo(() => groupByCategory(query.data ?? []), [query.data])
  const categories = useMemo(() => groups.map((g) => g.category).filter((c) => c !== OTHER_CATEGORY), [groups])
  const plural = capitalize(t('service', 'plural'))

  let body
  if (query.error && !query.data) {
    body = (
      <Card>
        <ErrorState subject={`${plural} listesi`} onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
      </Card>
    )
  } else if (!query.data) {
    body = (
      <SkeletonGroup>
        <Card>
          <div className="grid gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className={i % 2 ? 'w-2/3' : 'w-1/2'} />
            ))}
          </div>
        </Card>
      </SkeletonGroup>
    )
  } else if (groups.length === 0) {
    body = (
      <Card>
        <EmptyState
          title={`Henüz ${t('service')} yok.`}
          description="Randevu alabilmek için en az bir tane ekleyin."
          action={{ label: `${capitalize(t('service'))} ekle`, onClick: () => setEditing('new') }}
          centered
        />
      </Card>
    )
  } else {
    body = (
      <div className="grid gap-4">
        {groups.map((group) => (
          <Card key={group.category}>
            <section aria-labelledby={`kategori-${group.category}`}>
              <h2 id={`kategori-${group.category}`} className="mb-1 text-base leading-6 font-semibold">
                {group.category}
              </h2>
              <ul className="m-0 grid list-none gap-0 p-0">
                {group.services.map((service) => (
                  <li key={service.id} className="border-b border-border-subtle last:border-b-0">
                    <ListRow
                      title={service.name}
                      subtitle={[serviceMeta(service), service.isActive ? '' : 'Pasif', service.isOnlineBookable === false ? 'Online kapalı' : '']
                        .filter(Boolean)
                        .join(' · ')}
                      onPress={() => setEditing(service)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl leading-7 font-semibold">{plural}</h1>
        <Button onClick={() => setEditing('new')}>{capitalize(t('service'))} ekle</Button>
      </div>
      {body}
      {editing ? (
        <ServiceSheet
          key={editing === 'new' ? 'new' : editing.id}
          service={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            query.refetch()
          }}
        />
      ) : null}
    </div>
  )
}
