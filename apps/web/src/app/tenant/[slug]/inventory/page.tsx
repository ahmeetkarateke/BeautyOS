'use client'

import { useState, use } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, History, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiFetch } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useAuthStore } from '@/store/auth'
import { InventoryItemModal, type InventoryItem } from '@/components/inventory/inventory-item-modal'
import { SupplierModal, type Supplier } from '@/components/inventory/supplier-modal'
import { StockMovementsPanel } from '@/components/inventory/stock-movements-panel'

interface PageProps {
  params: Promise<{ slug: string }>
}

type TabKey = 'items' | 'suppliers' | 'low-stock'

export default function InventoryPage(props: PageProps) {
  const params = use(props.params)
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === 'owner' || user?.role === 'manager'

  const [tab, setTab] = useState<TabKey>('items')
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | undefined>()
  const [deleteItem, setDeleteItem] = useState<InventoryItem | undefined>()
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | undefined>()
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | undefined>()
  const [movementsItem, setMovementsItem] = useState<InventoryItem | undefined>()

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['inventory', params.slug],
    queryFn: () => apiFetch<{ data: InventoryItem[] }>(`/api/v1/tenants/${params.slug}/inventory`),
  })

  const { data: lowStockData, isLoading: lowLoading } = useQuery({
    queryKey: ['inventory-low-stock', params.slug],
    queryFn: () => apiFetch<{ data: InventoryItem[] }>(`/api/v1/tenants/${params.slug}/inventory/low-stock`),
    enabled: tab === 'low-stock' || tab === 'items',
  })

  const { data: suppliersData, isLoading: supplierLoading } = useQuery({
    queryKey: ['suppliers', params.slug],
    queryFn: () => apiFetch<{ data: Supplier[] }>(`/api/v1/tenants/${params.slug}/suppliers?includeInactive=true`),
    enabled: tab === 'suppliers',
  })

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${params.slug}/inventory/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', params.slug] })
      qc.invalidateQueries({ queryKey: ['inventory-low-stock', params.slug] })
      toast('Ürün silindi')
      setDeleteItem(undefined)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const deleteSupplierMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${params.slug}/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers', params.slug] })
      toast('Tedarikçi pasif yapıldı')
      setDeleteSupplier(undefined)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const items = itemsData?.data ?? []
  const lowStockItems = lowStockData?.data ?? []
  const suppliers = suppliersData?.data ?? []
  const lowCount = lowStockItems.length

  if (movementsItem) {
    return (
      <div className="p-4 sm:p-6">
        <StockMovementsPanel
          tenantSlug={params.slug}
          itemId={movementsItem.id}
          itemName={movementsItem.name}
          canEdit={canEdit}
          onBack={() => setMovementsItem(undefined)}
        />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Stok</h1>
          <p className="text-sm text-salon-muted mt-0.5">
            {items.length} ürün
            {lowCount > 0 && ` • ${lowCount} düşük stok uyarısı`}
          </p>
        </div>
        {canEdit && tab === 'items' && (
          <Button size="sm" className="gap-2" onClick={() => { setEditItem(undefined); setItemModalOpen(true) }}>
            <Plus className="w-4 h-4" /> Yeni Ürün
          </Button>
        )}
        {canEdit && tab === 'suppliers' && (
          <Button size="sm" className="gap-2" onClick={() => { setEditSupplier(undefined); setSupplierModalOpen(true) }}>
            <Plus className="w-4 h-4" /> Yeni Tedarikçi
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b border-salon-border">
        <TabButton active={tab === 'items'} onClick={() => setTab('items')}>Ürünler</TabButton>
        <TabButton active={tab === 'low-stock'} onClick={() => setTab('low-stock')}>
          Düşük Stok{lowCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-red-100 text-red-700">
              {lowCount}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === 'suppliers'} onClick={() => setTab('suppliers')}>Tedarikçiler</TabButton>
      </div>

      {tab === 'items' && (
        <ItemsTable
          isLoading={itemsLoading}
          items={items}
          canEdit={canEdit}
          lowStockIds={new Set(lowStockItems.map((it) => it.id))}
          onMovements={(it) => setMovementsItem(it)}
          onEdit={(it) => { setEditItem(it); setItemModalOpen(true) }}
          onDelete={(it) => setDeleteItem(it)}
          onCreate={() => { setEditItem(undefined); setItemModalOpen(true) }}
        />
      )}

      {tab === 'low-stock' && (
        <ItemsTable
          isLoading={lowLoading}
          items={lowStockItems}
          canEdit={canEdit}
          lowStockIds={new Set(lowStockItems.map((it) => it.id))}
          onMovements={(it) => setMovementsItem(it)}
          onEdit={(it) => { setEditItem(it); setItemModalOpen(true) }}
          onDelete={(it) => setDeleteItem(it)}
          onCreate={() => { setEditItem(undefined); setItemModalOpen(true) }}
          emptyText="Düşük stok uyarısı yok."
        />
      )}

      {tab === 'suppliers' && (
        <div>
          {supplierLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-salon-border">
              <p className="text-salon-muted text-sm">Henüz tedarikçi yok.</p>
              {canEdit && (
                <Button
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={() => { setEditSupplier(undefined); setSupplierModalOpen(true) }}
                >
                  <Plus className="w-4 h-4" /> İlk tedarikçiyi ekle
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-salon-border divide-y divide-salon-border">
              {suppliers.map((s) => (
                <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm font-medium', !s.isActive && 'text-salon-muted line-through')}>
                        {s.name}
                      </p>
                      {!s.isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Pasif</span>
                      )}
                    </div>
                    <p className="text-xs text-salon-muted mt-0.5">
                      {s.phone ?? '—'}{s.email && ` • ${s.email}`}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditSupplier(s); setSupplierModalOpen(true) }}
                        className="p-2 text-salon-muted hover:text-primary hover:bg-primary-50 rounded-md"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {s.isActive && (
                        <button
                          onClick={() => setDeleteSupplier(s)}
                          className="p-2 text-salon-muted hover:text-red-600 hover:bg-red-50 rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <InventoryItemModal
        open={itemModalOpen}
        onOpenChange={setItemModalOpen}
        tenantSlug={params.slug}
        item={editItem}
      />
      <SupplierModal
        open={supplierModalOpen}
        onOpenChange={setSupplierModalOpen}
        tenantSlug={params.slug}
        supplier={editSupplier}
      />
      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => { if (!o) setDeleteItem(undefined) }}
        title="Ürünü Sil"
        description={`"${deleteItem?.name}" ürününü silmek istediğinizden emin misiniz?`}
        confirmLabel="Sil"
        onConfirm={() => deleteItem && deleteItemMutation.mutate(deleteItem.id)}
        loading={deleteItemMutation.isPending}
      />
      <ConfirmDialog
        open={!!deleteSupplier}
        onOpenChange={(o) => { if (!o) setDeleteSupplier(undefined) }}
        title="Tedarikçiyi Pasif Yap"
        description={`"${deleteSupplier?.name}" tedarikçisini pasif yapmak istediğinizden emin misiniz?`}
        confirmLabel="Pasif Yap"
        onConfirm={() => deleteSupplier && deleteSupplierMutation.mutate(deleteSupplier.id)}
        loading={deleteSupplierMutation.isPending}
      />
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-salon-muted hover:text-gray-900',
      )}
    >
      {children}
    </button>
  )
}

interface ItemsTableProps {
  isLoading: boolean
  items: InventoryItem[]
  canEdit: boolean
  lowStockIds: Set<string>
  onMovements: (it: InventoryItem) => void
  onEdit: (it: InventoryItem) => void
  onDelete: (it: InventoryItem) => void
  onCreate: () => void
  emptyText?: string
}

function ItemsTable({
  isLoading, items, canEdit, lowStockIds, onMovements, onEdit, onDelete, onCreate, emptyText,
}: ItemsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg border border-salon-border">
        <p className="text-salon-muted text-sm">{emptyText ?? 'Henüz ürün yok. İlk ürünü ekleyin.'}</p>
        {canEdit && !emptyText && (
          <Button size="sm" className="mt-3 gap-2" onClick={onCreate}>
            <Plus className="w-4 h-4" /> İlk ürünü ekle
          </Button>
        )}
      </div>
    )
  }
  return (
    <div className="bg-white rounded-lg border border-salon-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-salon-muted bg-salon-bg">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">Ad</th>
            <th className="text-left px-4 py-2.5 font-medium">SKU</th>
            <th className="text-right px-4 py-2.5 font-medium">Mevcut</th>
            <th className="text-left px-4 py-2.5 font-medium">Birim</th>
            <th className="text-right px-4 py-2.5 font-medium">Birim Maliyet</th>
            <th className="text-right px-4 py-2.5 font-medium">Aksiyon</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-salon-border">
          {items.map((it) => {
            const low = lowStockIds.has(it.id)
            return (
              <tr key={it.id} className={cn(low && 'bg-red-50/40')}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{it.name}</span>
                    {low && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        <AlertTriangle className="w-3 h-3" />
                        Düşük
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-salon-muted">{it.sku ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{it.currentStock}</td>
                <td className="px-4 py-3 text-salon-muted">{it.unit}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(it.unitCost)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onMovements(it)}
                      className="p-2 text-salon-muted hover:text-primary hover:bg-primary-50 rounded-md"
                      title="Hareketler"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => onEdit(it)}
                          className="p-2 text-salon-muted hover:text-primary hover:bg-primary-50 rounded-md"
                          title="Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(it)}
                          className="p-2 text-salon-muted hover:text-red-600 hover:bg-red-50 rounded-md"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
