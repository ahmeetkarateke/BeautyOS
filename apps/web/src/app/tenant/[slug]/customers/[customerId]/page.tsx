'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Mail, Calendar, Star, TrendingUp, Pencil, Plus, Trash2, AlertTriangle, Heart, Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EditCustomerModal } from '@/components/customers/edit-customer-modal'
import { PhotoUploadModal } from '@/components/customers/photo-upload-modal'
import { PhotoLightbox, type LightboxPhoto } from '@/components/customers/photo-lightbox'
import { CustomerPackagesSection } from '@/components/packages/customer-packages-section'
import { AnamnesisForm } from '@/components/customers/anamnesis-form'
import { apiFetch } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useActiveModules } from '@/hooks/use-active-modules'

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
  allergyNotes?: string | null
  preferenceNotes?: string | null
  totalVisits: number
  lifetimeValue: number
  segment: 'vip' | 'regular' | 'sleeping' | 'at_risk'
  lastVisitAt?: string
  createdAt: string
  appointments: AppointmentRow[]
}

interface PhotoItem {
  id: string
  url: string
  caption: string | null
  category: string | null
  takenAt: string
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

const PHOTO_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'all',          label: 'Tümü' },
  { value: 'hair_before',  label: 'Saç Öncesi' },
  { value: 'hair_after',   label: 'Saç Sonrası' },
  { value: 'nail',         label: 'Tırnak' },
  { value: 'skin',         label: 'Cilt' },
  { value: 'general',      label: 'Diğer' },
]

type TabKey = 'general' | 'anamnesis' | 'photos' | 'visits'

