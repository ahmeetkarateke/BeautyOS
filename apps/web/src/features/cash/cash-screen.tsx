'use client'

import { useState } from 'react'
import { fetchDailyReport } from '@/features/appointments/api'
import { istanbulDateStr } from '@/features/appointments/day-logic'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { InputField } from '@/ui/field'
import { formatDate, formatMoney, formatTime } from '@/ui/format'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { ErrorState, Forbidden } from '@/ui/states'
import { SummaryStrip } from '@/ui/summary-strip'
import { fetchCorrections, fetchDayStatus } from './api'
import { CloseDaySheet } from './close-day-sheet'
import { differenceView } from './logic'
import { ReopenDaySheet } from './reopen-day-sheet'

// Kasa (tasarim.md §8.1 `kasa`): günün özeti, gün sonu (sayım + fark), günü yeniden aç ve düzeltme kayıtları.
// Gün durumunu sunucu söyler (day-status). Resepsiyon yalnız bugünü görür; geçmiş gün sahip/müdürdür (finance.report.range).
const has = (permissions: readonly string[], key: string) => permissions.includes(key)

export function CashScreen() {
  const me = useMe()
  if (!has(me.permissions, 'finance.report.daily')) return <Forbidden />
  return <CashBody />
}

function CashBody() {
  const me = useMe()
  const slug = me.tenant.slug
  const canPickDate = has(me.permissions, 'finance.report.range')
  const canClose = has(me.permissions, 'finance.close_day')
  const canCorrect = has(me.permissions, 'finance.correction')
  const [today] = useState(() => istanbulDateStr(new Date()))
  const [date, setDate] = useState(today)
  const [closing, setClosing] = useState(false)
  const [reopening, setReopening] = useState(false)

  const report = useApiQuery(`cash:report:${date}`, (c, signal) => fetchDailyReport(c, slug, date, date, signal))
  const status = useApiQuery(`cash:status:${date}`, (c, signal) => fetchDayStatus(c, slug, date, signal))
  const corrections = useApiQuery(canCorrect ? `cash:corrections:${date}` : null, (c, signal) => fetchCorrections(c, slug, date, signal))

  const refresh = () => {
    report.refetch()
    status.refetch()
    corrections.refetch()
  }

  let summary
  if (report.error && !report.data) {
    summary = <ErrorState subject="Kasa özeti" onRetry={report.refetch} retrying={report.loading} lastLoadedAt={report.loadedAt} className="px-0" />
  } else if (!report.data) {
    summary = (
      <SkeletonGroup>
        <div className="grid gap-3">
          <Skeleton className="w-1/2" />
          <Skeleton className="w-2/3" />
        </div>
      </SkeletonGroup>
    )
  } else {
    summary = (
      <SummaryStrip
        items={[
          { label: 'Tahsilat', value: formatMoney(report.data.totalRevenue) },
          { label: 'Nakit', value: formatMoney(report.data.cashRevenue) },
          { label: 'Kart', value: formatMoney(report.data.cardRevenue) },
          { label: 'Tamamlanan', value: String(report.data.completedCount) },
        ]}
      />
    )
  }

  const day = status.data
  let dayBlock
  if (status.error && !day) {
    dayBlock = <ErrorState subject="Gün durumu" onRetry={status.refetch} retrying={status.loading} lastLoadedAt={status.loadedAt} className="px-0" />
  } else if (!day) {
    dayBlock = <Skeleton className="w-1/2" />
  } else if (day.isClosed) {
    const diff = day.countedCash != null ? differenceView(day.expectedCash, day.countedCash) : null
    dayBlock = (
      <div className="grid gap-3">
        <Banner tone="info">Gün kapatıldı{day.closedAt ? ` · ${formatTime(day.closedAt)}` : ''}. Yeni ödeme yazılamaz.</Banner>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
          <dt className="text-text-muted">Beklenen nakit</dt>
          <dd className="m-0 tabular-nums">{formatMoney(day.expectedCash)}</dd>
          <dt className="text-text-muted">Sayılan nakit</dt>
          <dd className="m-0 tabular-nums">{day.countedCash != null ? formatMoney(day.countedCash) : 'Sayım yapılmadı'}</dd>
          {diff ? (
            <>
              <dt className="text-text-muted">Fark</dt>
              <dd className="m-0" data-tone={diff.tone}>
                {diff.text}
              </dd>
            </>
          ) : null}
        </dl>
        {canCorrect ? (
          <div>
            <Button variant="secondary" onClick={() => setReopening(true)}>
              Günü yeniden aç
            </Button>
          </div>
        ) : null}
      </div>
    )
  } else {
    dayBlock = (
      <div className="grid gap-3">
        <p className="text-base text-text-secondary">
          Gün açık. Beklenen nakit: <strong className="tabular-nums">{formatMoney(day.expectedCash)}</strong>
        </p>
        {canClose ? (
          <div>
            <Button onClick={() => setClosing(true)}>Günü kapat</Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-0.5">
          <h1 className="text-xl leading-7 font-semibold">Kasa</h1>
          <p className="text-sm text-text-muted">{formatDate(`${date}T12:00:00+03:00`, 'long')}</p>
        </div>
        {canPickDate ? (
          <InputField label="Tarih" type="date" max={today} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} />
        ) : null}
      </div>
      <Card>{summary}</Card>
      <Card>
        <div className="grid gap-3">
          <h2 className="text-base leading-6 font-semibold">Gün sonu</h2>
          {dayBlock}
        </div>
      </Card>
      {canCorrect ? (
        <Card>
          <div className="grid gap-3">
            <h2 className="text-base leading-6 font-semibold">Düzeltme kayıtları</h2>
            {corrections.error && !corrections.data ? (
              <ErrorState subject="Düzeltme kayıtları" onRetry={corrections.refetch} retrying={corrections.loading} className="px-0" />
            ) : !corrections.data ? (
              <Skeleton className="w-1/2" />
            ) : corrections.data.length === 0 ? (
              <p className="text-base text-text-secondary">Bu gün için düzeltme kaydı yok.</p>
            ) : (
              <ul aria-label="Düzeltme kayıtları" className="m-0 grid list-none gap-0 p-0">
                {corrections.data.map((c) => (
                  <li key={c.id} className="grid gap-0.5 border-b border-border-subtle py-2.5 last:border-b-0">
                    <span className="font-medium">{c.kind === 'day_reopen' ? 'Gün yeniden açıldı' : 'Ödeme düzeltildi'}</span>
                    <span className="text-sm text-text-muted">
                      {formatTime(c.createdAt)} · {c.reason}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ) : null}
      <p className="text-xs text-text-muted">BeautyOS yazarkasa yerine geçmez ve e-Fatura kesmez.</p>
      {closing && day ? (
        <CloseDaySheet
          date={date}
          expectedCash={day.expectedCash}
          onClose={() => setClosing(false)}
          onDone={() => {
            setClosing(false)
            refresh()
          }}
        />
      ) : null}
      {reopening ? (
        <ReopenDaySheet
          date={date}
          onClose={() => setReopening(false)}
          onDone={() => {
            setReopening(false)
            refresh()
          }}
        />
      ) : null}
    </div>
  )
}
