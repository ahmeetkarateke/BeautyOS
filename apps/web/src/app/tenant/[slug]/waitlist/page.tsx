'use client'

import { useMemo, useState, use } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, BellRing, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { AddWaitlistModal } from '@/components/waitlist/add-waitlist-modal'
import { NotifyWaitlistModal } from '@/components/waitlist/notify-modal'

type WaitlistStatus = 'waiting' | 'notified' | 'booked' | 'expired' | 'cancelled'

interface WaitlistRow {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  serviceId: string | null
  serviceName: string | null
  staffId: string | null
  staffName: string | null
  preferredDate: string | null
  preferredTimeRange: string | null
  status: WaitlistStatus
  notes: string | null
  notifiedAt: string | null
  bookedAppointmentId: string | null
  createdAt: string
  updatedAt: string
}

interface WaitlistResponse {
  data: WaitlistRow[]
}

interface ServiceLite {
  id: string
  name: string
}
interface ServicesResponse {
  data: ServiceLite[]
}

interface StaffLite {
  id: string
  fullName: string
}
interface StaffResponse {
  data: StaffLite[]
}

const statusFilters: Array<{ value: '' | WaitlistStatus; label: string }> = [
  { value: '', label: 'Tümü' },
  { value: 'waiting', label: 'Bekliyor' },
  { value: 'notified', label: 'Bildirildi' },
  { value: 'booked', label: 'Rezerve' },
  { value: 'cancelled', label: 'İptal' },
  { value: 'expired', label: 'Süresi Doldu' },
]

const statusBadge: Record<WaitlistStatus, { label: string; className: string }> = {
  waiting:   { label: 'Bekliyor',     className: 'bg-blue-100 text-blue-700' },
  notified:  { label: 'Bildirildi',   className: 'bg-amber-100 text-amber-700' },
  booked:    { label: 'Rezerve',      className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'İptal',        className: 'bg-red-100 text-red-600' },
  expired:   { label: 'Süresi Doldu', className: 'bg-gray-100 text-gray-600' },
}

interface PageProps {
  params: Promise<{ slug: string }>
}

function daysAgoLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days <= 0) {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    if (hours <= 0) return 'az önce bildirildi'
    return `${hours} saat önce bildirildi`
  }
  return `${days} gün önce bildirildi`
}

