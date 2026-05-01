'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Calendar, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toaster'
import { adminApiFetch } from '@/lib/admin-api'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface TenantDetail {
  id: string
  name: string
  slug: string
  plan: string
  trialEndsAt?: string
  isActive: boolean
  createdAt: string
  customerCount: number
  appointmentCount: number
  settings?: {
    phone?: string
    address?: string
    businessType?: string
  }
}

const planLabel: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
}

const planColor: Record<string, string> = {
  trial: 'bg-blue-100 text-blue-700',
  starter: 'bg-green-100 text-green-700',
  pro: 'bg-purple-100 text-purple-700',
}

interface Props {
  params: { tenantId: string }
}

export default function AdminTenantDetailPage({ params }: Props) {
  const router = useRouter()
  const qc = useQueryClient()

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['admin-tenant', params.tenantId],
    queryFn: () => adminApiFetch<TenantDetail>(`/api/v1/admin/tenants/${params.tenantId}`),
  })

  const [trialDate, setTrialDate] = useState('')
  const [plan, setPlan] = useState('')
  const [toggleOpen, setToggleOpen] = useState(false)

  // Pre-fill form when data loads (only once)
  const [initialized, setInitialized] = useState(false)
  if (tenant && !initialized) {
    setTrialDate(tenant.trialEndsAt ? tenant.trialEndsAt.slice(0, 10) : '')
    setPlan(tenant.plan)
    setInitialized(true)
  }

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      adminApiFetch(`/api/v1/admin/tenants/${params.tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tenant', params.tenantId] })
      qc.invalidateQueries({ queryKey: ['admin-tenants'] })
      qc.invalidateQueries({ queryKey: ['admin-stats'] })
      toast('Kaydedildi')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const toggleMutation = useMutation({
    mutationFn: () =>
      adminApiFetch(`/api/v1/admin/tenants/${params.tenantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !tenant?.isActive }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tenant', params.tenantId] })
      qc.invalidateQueries({ queryKey: ['admin-tenants'] })
      qc.invalidateQueries({ queryKey: ['admin-stats'] })
      setToggleOpen(false)
      toast(tenant?.isActive ? 'Tenant pasife alındı' : 'Tenant aktife alındı')
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
      setToggleOpen(false)
    },
  })

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!tenant) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-salon-bg rounded-lg transition-colors text-salon-muted"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{tenant.name}</h1>
          <p className="text-sm text-salon-muted font-mono">{tenant.slug}</p>
        </div>
        <span
          className={cn(
            'ml-2 inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
            planColor[tenant.plan] ?? 'bg-gray-100 text-gray-600',
          )}
        >
          {planLabel[tenant.plan] ?? tenant.plan}
        </span>
      </div>

      {/* Activity summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-salon-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-salon-muted">Kayıt Tarihi</p>
            <Building2 className="w-4 h-4 text-salon-muted" />
          </div>
          <p className="text-lg font-semibold text-gray-900">{formatDate(tenant.createdAt)}</p>
        </div>
        <div className="bg-white rounded-xl border border-salon-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-salon-muted">Toplam Müşteri</p>
            <Users className="w-4 h-4 text-salon-muted" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{tenant.customerCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-salon-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-salon-muted">Toplam Randevu</p>
            <Calendar className="w-4 h-4 text-salon-muted" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{tenant.appointmentCount}</p>
        </div>
      </div>

      {/* Edit panel */}
      <div className="bg-white rounded-xl border border-salon-border p-6 space-y-5 max-w-lg">
        <h2 className="text-base font-semibold text-gray-900">Ayarlar</h2>

        {/* Plan */}
        <div className="space-y-1.5">
          <Label htmlFor="plan">Plan</Label>
          <select
            id="plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="flex h-10 w-full rounded-md border border-salon-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="trial">Trial</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
          </select>
        </div>

        {/* Trial ends at */}
        <div className="space-y-1.5">
          <Label htmlFor="trialDate">Trial Bitiş Tarihi</Label>
          <Input
            id="trialDate"
            type="date"
            value={trialDate}
            onChange={(e) => setTrialDate(e.target.value)}
          />
        </div>

        <Button
          onClick={() =>
            patchMutation.mutate({
              plan,
              ...(trialDate ? { trialEndsAt: new Date(trialDate).toISOString() } : {}),
            })
          }
          disabled={patchMutation.isPending}
          className="w-full sm:w-auto"
        >
          {patchMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>

        {/* Active / Inactive toggle */}
        <div className="pt-4 border-t border-salon-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Durum</p>
              <p className="text-xs text-salon-muted mt-0.5">
                {tenant.isActive ? 'Tenant şu anda aktif' : 'Tenant şu anda pasif'}
              </p>
            </div>
            <Button
              variant={tenant.isActive ? 'destructive' : 'default'}
              size="sm"
              onClick={() => setToggleOpen(true)}
            >
              {tenant.isActive ? 'Pasife Al' : 'Aktife Al'}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={toggleOpen}
        onOpenChange={setToggleOpen}
        title={tenant.isActive ? 'Tenantı Pasife Al' : 'Tenantı Aktife Al'}
        description={
          tenant.isActive
            ? `${tenant.name} adlı tenant pasife alınacak. Kullanıcılar giriş yapamayacak.`
            : `${tenant.name} adlı tenant aktife alınacak. Kullanıcılar tekrar erişebilecek.`
        }
        confirmLabel={tenant.isActive ? 'Pasife Al' : 'Aktife Al'}
        variant={tenant.isActive ? 'destructive' : 'default'}
        onConfirm={() => toggleMutation.mutate()}
        loading={toggleMutation.isPending}
      />
    </div>
  )
}
