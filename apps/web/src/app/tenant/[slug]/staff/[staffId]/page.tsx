'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, User, Briefcase, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { getStaffColor } from '@/lib/staff-colors'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface StaffMember {
  id: string
  fullName: string
  title: string
  email?: string | null
  colorCode?: number | null
  workingHours?: Record<string, unknown> | null
  skills?: { serviceId: string; serviceName: string; category: string | null }[]
}

interface SkillAssignment {
  serviceId: string
  serviceName: string
  category: string | null
  commissionType: 'percentage' | 'fixed'
  commissionValue: number
  priceOverride: number | null
}

interface Service {
  id: string
  name: string
  category?: string | null
  price: number
}

interface StaffLeave {
  id: string
  leaveDate: string
  leaveType: 'day_off' | 'sick_leave' | 'vacation' | 'other'
  note: string | null
}

const LEAVE_LABELS: Record<StaffLeave['leaveType'], string> = {
  day_off: 'İzin Günü',
  sick_leave: 'Hastalık',
  vacation: 'Tatil',
  other: 'Diğer',
}

const tabs = [
  { id: 'profile', label: 'Profil', icon: User },
  { id: 'skills', label: 'Yetenekler', icon: Briefcase },
  { id: 'leaves', label: 'İzinler', icon: Calendar },
]

type TabId = 'profile' | 'skills' | 'leaves'

interface PageProps {
  params: { slug: string; staffId: string }
}

