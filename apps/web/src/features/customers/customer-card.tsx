'use client'

import Link from 'next/link'
import { useState } from 'react'
import { whatsappHref } from '@/features/appointment-detail/actions'
import { useCan, useMe, useTerm } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Avatar } from '@/ui/avatar'
import { buttonClassName } from '@/ui/button'
import { Card } from '@/ui/card'
import { cn } from '@/ui/cn'
import { formatDate, formatMoney, formatTime } from '@/ui/format'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState } from '@/ui/states'
import { StatusBadge, type AppointmentStatus } from '@/ui/status-badge'
import { SummaryStrip } from '@/ui/summary-strip'
import { Tab, TabList, TabPanel, Tabs } from '@/ui/tabs'
import { fetchAnamnesis, fetchCustomerCard } from './card-api'
import { availableTabs, formatAnswer, summaryItems, type CardDetail, type TabValue } from './card-logic'

// Müşteri kartı (tasarim.md §8.1 `musteri/<id>`): başlık + eylemler + özet + sekmeler (Genel, Randevular, Sağlık bilgileri).
// Fotoğraflar, Paketler ve Cari sekmeleri sonraki parçalardır. Sağlık sekmesi izinsiz rolde hiç çizilmez (R9).
const capitalize = (text: string) => (text ? text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1) : text)

export function CustomerCardScreen({ customerId }: { customerId: string }) {
  const me = useMe()
  const slug = me.tenant.slug
  const t = useTerm()
  const query = useApiQuery(`customer-card:${customerId}`, (c, signal) => fetchCustomerCard(c, slug, customerId, signal))
  const base = `/panel/${encodeURIComponent(slug)}`

  if (query.error && !query.data) {
    return query.error.status === 404 ? (
      <Card>
        <EmptyState
          title={`${capitalize(t('client'))} bulunamadı.`}
          description="Kayıt silinmiş, bu bağlantı hatalı ya da kaydı görme yetkiniz yok olabilir."
          action={undefined}
          centered
        />
        <div className="flex justify-center pb-4">
          <Link href={`${base}/musteriler`} className={buttonClassName({ variant: 'secondary' })}>
            {capitalize(t('client', 'plural'))} listesine dön
          </Link>
        </div>
      </Card>
    ) : (
      <Card>
        <ErrorState
          subject={`${capitalize(t('client'))} kartı`}
          onRetry={query.refetch}
          retrying={query.loading}
          lastLoadedAt={query.loadedAt}
          className="px-0"
        />
      </Card>
    )
  }
  if (!query.data) {
    return (
      <SkeletonGroup>
        <Card>
          <div className="grid gap-4">
            <Skeleton className="w-1/3" />
            <Skeleton className="w-2/3" />
            <Skeleton className="w-1/2" />
          </div>
        </Card>
      </SkeletonGroup>
    )
  }
  return <CardBody detail={query.data} base={base} />
}

function CardBody({ detail, base }: { detail: CardDetail; base: string }) {
  const me = useMe()
  const canWrite = useCan('customer.write')
  const tabs = availableTabs(me.permissions)
  const [tab, setTab] = useState<TabValue>('genel')
  const wa = detail.phone ? whatsappHref(detail.phone) : null

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={detail.fullName} size="lg" />
        <h1 className="min-w-0 flex-1 text-xl leading-7 font-semibold [overflow-wrap:anywhere]">{detail.fullName}</h1>
        <div className="flex flex-wrap gap-2">
          {detail.phone ? (
            <a href={`tel:${detail.phone.replace(/\s/g, '')}`} aria-label={`Ara: ${detail.fullName}`} className={buttonClassName({ variant: 'secondary' })}>
              Ara
            </a>
          ) : null}
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`WhatsApp: ${detail.fullName}`}
              className={buttonClassName({ variant: 'secondary' })}
            >
              WhatsApp
            </a>
          ) : null}
          {canWrite ? (
            <Link href={`${base}/musteri/${encodeURIComponent(detail.id)}/duzenle`} className={buttonClassName({ variant: 'secondary' })}>
              Düzenle
            </Link>
          ) : null}
        </div>
      </div>
      <SummaryStrip items={summaryItems(detail)} />
      <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
        <TabList aria-label="Kart bölümleri">
          {tabs.map((item) => (
            <Tab key={item.value} value={item.value}>
              {item.label}
            </Tab>
          ))}
        </TabList>
        <TabPanel value="genel">
          <GeneralTab detail={detail} />
        </TabPanel>
        <TabPanel value="randevular">
          <AppointmentsTab detail={detail} />
        </TabPanel>
        {tabs.some((item) => item.value === 'saglik') ? <TabPanel value="saglik">{tab === 'saglik' ? <HealthTab detail={detail} /> : null}</TabPanel> : null}
      </Tabs>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="m-0 [overflow-wrap:anywhere]">{children}</dd>
    </>
  )
}

