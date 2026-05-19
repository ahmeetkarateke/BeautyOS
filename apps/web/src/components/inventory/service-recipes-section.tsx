'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { ServiceRecipeModal, type Recipe } from './service-recipe-modal'

interface RecipeRow extends Recipe {
  inventory: { id: string; name: string; unit: string; quantity: number; lowStockThreshold: number }
}

interface Props {
  tenantSlug: string
  serviceId: string
  canEdit: boolean
}

export function ServiceRecipesSection({ tenantSlug, serviceId, canEdit }: Props) {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Recipe | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<RecipeRow | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: ['service-recipes', tenantSlug, serviceId],
    queryFn: () => apiFetch<{ data: RecipeRow[] }>(
      `/api/v1/tenants/${tenantSlug}/services/${serviceId}/inventory-recipes`,
    ),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/inventory-recipes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-recipes', tenantSlug, serviceId] })
      toast('Malzeme kaldırıldı')
      setDeleteTarget(undefined)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const recipes = (data?.data ?? []).filter((r) => r.isActive)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Malzemeler</h3>
        {canEdit && (
          <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditTarget(undefined); setModalOpen(true) }}>
            <Plus className="w-4 h-4" /> Malzeme Ekle
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : recipes.length === 0 ? (
        <div className="text-center py-6 bg-white rounded-lg border border-salon-border">
          <p className="text-xs text-salon-muted">Bu hizmete henüz malzeme bağlanmadı.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-salon-border divide-y divide-salon-border">
          {recipes.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{r.inventory.name}</p>
                <p className="text-xs text-salon-muted">
                  Hizmet başına {r.quantityPerUse} {r.inventory.unit} • stok: {r.inventory.quantity}
                  {r.notes && ` • ${r.notes}`}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditTarget(r); setModalOpen(true) }}
                    className="p-2 text-salon-muted hover:text-primary hover:bg-primary-50 rounded-md"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(r)}
                    className="p-2 text-salon-muted hover:text-red-600 hover:bg-red-50 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ServiceRecipeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        tenantSlug={tenantSlug}
        serviceId={serviceId}
        recipe={editTarget}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(undefined) }}
        title="Malzemeyi Kaldır"
        description={`"${deleteTarget?.inventory.name}" malzemesini bu hizmetten kaldırmak istediğinizden emin misiniz?`}
        confirmLabel="Kaldır"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
