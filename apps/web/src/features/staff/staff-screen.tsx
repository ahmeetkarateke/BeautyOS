'use client'

import Link from 'next/link'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Avatar, personTone } from '@/ui/avatar'
import { Card } from '@/ui/card'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { fetchStaffProfiles } from './api'
import { InviteSection } from './invite-section'

// Personel (tasarim.md §8.1 `personel`): liste; ayrıntı personel-detay/<id>. Yalnız sahip ve müdür. Davet (A3) yalnız sahipte: bekleyen davetler + gönderme.
export function StaffScreen() {
  const me = useMe()
  if (me.role !== 'owner' && me.role !== 'manager') return <Forbidden />
  return <StaffList />
}

function StaffList() {
  const me = useMe()
  const slug = me.tenant.slug
  const isOwner = me.role === 'owner'
  const query = useApiQuery('staff:profiles', (c, signal) => fetchStaffProfiles(c, slug, signal))
  const base = `/panel/${encodeURIComponent(slug)}`

  let body
  if (query.error && !query.data) {
    body = (
      <Card>
        <ErrorState subject="Personel listesi" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
      </Card>
    )
  } else if (!query.data) {
    body = (
      <SkeletonGroup>
        <Card>
          <div className="grid gap-4">
            <Skeleton className="w-1/2" />
            <Skeleton className="w-2/3" />
          </div>
        </Card>
      </SkeletonGroup>
    )
  } else if (query.data.length === 0) {
    body = (
      <Card>
        <EmptyState title="Henüz personel yok." description="Randevu alabilmek için en az bir uzman gerekir." centered />
      </Card>
    )
  } else {
    body = (
      <Card>
        <ul aria-label="Personel" className="m-0 grid list-none gap-0 p-0">
          {query.data.map((person) => (
            <li key={person.id} className="border-b border-border-subtle last:border-b-0">
              <Link
                href={`${base}/personel-detay/${encodeURIComponent(person.id)}`}
                className="flex min-h-(--size-row) items-center gap-3 rounded-control px-1 py-2 text-text no-underline hover:bg-surface-subtle"
              >
                <Avatar name={person.fullName} tone={personTone(person.id)} />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-medium">{person.fullName}</span>
                  <span className="truncate text-sm text-text-muted">{[person.title, `${person.skills.length} hizmet`].filter(Boolean).join(' · ')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    )
  }

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl leading-7 font-semibold">Personel</h1>
      </div>
      {isOwner ? <InviteSection /> : null}
      {body}
    </div>
  )
}
