'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, PowerOff, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ServiceModal } from '@/components/services/service-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface Service {
  id: string
  name: string
  category?: string
  durationMinutes: number
  price: number
  isActive: boolean
}

interface PageProps {
  params: { slug: string }
}

export default function ServicesPage({ params }: PageProps) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isStaff = user?.role === 'staff'
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Service | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Service | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: ['services', params.slug],
    queryFn: () => apiFetch<{ data: Service[] }>(`/api/v1/tenants/${params.slug}/services?includeInactive=true`),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${params.slug}/services/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services', params.slug] })
      toast('Hizmet pasif yapıldı')
      setDeleteTarget(undefined)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${params.slug}/services/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services', params.slug] })
      toast('Hizmet aktif edildi')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const services = data?.data ?? []
  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const cat = s.category ?? 'Diğer'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Hizmetler</h1>
          <p className="text-sm text-salon-muted mt-0.5">{services.length} hizmet</p>
        </div>
        {!isStaff && (
          <Button size="sm" className="gap-2" onClick={() => { setEditTarget(undefined); setModalOpen(true) }}>
            <Plus className="w-4 h-4" />
            Yeni Hizmet
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-salon-border">
          <p className="text-salon-muted text-sm">Henüz hizmet eklenmemiş</p>
          {!isStaff && (
            <Button size="sm" className="mt-3 gap-2" onClick={() => { setEditTarget(undefined); setModalOpen(true) }}>
              <Plus className="w-4 h-4" /> İlk hizmetini ekle
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-xs font-semibold text-salon-muted uppercase tracking-wide mb-2">{category}</h2>
              <div className="bg-white rounded-lg border border-salon-border divide-y divide-salon-border">
                {items.map((svc) => (
                  <div key={svc.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn('text-sm font-medium', !svc.isActive && 'text-salon-muted line-through')}>
                          {svc.name}
                        </p>
                        {!svc.isActive && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Pasif</span>
                        )}
                      </div>
                      <p className="text-xs text-salon-muted mt-0.5">{svc.durationMinutes} dk</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                      {formatCurrency(svc.price)}
                    </p>
                    {!isStaff && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setEditTarget(svc); setModalOpen(true) }}
                          className="p-2 text-salon-muted hover:text-primary hover:bg-primary-50 rounded-md transition-colors"
                          title="Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {svc.isActive ? (
                          <button
                            onClick={() => setDeleteTarget(svc)}
                            className="p-2 text-salon-muted hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Pasif yap"
                          >
                            <PowerOff className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => activateMutation.mutate(svc.id)}
                            disabled={activateMutation.isPending}
                            className="p-2 text-salon-muted hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                            title="Aktif et"
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ServiceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        tenantSlug={params.slug}
        service={editTarget}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(undefined) }}
        title="Hizmeti Pasif Yap"
        description={`"${deleteTarget?.name}" hizmetini pasif yaparsanız yeni randevularda görünmez. Mevcut randevular etkilenmez.`}
        confirmLabel="Pasif Yap"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
