'use client'

import { useState } from 'react'
import { istanbulDateStr } from '@/features/appointments/day-logic'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { InputField } from '@/ui/field'
import { formatDate, formatMoney } from '@/ui/format'
import { SegmentedControl } from '@/ui/segmented-control'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { StatusBadge } from '@/ui/status-badge'
import { SummaryStrip } from '@/ui/summary-strip'
import { Tab, TabList, TabPanel, Tabs } from '@/ui/tabs'
import { fetchCashReport, fetchCommissions } from './api'
import { periodRange, sortCommissions, validateRange, type Preset } from './logic'

// Raporlar (tasarim.md §8.1 `raporlar`): Kasa raporu (günlük döküm) ve Prim raporu; yazdır; olmayan raporlar "Yakında". Yalnız sahip ve müdür.
const PRESETS = [
  { value: 'today', label: 'Bugün' },
  { value: 'week', label: 'Son 7 gün' },
  { value: 'month', label: 'Bu ay' },
] as const

export function ReportsScreen() {
  const me = useMe()
  if (me.role !== 'owner' && me.role !== 'manager') return <Forbidden />
  return <ReportsBody />
}

function ReportsBody() {
  const [tab, setTab] = useState('kasa')
  return (
    <div className="grid max-w-4xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <h1 className="text-xl leading-7 font-semibold">Raporlar</h1>
        <Button variant="secondary" onClick={() => window.print()}>
          Yazdır
        </Button>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabList aria-label="Raporlar">
          <Tab value="kasa">Kasa raporu</Tab>
          <Tab value="prim">Prim raporu</Tab>
          <Tab value="diger">Diğer raporlar</Tab>
        </TabList>
        <TabPanel value="kasa">
          <CashReportTab />
        </TabPanel>
        <TabPanel value="prim">{tab === 'prim' ? <CommissionTab /> : null}</TabPanel>
        <TabPanel value="diger">
          <Card>
            <p className="flex items-center gap-2 text-base text-text-secondary">
              Grafikli ve karşılaştırmalı raporlar <StatusBadge status="soon" />
            </p>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  )
}

function CashReportTab() {
  const slug = useMe().tenant.slug
  const [today] = useState(() => istanbulDateStr(new Date()))
  const [preset, setPreset] = useState<Preset | 'custom'>('week')
  const [range, setRange] = useState(() => periodRange('week', today))
  const [draft, setDraft] = useState(range)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const query = useApiQuery(`report:cash:${range.from}:${range.to}`, (c, signal) => fetchCashReport(c, slug, range.from, range.to, signal))

  function pick(value: string) {
    if (value === 'custom') {
      setPreset('custom')
      return
    }
    const next = periodRange(value as Preset, today)
    setPreset(value as Preset)
    setRange(next)
    setDraft(next)
    setRangeError(null)
  }

  function apply() {
    const issue = validateRange(draft.from, draft.to, today)
    setRangeError(issue)
    if (!issue) setRange(draft)
  }

  let body
  if (query.error && !query.data) {
    body = <ErrorState subject="Kasa raporu" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
  } else if (!query.data) {
    body = (
      <SkeletonGroup>
        <div className="grid gap-3">
          <Skeleton className="w-1/2" />
          <Skeleton className="w-2/3" />
        </div>
      </SkeletonGroup>
    )
  } else if (query.data.daily.length === 0) {
    body = <EmptyState title="Bu dönemde tahsilat yok." description="Randevuyu tamamlayıp ödeme aldığınızda burada görünür." centered />
  } else {
    const report = query.data
    body = (
      <div className="grid gap-4">
        <SummaryStrip
          items={[
            { label: 'Tahsilat', value: formatMoney(report.totalRevenue) },
            { label: 'Nakit', value: formatMoney(report.cashRevenue) },
            { label: 'Kart', value: formatMoney(report.cardRevenue) },
            { label: 'Net (gider düşülmüş)', value: formatMoney(report.netRevenue) },
          ]}
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Günlük döküm</caption>
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Gün
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  İşlem
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Tahsilat
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Nakit
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Kart
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Gider
                </th>
                <th scope="col" className="py-2 pl-3 text-right font-medium">
                  Net
                </th>
              </tr>
            </thead>
            <tbody>
              {report.daily.map((day) => (
                <tr key={day.date} className="border-b border-border-subtle tabular-nums">
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {formatDate(`${day.date}T12:00:00+03:00`, 'short')}
                  </th>
                  <td className="px-3 py-2 text-right">{day.completedCount}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(day.revenue)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(day.cashRevenue)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(day.cardRevenue)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(day.expenses)}</td>
                  <td className="py-2 pl-3 text-right font-medium">{formatMoney(day.netRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <div className="grid gap-4">
        <div className="grid gap-3 print:hidden">
          <SegmentedControl aria-label="Dönem" options={[...PRESETS, { value: 'custom', label: 'Tarih seç' }]} value={preset} onValueChange={pick} />
          {preset === 'custom' ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <InputField
                label="Başlangıç"
                type="date"
                max={today}
                value={draft.from}
                onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value }))}
              />
              <InputField label="Bitiş" type="date" max={today} value={draft.to} onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))} />
              <Button onClick={apply}>Raporu göster</Button>
            </div>
          ) : null}
          {rangeError ? <Banner tone="error">{rangeError}</Banner> : null}
        </div>
        <p className="text-sm text-text-muted">
          {formatDate(`${range.from}T12:00:00+03:00`, 'long')}
          {range.from !== range.to ? ` – ${formatDate(`${range.to}T12:00:00+03:00`, 'long')}` : ''}
        </p>
        {body}
        <p className="text-xs text-text-muted">BeautyOS yazarkasa yerine geçmez ve e-Fatura kesmez.</p>
      </div>
    </Card>
  )
}

function CommissionTab() {
  const slug = useMe().tenant.slug
  const [today] = useState(() => istanbulDateStr(new Date()))
  const [date, setDate] = useState(today)
  const query = useApiQuery(`report:commissions:${date}`, (c, signal) => fetchCommissions(c, slug, date, signal))
  const rows = sortCommissions(query.data ?? [])

  let body
  if (query.error && !query.data) {
    body = <ErrorState subject="Prim raporu" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
  } else if (!query.data) {
    body = <Skeleton className="w-2/3" />
  } else if (rows.length === 0) {
    body = <EmptyState title="Bu gün için prim yok." description="Tamamlanan hizmet olmayınca prim oluşmaz." centered />
  } else {
    body = (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Personel primleri</caption>
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                Personel
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Hizmet
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Ciro
              </th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">
                Prim
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.staffId} className="border-b border-border-subtle tabular-nums">
                <th scope="row" className="py-2 pr-3 font-medium">
                  {row.staffName}
                </th>
                <td className="px-3 py-2 text-right">{row.completedAppointments}</td>
                <td className="px-3 py-2 text-right">{formatMoney(row.revenue)}</td>
                <td className="py-2 pl-3 text-right font-medium">{formatMoney(row.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <Card>
      <div className="grid gap-4">
        <div className="print:hidden">
          <InputField label="Gün" type="date" max={today} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} />
        </div>
        {body}
      </div>
    </Card>
  )
}