export default function CustomerDetailPage({ params }: PageProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const { activeModules } = useActiveModules(params.slug)
  const anamnesisEnabled = activeModules.includes('customer-anamnesis')
  const photosEnabled = activeModules.includes('customer-photos')

  const [activeTab, setActiveTab] = useState<TabKey>('general')
  const [editOpen, setEditOpen] = useState(false)

  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [photoCategoryFilter, setPhotoCategoryFilter] = useState<string>('all')
  const [lightboxPhoto, setLightboxPhoto] = useState<LightboxPhoto | null>(null)
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null)

  const tabs = useMemo(() => {
    const list: Array<{ key: TabKey; label: string }> = [{ key: 'general', label: 'Genel' }]
    if (anamnesisEnabled) list.push({ key: 'anamnesis', label: 'Müşteri Hakkında' })
    if (photosEnabled) list.push({ key: 'photos', label: 'Fotoğraflar' })
    list.push({ key: 'visits', label: 'Ziyaret Geçmişi' })
    return list
  }, [anamnesisEnabled, photosEnabled])

  // Modül kapatılırsa aktif tab geçersiz olabilir → geneli göster
  const effectiveTab: TabKey = tabs.some((t) => t.key === activeTab) ? activeTab : 'general'

  const { data, isLoading } = useQuery({
    queryKey: ['customer', params.slug, params.customerId],
    queryFn: () =>
      apiFetch<CustomerDetail>(`/api/v1/tenants/${params.slug}/customers/${params.customerId}`),
  })

  const { data: waitlistData } = useQuery({
    queryKey: ['customer-waitlist', params.slug, params.customerId],
    queryFn: () =>
      apiFetch<{ data: Array<{ id: string; customerId: string; status: string }> }>(
        `/api/v1/tenants/${params.slug}/waitlist?status=waiting`,
      ),
  })
  const waitlistCount = (waitlistData?.data ?? []).filter((w) => w.customerId === params.customerId).length

  const { data: photos, isLoading: photosLoading } = useQuery({
    queryKey: ['customer-photos', params.slug, params.customerId],
    queryFn: () =>
      apiFetch<PhotoItem[]>(`/api/v1/tenants/${params.slug}/customers/${params.customerId}/photos`),
    enabled: effectiveTab === 'photos' && photosEnabled,
  })

  const deletePhotoMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${params.slug}/photos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-photos', params.slug, params.customerId] })
      toast('Fotoğraf silindi')
      setPhotoToDelete(null)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const filteredPhotos = (photos ?? []).filter((p) =>
    photoCategoryFilter === 'all' ? true : (p.category ?? 'general') === photoCategoryFilter,
  )

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
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
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {data?.segment && (
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', segmentLabel[data.segment]?.className)}>
                    {segmentLabel[data.segment]?.label}
                  </span>
                )}
                {data && waitlistCount > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Bekleme listesinde
                  </span>
                )}
              </div>
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

      {/* Tabs */}
      <div className="border-b border-salon-border">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                effectiveTab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-salon-muted hover:text-gray-900',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {effectiveTab === 'general' && (
        <div className="space-y-6">
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

          {/* Allergy & Preference */}
          {!isLoading && data && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Alerji Notları
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.allergyNotes ? (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{data.allergyNotes}</p>
                  ) : (
                    <p className="text-sm text-salon-muted">Kayıt yok.</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Heart className="w-4 h-4 text-pink-500" />
                    Tercih Notları
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.preferenceNotes ? (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{data.preferenceNotes}</p>
                  ) : (
                    <p className="text-sm text-salon-muted">Kayıt yok.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <CustomerPackagesSection
            tenantSlug={params.slug}
            customerId={params.customerId}
            customerName={data?.fullName}
          />
        </div>
      )}

      {effectiveTab === 'anamnesis' && (
        <AnamnesisForm tenantSlug={params.slug} customerId={params.customerId} />
      )}

      {effectiveTab === 'photos' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Fotoğraflar</CardTitle>
            <Button size="sm" className="gap-1.5" onClick={() => setPhotoModalOpen(true)}>
              <Plus className="w-4 h-4" /> Fotoğraf Ekle
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {PHOTO_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setPhotoCategoryFilter(c.value)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full border transition-colors',
                    photoCategoryFilter === c.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-salon-muted border-salon-border hover:text-gray-900',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {photosLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-square w-full" />)}
              </div>
            ) : !filteredPhotos.length ? (
              <div className="text-center py-10">
                <p className="text-sm text-salon-muted">Henüz fotoğraf yok.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredPhotos.map((p) => (
                  <div key={p.id} className="group relative aspect-square rounded-lg overflow-hidden border border-salon-border bg-salon-bg">
                    <button
                      onClick={() => setLightboxPhoto(p)}
                      className="absolute inset-0 w-full h-full"
                      aria-label="Fotoğrafı büyüt"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.caption ?? 'Müşteri fotoğrafı'}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    </button>
                    <button
                      onClick={() => setPhotoToDelete(p.id)}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                      aria-label="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {(p.caption || p.takenAt) && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 pointer-events-none">
                        {p.caption && <p className="text-xs text-white font-medium truncate">{p.caption}</p>}
                        <p className="text-[10px] text-white/70">{formatDate(p.takenAt)}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {effectiveTab === 'visits' && (
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
      )}

      {data && (
        <EditCustomerModal
          open={editOpen}
          onOpenChange={setEditOpen}
          tenantSlug={params.slug}
          customer={data}
        />
      )}

      <PhotoUploadModal
        open={photoModalOpen}
        onOpenChange={setPhotoModalOpen}
        tenantSlug={params.slug}
        customerId={params.customerId}
      />

      <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />

      <ConfirmDialog
        open={!!photoToDelete}
        onOpenChange={(o) => { if (!o) setPhotoToDelete(null) }}
        title="Fotoğrafı sil"
        description="Bu fotoğraf kalıcı olarak silinecek. Devam etmek istiyor musunuz?"
        confirmLabel="Sil"
        loading={deletePhotoMutation.isPending}
        onConfirm={() => { if (photoToDelete) deletePhotoMutation.mutate(photoToDelete) }}
      />
    </div>
  )
}
