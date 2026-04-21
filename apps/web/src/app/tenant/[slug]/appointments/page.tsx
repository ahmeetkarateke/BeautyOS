'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppointmentCalendar } from '@/components/appointments/appointment-calendar'

interface PageProps {
  params: { slug: string }
}

export default function AppointmentsPage({ params }: PageProps) {
  const [newAppointmentSlot, setNewAppointmentSlot] = useState<{ start: Date; end: Date } | null>(null)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Randevular</h1>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Yeni Randevu
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-salon-border p-3 sm:p-4 overflow-x-auto">
        <AppointmentCalendar
          tenantId={params.slug}
          onSelectSlot={(start, end) => setNewAppointmentSlot({ start, end })}
        />
      </div>
    </div>
  )
}
