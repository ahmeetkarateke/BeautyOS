'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Plus, Zap, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NewAppointmentModal } from '@/components/appointments/new-appointment-modal'
import { AppointmentStatusModal } from '@/components/appointments/appointment-status-modal'
import { AppointmentDetailSheet } from '@/components/appointments/appointment-detail-sheet'
import { QuickTransactionModal } from '@/components/appointments/quick-transaction-modal'
import { apiFetch } from '@/lib/api'
import { useDebounce } from '@/hooks/use-debounce'
import type { AppointmentEventProps } from '@/components/appointments/appointment-calendar'

const AppointmentCalendar = dynamic(
  () => import('@/components/appointments/appointment-calendar').then((m) => m.AppointmentCalendar),
  { ssr: false, loading: () => <Skeleton className="h-[600px] w-full" /> },
)

interface PageProps {
  params: { slug: string }
}

interface StaffItem {
  id: string
  fullName: string
}

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Bekliyor' },
  { value: 'confirmed',   label: 'Onaylı' },
  { value: 'in_progress', label: 'Devam Ediyor' },
  { value: 'completed',   label: 'Tamamlandı' },
  { value: 'cancelled',   label: 'İptal Edildi' },
  { value: 'no_show',     label: 'Gelmedi' },
]

const SELECT_CLASS =
  'h-9 rounded-md border border-salon-border bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'

export default function AppointmentsPage({ params }: PageProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const staffId = searchParams.get('staffId') ?? ''
  const status = searchParams.get('status') ?? ''
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '')
  const debouncedSearch = useDebounce(searchInput, 400)

  const [modalOpen, setModalOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | undefined>()
  const [detailModal, setDetailModal] = useState<AppointmentEventProps | null>(null)
  const [statusModal, setStatusModal] = useState<{
    appointmentId: string
    title: string
    status: string
    priceCharged: number
  } | null>(null)

  const { data: staffData } = useQuery({
    queryKey: ['staff', params.slug],
    queryFn: () => apiFetch<{ data: StaffItem[] }>(`/api/v1/tenants/${params.slug}/staff`),
  })

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`${pathname}?${params.toString()}`)
  }

  function clearFilters() {
    setSearchInput('')
    router.replace(pathname)
  }

  const hasFilters = !!(staffId || status || debouncedSearch)

  const handleSelectSlot = (start: Date, end: Date) => {
    setSelectedSlot({ start, end })
    setModalOpen(true)
  }

  const handleSelectAppointment = (props: AppointmentEventProps) => {
    setDetailModal(props)
  }

  const handleOpenStatusModal = () => {
    if (!detailModal) return
    setDetailModal(null)
    setStatusModal({
      appointmentId: detailModal.appointmentId,
      title: detailModal.title,
      status: detailModal.status,
      priceCharged: detailModal.priceCharged,
    })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Randevular</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setQuickOpen(true)}>
            <Zap className="w-4 h-4" />
            Hızlı İşlem
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Yeni Randevu
          </Button>
        </div>
      </div>

      {/* Filtre satırı */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
        <select
          value={staffId}
          onChange={(e) => setFilter('staffId', e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Tüm Personel</option>
          {(staffData?.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.fullName}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setFilter('status', e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Tüm Durumlar</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div className="relative col-span-2 sm:col-span-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-salon-muted" />
          <input
            type="text"
            placeholder="Müşteri ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full pl-8 pr-3 rounded-md border border-salon-border bg-white text-sm placeholder:text-salon-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:w-44"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-salon-muted hover:text-gray-700 transition-colors col-span-2 sm:col-span-1"
          >
            <X className="w-3.5 h-3.5" />
            Filtreleri Temizle
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-salon-border p-3 sm:p-4 overflow-x-auto">
        <AppointmentCalendar
          tenantId={params.slug}
          onSelectSlot={handleSelectSlot}
          onSelectAppointment={handleSelectAppointment}
          filterStaffId={staffId}
          filterStatus={status}
          filterSearch={debouncedSearch.length >= 2 ? debouncedSearch : undefined}
        />
      </div>

      <NewAppointmentModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setSelectedSlot(undefined)
        }}
        tenantSlug={params.slug}
        defaultStart={selectedSlot?.start}
        defaultEnd={selectedSlot?.end}
      />

      <QuickTransactionModal
        open={quickOpen}
        onOpenChange={setQuickOpen}
        tenantSlug={params.slug}
      />

      <AppointmentDetailSheet
        open={!!detailModal}
        onOpenChange={(open) => { if (!open) setDetailModal(null) }}
        detail={detailModal}
        tenantSlug={params.slug}
        onChangeStatus={handleOpenStatusModal}
      />

      {statusModal && (
        <AppointmentStatusModal
          open={!!statusModal}
          onOpenChange={(open) => { if (!open) setStatusModal(null) }}
          tenantSlug={params.slug}
          appointmentId={statusModal.appointmentId}
          currentStatus={statusModal.status}
          appointmentTitle={statusModal.title}
          defaultPrice={statusModal.priceCharged}
        />
      )}
    </div>
  )
}
