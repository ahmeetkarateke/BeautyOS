'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'

interface Slot {
  id: string       // UTC ISO without Z, e.g. "2024-03-15T07:00:00"
  label: string    // TR tz display, e.g. "10:00"
  available: boolean
}

interface SlotSelectProps {
  tenantSlug: string
  serviceId: string
  staffId: string
  date: string           // YYYY-MM-DD
  value: string          // current startAt (ISO UTC with Z)
  onChange: (isoUtc: string) => void
  error?: string
  defaultTime?: string   // "HH:MM" — auto-snap on first load
}

const selectClass = cn(
  'flex h-11 w-full rounded-md border border-salon-border bg-white px-3 py-2 text-sm',
  'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
  'disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer',
)

export function SlotSelect({
  tenantSlug,
  serviceId,
  staffId,
  date,
  value,
  onChange,
  error,
  defaultTime,
}: SlotSelectProps) {
  const ready = !!(serviceId && staffId && date)
  const hasSnapped = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const { data, isLoading } = useQuery({
    queryKey: ['slots', tenantSlug, serviceId, staffId, date],
    queryFn: () =>
      apiFetch<{ slots: Slot[] }>(
        `/api/v1/tenants/${tenantSlug}/public/slots?serviceId=${serviceId}&staffId=${staffId}&date=${date}`,
      ),
    enabled: ready,
    staleTime: 30_000,
  })

  // Reset snap flag when defaultTime changes (new calendar click)
  useEffect(() => {
    hasSnapped.current = false
  }, [defaultTime])

  // Auto-snap to defaultTime on first slot load
  useEffect(() => {
    if (!defaultTime || hasSnapped.current || !data?.slots) return
    const match = data.slots.find((s) => s.label === defaultTime && s.available)
    if (match) {
      onChangeRef.current(match.id + 'Z')
      hasSnapped.current = true
    }
  }, [data, defaultTime])

  if (!ready) {
    return (
      <div className="w-full">
        <select disabled className={selectClass}>
          <option>Önce hizmet, personel ve tarih seçin</option>
        </select>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <select disabled className={selectClass}>
          <option>Müsaitlik yükleniyor...</option>
        </select>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  const slots = data?.slots ?? []

  return (
    <div className="w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(selectClass, error && 'border-red-500 focus:ring-red-500')}
      >
        <option value="">
          {slots.length === 0 ? 'Bu gün için müsait saat yok' : 'Saat seçin...'}
        </option>
        {slots.map((slot) => (
          <option key={slot.id} value={slot.id + 'Z'} disabled={!slot.available}>
            {slot.label}
            {!slot.available ? ' (Dolu)' : ''}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
