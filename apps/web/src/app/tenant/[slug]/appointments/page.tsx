'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NewAppointmentModal } from '@/components/appointments/new-appointment-modal'
import { AppointmentStatusModal } from '@/components/appointments/appointment-status-modal'

const AppointmentCalendar = dynamic(
  () => import('@/components/appointments/appointment-calendar').then((m) => m.AppointmentCalendar),
  { ssr: false, loading: () => <Skeleton className="h-[600px] w-full" /> },
)

interface PageProps {
  params: { slug: string }
}

export default function AppointmentsPage({ params }: PageProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | undefined>()
  const [statusModal, setStatusModal] = useState<{
    appointmentId: string
    title: string
    status: string
    priceCharged: number
  } | null>(null)

  const handleSelectSlot = (start: Date, end: Date) => {
    setSelectedSlot({ start, end })
    setModalOpen(true)
  }

  const handleSelectAppointment = (appointmentId: string, title: string, status: string, priceCharged: number) => {
    setStatusModal({ appointmentId, title, status, priceCharged })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Randevular</h1>
        <Button size="sm" className="gap-2" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Yeni Randevu
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-salon-border p-3 sm:p-4 overflow-x-auto">
        <AppointmentCalendar
          tenantId={params.slug}
          onSelectSlot={handleSelectSlot}
          onSelectAppointment={handleSelectAppointment}
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