function GeneralTab({ detail }: { detail: CardDetail }) {
  const consent = detail.marketingConsentSms || detail.marketingConsentEmail
  return (
    <Card>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
        <Row label="Telefon">{detail.phone ? <span className="tabular-nums">{detail.phone}</span> : 'Telefon yok'}</Row>
        <Row label="E-posta">{detail.email || 'Yok'}</Row>
        <Row label="Doğum tarihi">{detail.birthDate ? formatDate(detail.birthDate, 'long') : 'Yok'}</Row>
        <Row label="Tercih notu">{detail.preferenceNotes || 'Yok'}</Row>
        <Row label="Kampanya mesajı">{consent ? 'İzin verdi' : 'İzin yok'}</Row>
      </dl>
    </Card>
  )
}

function AppointmentsTab({ detail }: { detail: CardDetail }) {
  if (detail.appointments.length === 0) {
    return (
      <Card>
        <EmptyState title="Henüz randevu yok." centered />
      </Card>
    )
  }
  return (
    <Card>
      <ul aria-label="Randevular" className="m-0 grid list-none gap-0 p-0">
        {detail.appointments.map((a) => (
          <li key={a.id} className="flex items-center gap-3 border-b border-border-subtle py-3 last:border-b-0">
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-medium tabular-nums">
                {formatDate(a.startTime, 'short')} · {formatTime(a.startTime)}
              </span>
              <span className="truncate text-sm text-text-muted">
                {a.serviceName} · {a.staffName}
              </span>
            </span>
            <span className={cn('flex-none tabular-nums', a.status === 'cancelled' && 'text-text-muted line-through')}>{formatMoney(a.priceCharged)}</span>
            <StatusBadge status={a.status as AppointmentStatus} />
          </li>
        ))}
      </ul>
      {detail.appointments.length >= 20 ? <p className="pt-3 text-xs text-text-muted">Son 20 randevu gösterilir.</p> : null}
    </Card>
  )
}

function HealthTab({ detail }: { detail: CardDetail }) {
  const slug = useMe().tenant.slug
  const query = useApiQuery(`customer-health:${detail.id}`, (c, signal) => fetchAnamnesis(c, slug, detail.id, signal))
  const answers = new Map((query.data?.answers ?? []).map((a) => [a.questionId, a.value]))
  let body
  if (query.error && !query.data) {
    body = <ErrorState subject="Sağlık bilgileri" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
  } else if (!query.data) {
    body = (
      <SkeletonGroup>
        <div className="grid gap-3">
          <Skeleton className="w-1/2" />
          <Skeleton className="w-2/3" />
        </div>
      </SkeletonGroup>
    )
  } else if (query.data.questions.length === 0) {
    body = <p className="text-base text-text-secondary">Müşteri formu soruları tanımlı değil. Ayarlardan soru ekleyebilirsiniz.</p>
  } else {
    body = (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
        {query.data.questions.map((q) => (
          <Row key={q.id} label={q.label}>
            {formatAnswer(q.type, answers.get(q.id))}
          </Row>
        ))}
      </dl>
    )
  }
  return (
    <Card>
      <div className="grid gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
          <Row label="Alerji notu">{detail.allergyNotes || 'Yok'}</Row>
        </dl>
        {body}
        <p className="text-xs text-text-muted">Cevapları düzenleme yakında.</p>
      </div>
    </Card>
  )
}
