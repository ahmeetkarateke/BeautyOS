'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronUp, Package as PackageIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SellPackageModal } from '@/components/packages/sell-package-modal'
import { apiFetch } from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'
import { useAuthStore } from '@/store/auth'

type PackageStatus = 'active' | 'completed' | 'expired' | 'refunded'

interface CustomerPackage {
  id: string
  packageId: string
  totalSessions: number
  remainingSessions: number
  pricePaid: number
  status: PackageStatus
  purchaseDate: string
  expiresAt: string | null
  completedAt: string | null
  notes: string | null
  package?: {
    id: string
    name: string
    service?: { id: string; name: string } | null
  } | null
}

interface PackageUsage {
  id: string
  customerPackageId: string
  appointmentId: string | null
  usedAt: string
  notes: string | null
}

interface Props {
  tenantSlug: string
  customerId: string
  customerName?: string
}

const statusLabel: Record<PackageStatus, { label: string; className: string }> = {
  active:    { label: 'Aktif',      className: 'bg-green-100 text-green-700' },
  completed: { label: 'Tamamlandı', className: 'bg-blue-100 text-blue-700' },
  expired:   { label: 'Süresi Doldu', className: 'bg-gray-100 text-gray-600' },
  refunded:  { label: 'İade',       className: 'bg-red-100 text-red-600' },
}

export function CustomerPackagesSection({ tenantSlug, customerId, customerName }: Props) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isStaff = user?.role === 'staff'
  const [sellOpen, setSellOpen] = useState(false)
  const [confirmUse, setConfirmUse] = useState<CustomerPackage | undefined>()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['customer-packages', tenantSlug, customerId],
    queryFn: () =>
      apiFetch<{ data: CustomerPackage[] }>(
        `/api/v1/tenants/${tenantSlug}/customer-packages?customerId=${customerId}`,
      ),
  })

  const useMutation_ = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/customer-packages/${id}/use`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-packages', tenantSlug, customerId] })
      qc.invalidateQueries({ queryKey: ['customer', tenantSlug, customerId] })
      toast('1 seans düşüldü')
      setConfirmUse(undefined)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const packages = data?.data ?? []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Paketler</CardTitle>
        {!isStaff && (
          <Button size="sm" className="gap-1.5" onClick={() => setSellOpen(true)}>
            <Plus className="w-4 h-4" /> Paket Sat
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : packages.length === 0 ? (
          <div className="text-center py-8">
            <PackageIcon className="w-8 h-8 text-salon-muted mx-auto mb-2" />
            <p className="text-sm text-salon-muted">
              Aktif paket bulunmuyor — yeni bir paket oluşturmak için Hizmetler sayfasına gidin.
            </p>
          </div>
        ) : (
          packages.map((cp) => {
            const used = cp.totalSessions - cp.remainingSessions
            const pct = cp.totalSessions > 0 ? Math.round((used / cp.totalSessions) * 100) : 0
            const isActive = cp.status === 'active'
            const expanded = expandedId === cp.id
            const st = statusLabel[cp.status]
            return (
              <div key={cp.id} className="border border-salon-border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {cp.package?.name ?? 'Paket'}
                    </p>
                    <p className="text-xs text-salon-muted truncate">
                      {cp.package?.service?.name ?? '—'} · {formatCurrency(cp.pricePaid)} · {formatDate(cp.purchaseDate)}
                    </p>
                  </div>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0', st.className)}>
                    {st.label}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-salon-muted">
                      {used} / {cp.totalSessions} kullanıldı
                    </span>
                    <span className="font-medium text-gray-700">{cp.remainingSessions} kalan</span>
                  </div>
                  <div className="h-2 w-full bg-salon-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {cp.expiresAt && (
                  <p className="text-xs text-salon-muted">
                    Son kullanım: {formatDate(cp.expiresAt)}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {isActive && cp.remainingSessions > 0 && (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setConfirmUse(cp)}
                    >
                      Kullan (1 seans düş)
                    </Button>
                  )}
                  <button
                    onClick={() => setExpandedId(expanded ? null : cp.id)}
                    className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Detay {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {expanded && <PackageUsages tenantSlug={tenantSlug} customerPackageId={cp.id} />}
              </div>
            )
          })
        )}
      </CardContent>

      <SellPackageModal
        open={sellOpen}
        onOpenChange={setSellOpen}
        tenantSlug={tenantSlug}
        customerId={customerId}
        customerName={customerName}
      />

      <ConfirmDialog
        open={!!confirmUse}
        onOpenChange={(o) => { if (!o) setConfirmUse(undefined) }}
        title="Seans Kullan"
        description={`Bu pakete 1 seans düşülecek. Kalan: ${confirmUse?.remainingSessions ?? 0} → ${(confirmUse?.remainingSessions ?? 1) - 1}`}
        confirmLabel="Onayla"
        variant="default"
        onConfirm={() => confirmUse && useMutation_.mutate(confirmUse.id)}
        loading={useMutation_.isPending}
      />
    </Card>
  )
}

function PackageUsages({ tenantSlug, customerPackageId }: { tenantSlug: string; customerPackageId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['package-usages', tenantSlug, customerPackageId],
    queryFn: () =>
      apiFetch<{ data: PackageUsage[] }>(
        `/api/v1/tenants/${tenantSlug}/customer-packages/${customerPackageId}/usages`,
      ),
  })

  if (isLoading) return <Skeleton className="h-10 w-full" />
  const usages = data?.data ?? []
  if (usages.length === 0) {
    return <p className="text-xs text-salon-muted pt-2 border-t border-salon-border">Henüz kullanım kaydı yok.</p>
  }
  return (
    <div className="pt-2 border-t border-salon-border space-y-1">
      <p className="text-xs font-medium text-salon-muted mb-1">Kullanım Geçmişi</p>
      <ul className="text-xs text-gray-700 space-y-0.5">
        {usages.map((u) => (
          <li key={u.id} className="flex items-center justify-between">
            <span>{formatDate(u.usedAt)}</span>
            {u.notes && <span className="text-salon-muted truncate ml-2">{u.notes}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
