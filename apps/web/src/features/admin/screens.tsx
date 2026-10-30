'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { validateLogin } from '@/features/auth/logic'
import { AuthShell } from '@/features/auth/auth-shell'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card, CardHeader } from '@/ui/card'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { DataTable } from '@/ui/data-table'
import type { Column } from '@/ui/data-table'
import { focusFirstInvalid, InputField, PasswordField, SelectField } from '@/ui/field'
import { formatDate, formatMoney } from '@/ui/format'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState } from '@/ui/states'
import { SummaryStrip } from '@/ui/summary-strip'
import { useToast } from '@/ui/toast'
import { adminLogin, fetchLegalVersions, fetchStats, fetchTenant, fetchTenants, patchTenant } from './api'
import type { TenantPatch } from './api'
import { extendedTrialEnd, filterTenants, PLAN_LABELS, STATUS_LABELS, tenantStatus, TRIAL_EXTENSIONS } from './logic'
import type { Plan, TenantFilter, TenantRow, TenantStatus } from './logic'

const errorMessage = (error: unknown) => (error instanceof ApiError ? error : new ApiError({ status: 0, code: 'NETWORK' })).text()
const PLANS = Object.keys(PLAN_LABELS) as Plan[]
const STATUSES = Object.keys(STATUS_LABELS) as TenantStatus[]

function Loading() {
  return (
    <SkeletonGroup className="grid gap-3">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </SkeletonGroup>
  )
}

export function OverviewScreen() {
  const stats = useApiQuery('admin:stats', (c, signal) => fetchStats(c, signal))
  return (
    <>
      <h1 className="text-xl leading-7 font-semibold">Genel bakış</h1>
      {stats.error ? (
        <ErrorState subject="Genel bakış" onRetry={stats.refetch} retrying={stats.loading} lastLoadedAt={stats.loadedAt} />
      ) : !stats.data ? (
        <Loading />
      ) : (
        <SummaryStrip
          items={[
            { label: 'Toplam salon', value: stats.data.totalTenants },
            { label: 'Aktif', value: stats.data.activeTenants },
            { label: 'Deneme', value: stats.data.trialTenants },
            { label: 'Süresi dolan', value: stats.data.expiredTenants },
            { label: 'Son 30 günde kayıt', value: stats.data.recentRegistrations },
          ]}
        />
      )}
    </>
  )
}

const EMPTY_FILTER: TenantFilter = { search: '', plan: '', status: '' }

export function TenantsScreen() {
  const list = useApiQuery('admin:tenants', (c, signal) => fetchTenants(c, signal))
  const [filter, setFilter] = useState<TenantFilter>(EMPTY_FILTER)
  const [now] = useState(() => new Date())

  const columns: Column<TenantRow>[] = [
    {
      key: 'name',
      header: 'Salon',
      primary: true,
      cell: (row) => (
        <Link href={`/admin/salonlar/${encodeURIComponent(row.id)}`} className="font-medium">
          {row.name}
        </Link>
      ),
    },
    { key: 'owner', header: 'Sahip', cell: (row) => (row.ownerEmail ? <span className="break-all">{row.ownerEmail}</span> : '—') },
    { key: 'plan', header: 'Plan', cell: (row) => PLAN_LABELS[row.plan] },
    { key: 'status', header: 'Durum', cell: (row) => STATUS_LABELS[tenantStatus(row, now)] },
    { key: 'trial', header: 'Deneme bitişi', cell: (row) => (row.plan === 'trial' && row.trialEndsAt ? formatDate(row.trialEndsAt) : '—') },
    { key: 'counts', header: 'Kullanıcı / müşteri', align: 'right', cell: (row) => `${row.userCount} / ${row.customerCount}` },
  ]

  const rows = list.data ? filterTenants(list.data, filter, now) : []
  return (
    <>
      <h1 className="text-xl leading-7 font-semibold">Salonlar</h1>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <InputField label="Salon ara" type="search" spellCheck={false} value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
        <SelectField label="Plan" value={filter.plan} onChange={(e) => setFilter({ ...filter, plan: e.target.value as TenantFilter['plan'] })}>
          <option value="">Tümü</option>
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {PLAN_LABELS[p]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Durum" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as TenantFilter['status'] })}>
          <option value="">Tümü</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
      </div>
      {list.error ? (
        <ErrorState subject="Salon listesi" onRetry={list.refetch} retrying={list.loading} lastLoadedAt={list.loadedAt} />
      ) : !list.data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          title={list.data.length === 0 ? 'Henüz salon yok.' : 'Eşleşen salon yok.'}
          description={list.data.length === 0 ? undefined : 'Aramayı ya da süzgeçleri değiştirin.'}
          action={list.data.length === 0 ? undefined : { label: 'Süzgeçleri temizle', onClick: () => setFilter(EMPTY_FILTER) }}
        />
      ) : (
        <DataTable aria-label="Salonlar" columns={columns} rows={rows} rowKey={(row) => row.id} />
      )}
    </>
  )
}