export default function StaffDetailPage({ params }: PageProps) {
  const { slug, staffId } = params
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const user = useAuthStore((s) => s.user)
  const isOwner = user?.role === 'owner'
  const qc = useQueryClient()

  const { data: staffList, isLoading: staffLoading } = useQuery({
    queryKey: ['staff', slug],
    queryFn: () => apiFetch<{ data: StaffMember[] }>(`/api/v1/tenants/${slug}/staff`),
  })
  const staff = staffList?.data.find((s) => s.id === staffId)

  const { data: skillsData, isLoading: skillsLoading } = useQuery({
    queryKey: ['staff-skills', slug, staffId],
    queryFn: () => apiFetch<{ data: SkillAssignment[] }>(`/api/v1/tenants/${slug}/staff/${staffId}/services`),
  })

  const { data: servicesData } = useQuery({
    queryKey: ['services', slug],
    queryFn: () => apiFetch<{ data: Service[] }>(`/api/v1/tenants/${slug}/services`),
    enabled: activeTab === 'skills',
  })

  const { data: leavesData, isLoading: leavesLoading } = useQuery({
    queryKey: ['staff-leaves', slug, staffId],
    queryFn: () => apiFetch<{ data: StaffLeave[] }>(`/api/v1/tenants/${slug}/staff/${staffId}/leaves`),
    enabled: activeTab === 'leaves',
  })

  const [skillForm, setSkillForm] = useState({
    serviceId: '',
    commissionType: 'percentage' as 'percentage' | 'fixed',
    commissionValue: 0,
    priceOverride: '',
  })

  const addSkillMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tenants/${slug}/staff/${staffId}/services`, {
        method: 'POST',
        body: JSON.stringify({
          serviceId: skillForm.serviceId,
          commissionType: skillForm.commissionType,
          commissionValue: skillForm.commissionValue,
          ...(skillForm.priceOverride ? { priceOverride: Number(skillForm.priceOverride) } : {}),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-skills', slug, staffId] })
      toast('Yetenek eklendi')
      setSkillForm({ serviceId: '', commissionType: 'percentage', commissionValue: 0, priceOverride: '' })
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const removeSkillMutation = useMutation({
    mutationFn: (serviceId: string) =>
      apiFetch(`/api/v1/tenants/${slug}/staff/${staffId}/services/${serviceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-skills', slug, staffId] })
      toast('Yetenek kaldırıldı')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const [leaveForm, setLeaveForm] = useState({
    leaveDate: '',
    leaveType: 'day_off' as StaffLeave['leaveType'],
    note: '',
  })

  const addLeaveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tenants/${slug}/staff/${staffId}/leaves`, {
        method: 'POST',
        body: JSON.stringify({
          leaveDate: leaveForm.leaveDate,
          leaveType: leaveForm.leaveType,
          ...(leaveForm.note ? { note: leaveForm.note } : {}),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-leaves', slug, staffId] })
      toast('İzin eklendi')
      setLeaveForm({ leaveDate: '', leaveType: 'day_off', note: '' })
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const deleteLeaveMutation = useMutation({
    mutationFn: (leaveId: string) =>
      apiFetch(`/api/v1/tenants/${slug}/staff/${staffId}/leaves/${leaveId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-leaves', slug, staffId] })
      toast('İzin silindi')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const color = staff ? getStaffColor(staff.colorCode) : '#6B48FF'
  const skills = skillsData?.data ?? []
  const leaves = leavesData?.data ?? []
  const assignedIds = new Set(skills.map((s) => s.serviceId))
  const availableServices = (servicesData?.data ?? []).filter((s) => !assignedIds.has(s.id))
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <Link
        href={`/tenant/${slug}/staff`}
        className="inline-flex items-center gap-2 text-sm text-salon-muted hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Personel Listesi
      </Link>

      {/* Header */}
      {staffLoading ? (
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ) : staff ? (
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            {staff.fullName.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{staff.fullName}</h1>
            <p className="text-sm text-salon-muted">{staff.title}</p>
          </div>
        </div>
      ) : (
        <p className="text-salon-muted text-sm">Personel bulunamadı.</p>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-salon-border">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-salon-muted hover:text-gray-900',
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab: Profil */}
      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle>Profil Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            {staffLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : staff ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-salon-muted mb-1">Ad Soyad</p>
                    <p className="text-sm font-medium text-gray-900">{staff.fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-salon-muted mb-1">Unvan</p>
                    <p className="text-sm font-medium text-gray-900">{staff.title}</p>
                  </div>
                  {staff.email && (
                    <div className="col-span-2">
                      <p className="text-xs text-salon-muted mb-1">E-posta</p>
                      <p className="text-sm font-medium text-gray-900">{staff.email}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs text-salon-muted mb-1">Renk</p>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm text-gray-700">{color}</span>
                  </div>
                </div>

                {staff.workingHours && (
                  <div>
                    <p className="text-xs text-salon-muted mb-1">Çalışma Saatleri</p>
                    <pre className="text-xs bg-salon-bg rounded p-3 overflow-auto">
                      {JSON.stringify(staff.workingHours, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <p className="text-xs text-salon-muted mb-2">Yetenekler</p>
                  {(() => {
                    const profileSkills = staff?.skills ?? []
                    return profileSkills.length === 0 ? (
                      <p className="text-xs text-salon-muted">Henüz yetenek atanmamış.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {profileSkills.map((s) => (
                          <span
                            key={s.serviceId}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary border border-primary/20"
                          >
                            {s.serviceName}
                          </span>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            ) : (
              <p className="text-salon-muted text-sm">Personel bilgisi yüklenemedi.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Yetenekler */}
      {activeTab === 'skills' && (
        <Card>
          <CardHeader>
            <CardTitle>Yetenekler</CardTitle>
          </CardHeader>
          <CardContent>
            {!isOwner ? (
              <p className="text-sm text-salon-muted">Bu bölümü görüntüleme yetkiniz yok.</p>
            ) : skillsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-6">
                {skills.length === 0 ? (
                  <p className="text-sm text-salon-muted">Henüz yetenek atanmamış.</p>
                ) : (
                  <div className="divide-y divide-salon-border">
                    {skills.map((skill) => (
                      <div key={skill.serviceId} className="flex items-center gap-3 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{skill.serviceName}</p>
                          {skill.category && (
                            <p className="text-xs text-salon-muted">{skill.category}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-700 shrink-0">
                          <span>
                            Komisyon:{' '}
                            {skill.commissionType === 'percentage'
                              ? `%${skill.commissionValue}`
                              : formatCurrency(skill.commissionValue)}
                          </span>
                          {skill.priceOverride != null && (
                            <span>Fiyat: {formatCurrency(skill.priceOverride)}</span>
                          )}
                        </div>
                        <button
                          onClick={() => removeSkillMutation.mutate(skill.serviceId)}
                          disabled={removeSkillMutation.isPending}
                          className="p-1.5 text-salon-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Kaldır"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-salon-border pt-5 space-y-4">
                  <p className="text-sm font-medium text-gray-900">Yeni Yetenek Ekle</p>
                  <div className="space-y-3">
                    <select
                      value={skillForm.serviceId}
                      onChange={(e) => setSkillForm((f) => ({ ...f, serviceId: e.target.value }))}
                      className="w-full border border-salon-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Hizmet seçin...</option>
                      {availableServices.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSkillForm((f) => ({ ...f, commissionType: 'percentage' }))}
                        className={cn(
                          'flex-1 py-2 text-sm rounded-md border transition-colors',
                          skillForm.commissionType === 'percentage'
                            ? 'bg-primary text-white border-primary'
                            : 'border-salon-border text-salon-muted hover:border-gray-400',
                        )}
                      >
                        % Yüzde
                      </button>
                      <button
                        type="button"
                        onClick={() => setSkillForm((f) => ({ ...f, commissionType: 'fixed' }))}
                        className={cn(
                          'flex-1 py-2 text-sm rounded-md border transition-colors',
                          skillForm.commissionType === 'fixed'
                            ? 'bg-primary text-white border-primary'
                            : 'border-salon-border text-salon-muted hover:border-gray-400',
                        )}
                      >
                        ₺ Sabit
                      </button>
                    </div>

                    <input
                      type="number"
                      min={0}
                      value={skillForm.commissionValue}
                      onChange={(e) => setSkillForm((f) => ({ ...f, commissionValue: Number(e.target.value) }))}
                      placeholder={skillForm.commissionType === 'percentage' ? 'Komisyon %' : 'Komisyon ₺'}
                      className="w-full border border-salon-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />

                    <input
                      type="number"
                      min={0}
                      value={skillForm.priceOverride}
                      onChange={(e) => setSkillForm((f) => ({ ...f, priceOverride: e.target.value }))}
                      placeholder="Fiyat override (Boş bırakın = hizmet fiyatı)"
                      className="w-full border border-salon-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />

                    <Button
                      onClick={() => addSkillMutation.mutate()}
                      disabled={!skillForm.serviceId || addSkillMutation.isPending}
                      size="sm"
                      className="w-full"
                    >
                      {addSkillMutation.isPending ? 'Ekleniyor...' : 'Kaydet'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: İzinler */}
      {activeTab === 'leaves' && (
        <Card>
          <CardHeader>
            <CardTitle>İzinler</CardTitle>
          </CardHeader>
          <CardContent>
            {!isOwner ? (
              <p className="text-sm text-salon-muted">Bu bölümü görüntüleme yetkiniz yok.</p>
            ) : leavesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-6">
                {leaves.length === 0 ? (
                  <p className="text-sm text-salon-muted">Kayıtlı izin yok.</p>
                ) : (
                  <div className="divide-y divide-salon-border">
                    {leaves.map((leave) => (
                      <div key={leave.id} className="flex items-center gap-3 py-3">
                        <div className="flex-1 min-w-0 grid grid-cols-3 gap-2 items-center">
                          <p className="text-sm text-gray-900">{formatDate(leave.leaveDate)}</p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 w-fit">
                            {LEAVE_LABELS[leave.leaveType]}
                          </span>
                          <p className="text-xs text-salon-muted truncate">{leave.note ?? '—'}</p>
                        </div>
                        <button
                          onClick={() => deleteLeaveMutation.mutate(leave.id)}
                          disabled={deleteLeaveMutation.isPending}
                          className="p-1.5 text-salon-muted hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                          title="Sil"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-salon-border pt-5 space-y-4">
                  <p className="text-sm font-medium text-gray-900">Yeni İzin Ekle</p>
                  <div className="space-y-3">
                    <input
                      type="date"
                      min={today}
                      value={leaveForm.leaveDate}
                      onChange={(e) => setLeaveForm((f) => ({ ...f, leaveDate: e.target.value }))}
                      className="w-full border border-salon-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />

                    <select
                      value={leaveForm.leaveType}
                      onChange={(e) =>
                        setLeaveForm((f) => ({ ...f, leaveType: e.target.value as StaffLeave['leaveType'] }))
                      }
                      className="w-full border border-salon-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {Object.entries(LEAVE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={leaveForm.note}
                      onChange={(e) => setLeaveForm((f) => ({ ...f, note: e.target.value }))}
                      placeholder="Not (opsiyonel)"
                      className="w-full border border-salon-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />

                    <Button
                      onClick={() => addLeaveMutation.mutate()}
                      disabled={!leaveForm.leaveDate || addLeaveMutation.isPending}
                      size="sm"
                      className="w-full"
                    >
                      {addLeaveMutation.isPending ? 'Ekleniyor...' : 'İzin Ekle'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
