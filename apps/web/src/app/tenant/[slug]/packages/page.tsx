'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, PowerOff, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PackageModal, type ServicePackageItem } from '@/components/packages/package-modal'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface PageProps {
  params: { slug: string }
}

export default function PackagesPage({ params }: PageProps) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isStaff = user?.role === 'staff'
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ServicePackageItem | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<ServicePackageItem | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: ['packages', params.slug],
    queryFn: () =>
      apiFetch<{ data: ServicePackageItem[] }>(
        `/api/v1/tenants/${params.slug}/packages?includeInactive=true`,
      ),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${params.slug}/packages/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages', params.slug] })
      toast('Paket pasif yapıldı')
      setDeleteTarget(undefined)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${params.slug}/packages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages', params.slug] })
      toast('Paket aktif edildi')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const packages = data?.data ?? []

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Paketler</h1>
          <p className="text-sm text-salon-muted mt-0.5">{packages.length} paket</p>
        </div>
        {!isStaff && (
          <Button
            size="sm"
            className="gap-2"
            onClick={() => { setEditTarget(undefined); setModalOpen(true) }}
          >
            <Plus className="w-4 h-4" />
            Yeni Paket
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-salon-border">
          <p className="text-salon-muted text-sm">Henüz paket tanımlanmamış</p>
          {!isStaff && (
            <Button
              size="sm"
              className="mt-3 gap-2"
              onClick={() => { setEditTarget(undefined); setModalOpen(true) }}
            >
              <Plus className="w-4 h-4" /> İlk paketini ekle
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-salon-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-salon-bg text-xs uppercase text-salon-muted">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Paket</th>
                  <th className="text-left px-4 py-2.5 font-medium">Hizmet</th>
                  <th className="text-left px-4 py-2.5 font-medium">Seans</th>
                  <th className="text-left px-4 py-2.5 font-medium">Fiyat</th>
                  <th className="text-left px-4 py-2.5 font-medium">Geçerlilik</th>
                  <th className="text-left px-4 py-2.5 font-medium">Aktif</th>
                  {!isStaff && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-salon-border">
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-salon-bg/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-medium', !pkg.isActive && 'text-salon-muted line-through')}>
                          {pkg.name}
                        </span>
                      </div>
                      {pkg.description && (
                        <p className="text-xs text-salon-muted mt-0.5">{pkg.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{pkg.service?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{pkg.totalSessions}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(pkg.price)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {pkg.validityDays ? `${pkg.validityDays} gün` : 'Süresiz'}
                    </td>
                    <td className="px-4 py-3">
                      {pkg.isActive ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Aktif</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Pasif</span>
                      )}
                    </td>
                    {!isStaff && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => { setEditTarget(pkg); setModalOpen(true) }}
                            className="p-2 text-salon-muted hover:text-primary hover:bg-primary-50 rounded-md transition-colors"
                            title="Düzenle"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {pkg.isActive ? (
                            <button
                              onClick={() => setDeleteTarget(pkg)}
                              className="p-2 text-salon-muted hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Pasif yap"
                            >
                              <PowerOff className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => activateMutation.mutate(pkg.id)}
                              disabled={activateMutation.isPending}
                              className="p-2 text-salon-muted hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                              title="Aktif et"
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PackageModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        tenantSlug={params.slug}
        pkg={editTarget}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(undefined) }}
        title="Paketi Pasif Yap"
        description={`"${deleteTarget?.name}" paketini pasif yaparsanız yeni satışlarda görünmez. Mevcut müşteri paketleri etkilenmez.`}
        confirmLabel="Pasif Yap"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
