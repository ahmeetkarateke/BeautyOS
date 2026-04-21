'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, UserX } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StaffModal } from '@/components/staff/staff-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { getStaffColor } from '@/lib/staff-colors'

interface StaffMember {
  id: string
  fullName: string
  title: string
  colorCode?: number | null
}

interface PageProps {
  params: { slug: string }
}

export default function StaffPage({ params }: PageProps) {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StaffMember | undefined>()
  const [deactivateTarget, setDeactivateTarget] = useState<StaffMember | undefined>()

  const { data, isLoading } = useQuery({
    queryKey: ['staff', params.slug],
    queryFn: () => apiFetch<{ data: StaffMember[] }>(`/api/v1/tenants/${params.slug}/staff`),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${params.slug}/staff/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff', params.slug] })
      toast('Personel deaktif edildi')
      setDeactivateTarget(undefined)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const staff = data?.data ?? []

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Personel</h1>
          <p className="text-sm text-salon-muted mt-0.5">{staff.length} personel</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditTarget(undefined); setModalOpen(true) }}>
          <Plus className="w-4 h-4" />
          Yeni Personel
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-salon-border">
          <p className="text-salon-muted text-sm">Henüz personel eklenmemiş</p>
          <Button size="sm" className="mt-3 gap-2" onClick={() => { setEditTarget(undefined); setModalOpen(true) }}>
            <Plus className="w-4 h-4" /> İlk personelini ekle
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((member) => {
            const color = getStaffColor(member.colorCode)
            return (
              <div key={member.id} className="bg-white rounded-xl border border-salon-border p-4 flex flex-col gap-3">
                <Link href={`/tenant/${params.slug}/staff/${member.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {member.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{member.fullName}</p>
                    <p className="text-xs text-salon-muted">{member.title}</p>
                  </div>
                </Link>
                <div className="flex gap-2 mt-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => { setEditTarget(member); setModalOpen(true) }}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Düzenle
                  </Button>
                  <button
                    onClick={() => setDeactivateTarget(member)}
                    className="p-2 text-salon-muted hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Deaktif et"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <StaffModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        tenantSlug={params.slug}
        staff={editTarget}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => { if (!o) setDeactivateTarget(undefined) }}
        title="Personeli Deaktif Et"
        description={`"${deactivateTarget?.fullName}" adlı personeli deaktif ederseniz sisteme giriş yapamaz ve randevularına atanmaz.`}
        confirmLabel="Deaktif Et"
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
        loading={deactivateMutation.isPending}
      />
    </div>
  )
}