export function TenantDetailScreen({ id }: { id: string }) {
  const client = useApiClient()
  const toast = useToast()
  const query = useApiQuery(`admin:tenant:${id}`, (c, signal) => fetchTenant(c, id, signal))
  const [planDraft, setPlanDraft] = useState<Plan | null>(null)
  const [extension, setExtension] = useState<number>(TRIAL_EXTENSIONS[0])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [now] = useState(() => new Date())

  if (query.error?.status === 404) return <EmptyState title="Salon bulunamadı." description="Adres yanlış ya da salon silinmiş olabilir." />
  if (query.error) return <ErrorState subject="Salon ayrıntısı" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} />
  if (!query.data) return <Loading />

  const { tenant, activity } = query.data
  const plan = planDraft ?? tenant.plan
  const status = tenantStatus(tenant, now)

  async function save(patch: TenantPatch, done: string) {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await patchTenant(client, id, patch)
      toast.show({ message: done })
      setPlanDraft(null)
      setConfirmOpen(false)
      query.refetch()
    } catch (error) {
      setFailure(errorMessage(error))
      setConfirmOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div>
        <Link href="/admin/salonlar" className="inline-flex min-h-11 items-center text-sm">
          Salonlara dön
        </Link>
        <h1 className="text-xl leading-7 font-semibold">{tenant.name}</h1>
        <p className="text-sm text-text-muted">
          {tenant.slug} · {STATUS_LABELS[status]} · Kayıt: {formatDate(tenant.createdAt)}
        </p>
      </div>
      {failure ? <Banner tone="error">{failure}</Banner> : null}
      <Card>
        <CardHeader title="Plan" headingLevel={2} />
        <div className="grid max-w-sm gap-3">
          <SelectField label="Plan" value={plan} onChange={(e) => setPlanDraft(e.target.value as Plan)}>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {PLAN_LABELS[p]}
              </option>
            ))}
          </SelectField>
          <div>
            <Button variant="secondary" disabled={plan === tenant.plan} loading={busy} loadingText="Kaydediliyor…" onClick={() => void save({ plan }, 'Plan kaydedildi.')}>
              Planı kaydet
            </Button>
          </div>
        </div>
      </Card>
      {tenant.plan === 'trial' ? (
        <Card>
          <CardHeader title="Deneme süresi" headingLevel={2} />
          <p className="mb-3 text-sm text-text-secondary">Bitiş: {tenant.trialEndsAt ? formatDate(tenant.trialEndsAt) : 'belirsiz'}</p>
          <div className="grid max-w-sm gap-3">
            <SelectField label="Uzatma süresi" value={String(extension)} onChange={(e) => setExtension(Number(e.target.value))}>
              {TRIAL_EXTENSIONS.map((d) => (
                <option key={d} value={d}>
                  {d} gün
                </option>
              ))}
            </SelectField>
            <div>
              <Button variant="secondary" loading={busy} loadingText="Kaydediliyor…" onClick={() => void save({ trialEndsAt: extendedTrialEnd(tenant.trialEndsAt, extension, now) }, 'Deneme süresi uzatıldı.')}>
                Denemeyi uzat
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Son 30 gün" headingLevel={2} />
        <dl className="m-0 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-text-muted">Randevu (son 30 gün)</dt>
            <dd className="m-0 tabular-nums">{activity.totalAppointments}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">Müşteri sayısı</dt>
            <dd className="m-0 tabular-nums">{activity.totalCustomers}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">Ciro (son 30 gün)</dt>
            <dd className="m-0 tabular-nums">{formatMoney(activity.totalRevenue)}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">Son hareket</dt>
            <dd className="m-0">{activity.lastActivityAt ? formatDate(activity.lastActivityAt) : 'Henüz yok'}</dd>
          </div>
        </dl>
      </Card>
      <Banner tone="info">Kabul edilen yasal sürümler ve salon notu yakında. Müşteri bilgileri bu panelde hiç görünmez.</Banner>
      <Card>
        <CardHeader title="Durum" headingLevel={2} />
        <p className="mb-3 text-sm text-text-secondary">
          {tenant.isActive ? 'Salon etkin. Pasife alınırsa salon çalışanları giriş yapamaz.' : 'Salon pasif. Etkinleştirilirse çalışanlar yeniden giriş yapabilir.'}
        </p>
        {tenant.isActive ? (
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Salonu pasife al
          </Button>
        ) : (
          <Button variant="secondary" loading={busy} loadingText="Kaydediliyor…" onClick={() => void save({ isActive: true }, 'Salon etkinleştirildi.')}>
            Salonu etkinleştir
          </Button>
        )}
      </Card>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${tenant.name} pasife alınsın mı?`}
        description="Salon çalışanları giriş yapamaz ve online randevu kapanır. Veriler silinmez; salonu istediğiniz zaman yeniden etkinleştirebilirsiniz."
        actionLabel="Salonu pasife al"
        loading={busy}
        loadingText="Kaydediliyor…"
        onConfirm={() => void save({ isActive: false }, 'Salon pasife alındı.')}
      />
    </>
  )
}

const LEGAL_LABELS: Record<string, string> = {
  termsVersion: 'Kullanım şartları',
  dpaVersion: 'Veri işleme sözleşmesi',
  labelVersion: 'Etiket metni',
  marketingTextVersion: 'Ticari ileti metni',
}

export function LegalScreen() {
  const query = useApiQuery('admin:legal', (c, signal) => fetchLegalVersions(c, signal))
  return (
    <>
      <h1 className="text-xl leading-7 font-semibold">Yasal belgeler</h1>
      <Banner tone="info">Yeni sürüm yayınlama yakında. Şimdilik sürümler yazılım sürümüyle birlikte değişir.</Banner>
      {query.error ? (
        <ErrorState subject="Yasal belge sürümleri" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} />
      ) : !query.data ? (
        <Loading />
      ) : (
        <Card labelledBy="admin-legal">
          <h2 id="admin-legal" className="mb-3 mt-0 text-base font-semibold">
            Yürürlükteki sürümler
          </h2>
          <dl className="m-0 grid gap-3 sm:grid-cols-2">
            {Object.entries(query.data).map(([key, value]) => (
              <div key={key}>
                <dt className="text-sm text-text-muted">{LEGAL_LABELS[key] ?? key}</dt>
                <dd className="m-0 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </>
  )
}

type Navigate = (path: string) => void
const defaultNavigate: Navigate = (path) => window.location.assign(path)

export function AdminLoginScreen({ navigate = defaultNavigate }: { navigate?: Navigate }) {
  const client: ApiClient = useApiClient()
  const formRef = useRef<HTMLFormElement>(null)
  const inFlight = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    const found = validateLogin({ email, password })
    setErrors(found)
    setFailure(null)
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => formRef.current && focusFirstInvalid(formRef.current))
      return
    }
    inFlight.current = true
    setPending(true)
    try {
      await adminLogin(client, { email, password })
      navigate('/admin')
    } catch (error) {
      setFailure(error instanceof ApiError ? error.text({ context: 'login' }) : 'Beklenmeyen bir sorun oluştu. Birkaç dakika sonra tekrar deneyin.')
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <AuthShell title="Yönetim girişi" lead="Bu sayfa yalnız BeautyOS yönetimi içindir." footerLinks={false}>
      {failure ? (
        <Banner tone="error" className="mb-5">
          {failure}
        </Banner>
      ) : null}
      <form ref={formRef} noValidate onSubmit={submit} className="grid gap-4">
        <InputField label="E-posta" type="email" autoComplete="email" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <PasswordField label="Şifre" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Button type="submit" fullWidth loading={pending} loadingText="Giriş yapılıyor…">
          Giriş yap
        </Button>
      </form>
    </AuthShell>
  )
}
