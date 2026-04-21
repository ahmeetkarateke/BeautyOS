'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Mail, Calendar, Star, TrendingUp, Pencil } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { EditCustomerModal } from '@/components/customers/edit-customer-modal'
import { apiFetch } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface PageProps {
  params: { slug: string; customerId: string }
}

interface AppointmentRow {
  id: string
  serviceName: string
  staffName: string
  startTime: string
  status: string
  priceCharged: number
}

interface CustomerDetail {
  id: string
  fullName: string
  phone: string
  email?: string
  birthDate?: string
  totalVisits: number
  lifetimeValue: number
  segment: 'vip' | 'regular' | 'sleeping' | 'at_risk'
  lastVisitAt?: string
  createdAt: string
  appointments: AppointmentRow[]
}

const statusLabel: Record<string, { label: string; className: string }> = {
  pending:     { label: 'Bekliyor',    className: 'bg-yellow-100 text-yellow-700' },
  confirmed:   { label: 'Onaylı',      className: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Devam Ediyor',className: 'bg-purple-100 text-purple-700' },
  completed:   { label: 'Tamamlandı',  className: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'İptal',       className: 'bg-red-100 text-red-600' },
  no_show:     { label: 'Gelmedi',     className: 'bg-gray-100 text-gray-600' },
}

const segmentLabel: Record<string, { label: string; className: string }> = {
  vip:      { label: 'VIP',       className: 'bg-amber-100 text-amber-700' },
  regular:  { label: 'Düzenli',   className: 'bg-blue-100 text-blue-700' },
  sleeping: { label: 'Pasif',     className: 'bg-gray-100 text-gray-600' },
  at_risk:  { label: 'Risk Altında', className: 'bg-red-100 text-red-600' },
}

export default function CustomerDetailPage({ params }: PageProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['customer', params.slug, params.customerId],
    queryFn: () =>
      apiFetch<CustomerDetail>(`/api/v1/tenants/${params.slug}/customers/${params.customerId}`),
  })

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-md hover:bg-salon-bg transition-colors text-salon-muted hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {isLoading ? (
          <Skeleton className="h-7 w-40" />
        ) : (
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-primary">
                {data?.fullName.charAt(0)}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{data?.fullName}</h1>
              {data?.segment && (
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', segmentLabel[data.segment]?.className)}>
                  {segmentLabel[data.segment]?.label}
                </span>
              )}
            </div>
          </div>
        )}
        {!isLoading && data && (
          <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => setEditOpen(true)}>
            <Pencil className="w-3.5 h-3.5" /> Düzenle
          </Button>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-salon-muted">Toplam Ziyaret</p>
                {isLoading ? <Skeleton className="h-6 w-8 mt-1" /> : (
                  <p className="text-xl font-bold text-gray-900">{data?.totalVisits ?? 0}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-salon-muted">Toplam Harcama</p>
                {isLoading ? <Skeleton className="h-6 w-20 mt-1" /> : (
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(data?.lifetimeValue ?? 0)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <Star className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-salon-muted">Son Ziyaret</p>
                {isLoading ? <Skeleton className="h-6 w-24 mt-1" /> : (
                  <p className="text-sm font-semibold text-gray-900">
                    {data?.lastVisitAt ? formatDate(data.lastVisitAt) : '—'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact info */}
      <Card>
        <CardHeader>
          <CardTitle>İletişim Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-40" />
            </>
          ) : (
            <>
              <a
                href={`tel:${data?.phone}`}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4 text-salon-muted" />
                {data?.phone}
              </a>
              {data?.email && (
                <a
                  href={`mailto:${data.email}`}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-primary transition-colors"
                >
                  <Mail className="w-4 h-4 text-salon-muted" />
                  {data.email}
                </a>
              )}
              {data?.birthDate && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Calendar className="w-4 h-4 text-salon-muted" />
                  {formatDate(data.birthDate)}
                </div>
              )}
              <p className="text-xs text-salon-muted">
                Kayıt tarihi: {data?.createdAt ? formatDate(data.createdAt) : '—'}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Appointment history */}
      <Card>
        <CardHeader>
          <CardTitle>Randevu Geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !data?.appointments.length ? (
            <div className="text-center py-10">
              <p className="text-sm text-salon-muted">Henüz randevu yok</p>
            </div>
          ) : (
            <ul className="divide-y divide-salon-border">
              {data.appointments.map((apt) => {
                const st = statusLabel[apt.status] ?? { label: apt.status, className: 'bg-gray-100 text-gray-600' }
                return (
                  <li key={apt.id} className="flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-salon-bg transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{apt.serviceName}</p>
                      <p className="text-xs text-salon-muted mt-0.5">
                        {apt.staffName} · {formatDate(apt.startTime)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', st.className)}>
                        {st.label}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(apt.priceCharged)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {data && (
        <EditCustomerModal
          open={editOpen}
          onOpenChange={setEditOpen}
          tenantSlug={params.slug}
          customer={data}
        />
      )}
    </div>
  )
}