export default function WaitlistPage(props: PageProps) {
  const params = use(props.params)
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'' | WaitlistStatus>('')
  const [serviceFilter, setServiceFilter] = useState<string>('')
  const [staffFilter, setStaffFilter] = useState<string>('')
  const [addOpen, setAddOpen] = useState(false)
  const [notifyTarget, setNotifyTarget] = useState<WaitlistRow | null>(null)

  const listQuery = useQuery({
    queryKey: ['waitlist', params.slug, statusFilter, serviceFilter, staffFilter],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (statusFilter) qs.set('status', statusFilter)
      if (serviceFilter) qs.set('serviceId', serviceFilter)
      if (staffFilter) qs.set('staffId', staffFilter)
      const q = qs.toString() ? `?${qs.toString()}` : ''
      return apiFetch<WaitlistResponse>(`/api/v1/tenants/${params.slug}/waitlist${q}`)
    },
  })

  const servicesQuery = useQuery({
    queryKey: ['waitlist-services-filter', params.slug],
    queryFn: () => apiFetch<ServicesResponse>(`/api/v1/tenants/${params.slug}/services`),
  })

  const staffQuery = useQuery({
    queryKey: ['waitlist-staff-filter', params.slug],
    queryFn: () => apiFetch<StaffResponse>(`/api/v1/tenants/${params.slug}/staff`),
  })

  const services: ServiceLite[] = useMemo(() => servicesQuery.data?.data ?? [], [servicesQuery.data])
  const staffList: StaffLite[] = useMemo(
    () => (staffQuery.data?.data ?? []).map((s) => ({ id: s.id, fullName: s.fullName })),
    [staffQuery.data],
  )

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${params.slug}/waitlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waitlist', params.slug] })
      toast('Kayıt iptal edildi')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const bookMutation = useMutation({
    mutationFn: ({ id, appointmentId }: { id: string; appointmentId: string }) =>
      apiFetch(`/api/v1/tenants/${params.slug}/waitlist/${id}/book`, {
        method: 'POST',
        body: JSON.stringify({ appointmentId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waitlist', params.slug] })
      toast('Rezerve edildi olarak işaretlendi')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const onMarkBooked = (row: WaitlistRow) => {
    const appointmentId = window.prompt(
      'Oluşturulan randevunun ID değerini girin (Randevular ekranında randevuyu oluşturup ID kopyalayın).',
    )
    if (!appointmentId) return
    const trimmed = appointmentId.trim()
    if (!/^[0-9a-f-]{36}$/i.test(trimmed)) {
      toast('Geçersiz randevu ID', 'error')
      return
    }
    bookMutation.mutate({ id: row.id, appointmentId: trimmed })
  }

  const onDelete = (row: WaitlistRow) => {
    if (!window.confirm(`${row.customerName} bekleme listesinden çıkarılsın mı?`)) return
    deleteMutation.mutate(row.id)
  }

  const rows = listQuery.data?.data ?? []

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Bekleme Listesi</h1>
        <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" />
          Bekleme Listesine Ekle
        </Button>
      </div>

      {/* Status chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {statusFilters.map((s) => {
          const active = statusFilter === s.value
          return (
            <button
              key={s.value || 'all'}
              onClick={() => setStatusFilter(s.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-salon-muted border-salon-border hover:text-gray-900',
              )}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Service + Staff filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        <Select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
          <option value="">Tüm hizmetler</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
          <option value="">Tüm personel</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-salon-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-salon-border bg-salon-bg">
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase tracking-wide">Müşteri</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase tracking-wide">Hizmet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase tracking-wide">Personel</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase tracking-wide">Tercih Edilen</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase tracking-wide">Eklenme</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase tracking-wide">Durum</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-salon-muted uppercase tracking-wide">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-salon-border last:border-0">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Clock className="w-8 h-8 text-salon-muted" />
                      <p className="text-sm text-salon-muted">Bekleme listesinde kimse yok.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const badge = statusBadge[row.status]
                  const preferred = [
                    row.preferredDate ? formatDate(row.preferredDate) : null,
                    row.preferredTimeRange,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'
                  return (
                    <tr key={row.id} className="border-b border-salon-border last:border-0 hover:bg-salon-bg transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{row.customerName}</div>
                        <div className="text-xs text-salon-muted">{row.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.serviceName ?? 'Fark etmez'}</td>
                      <td className="px-4 py-3 text-gray-700">{row.staffName ?? 'Fark etmez'}</td>
                      <td className="px-4 py-3 text-gray-700">{preferred}</td>
                      <td className="px-4 py-3 text-salon-muted">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', badge.className)}>
                          {badge.label}
                        </span>
                        {row.status === 'notified' && row.notifiedAt && (
                          <div className="text-[11px] text-salon-muted mt-1">{daysAgoLabel(row.notifiedAt)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {(row.status === 'waiting' || row.status === 'notified') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-8 text-xs"
                              onClick={() => setNotifyTarget(row)}
                            >
                              <BellRing className="w-3.5 h-3.5" />
                              Bildir
                            </Button>
                          )}
                          {(row.status === 'waiting' || row.status === 'notified') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-8 text-xs"
                              onClick={() => onMarkBooked(row)}
                              disabled={bookMutation.isPending}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Rezerve Edildi
                            </Button>
                          )}
                          {row.status !== 'cancelled' && row.status !== 'expired' && row.status !== 'booked' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-8 text-xs text-red-600 hover:bg-red-50"
                              onClick={() => onDelete(row)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Sil
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddWaitlistModal open={addOpen} onOpenChange={setAddOpen} tenantSlug={params.slug} />
      {notifyTarget && (
        <NotifyWaitlistModal
          open={!!notifyTarget}
          onOpenChange={(o) => {
            if (!o) setNotifyTarget(null)
          }}
          tenantSlug={params.slug}
          entry={notifyTarget}
        />
      )}
    </div>
  )
}
