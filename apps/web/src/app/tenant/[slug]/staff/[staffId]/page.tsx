'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
interface DaySchedule { start: string; end: string }
type WorkingHoursMap = Record<DayKey, DaySchedule | null>

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'monday', label: 'Pazartesi' },
  { key: 'tuesday', label: 'Salı' },
  { key: 'wednesday', label: 'Çarşamba' },
  { key: 'thursday', label: 'Perşembe' },
  { key: 'friday', label: 'Cuma' },
  { key: 'saturday', label: 'Cumartesi' },
  { key: 'sunday', label: 'Pazar' },
]

const DEFAULT_WORKING_HOURS: WorkingHoursMap = {
  monday: null, tuesday: null, wednesday: null, thursday: null,
  friday: null, saturday: null, sunday: null,
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
  const router = useRouter()
  const isOwner = user?.role === 'owner'
  const isOwnerOrManager = user?.role === 'owner' || user?.role === 'manager'
  const qc = useQueryClient()

  const [wh, setWh] = useState<WorkingHoursMap>(DEFAULT_WORKING_HOURS)

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
  })

  const { data: leavesData, isLoading: leavesLoading } = useQuery({
    queryKey: ['staff-leaves', slug, staffId],
    queryFn: () => apiFetch<{ data: StaffLeave[] }>(`/api/v1/tenants/${slug}/staff/${staffId}/leaves`),
    enabled: activeTab === 'leaves',
  })

  interface CommissionEdit {
    commissionType: 'percentage' | 'fixed'
    commissionValue: string
    priceOverride: string
  }
  const [commissionEdits, setCommissionEdits] = useState<Record<string, CommissionEdit>>({})

  useEffect(() => {
    if (!skillsData) return
    const edits: Record<string, CommissionEdit> = {}
    for (const s of skillsData.data) {
      edits[s.serviceId] = {
        commissionType: s.commissionType,
        commissionValue: String(s.commissionValue),
        priceOverride: s.priceOverride != null ? String(s.priceOverride) : '',
      }
    }
    setCommissionEdits(edits)
  }, [skillsData])

  const upsertSkillMutation = useMutation({
    mutationFn: (payload: { serviceId: string; commissionType: 'percentage' | 'fixed'; commissionValue: number; priceOverride?: number }) =>
      apiFetch(`/api/v1/tenants/${slug}/staff/${staffId}/services`, {
        method: 'POST',
        body: JSON.stringify({
          serviceId: payload.serviceId,
          commissionType: payload.commissionType,
          commissionValue: payload.commissionValue,
          ...(payload.priceOverride != null ? { priceOverride: payload.priceOverride } : {}),
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-skills', slug, staffId] }),
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const removeSkillMutation = useMutation({
    mutationFn: (serviceId: string) =>
      apiFetch(`/api/v1/tenants/${slug}/staff/${staffId}/services/${serviceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-skills', slug, staffId] })
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function handleToggleService(serviceId: string, checked: boolean) {
    if (checked) {
      const edit: CommissionEdit = { commissionType: 'percentage', commissionValue: '0', priceOverride: '' }
      setCommissionEdits((prev) => ({ ...prev, [serviceId]: edit }))
      upsertSkillMutation.mutate({ serviceId, commissionType: 'percentage', commissionValue: 0 })
    } else {
      setCommissionEdits((prev) => { const next = { ...prev }; delete next[serviceId]; return next })
      removeSkillMutation.mutate(serviceId)
    }
  }

  function handleCommissionBlur(serviceId: string) {
    const edit = commissionEdits[serviceId]
    if (!edit) return
    upsertSkillMutation.mutate({
      serviceId,
      commissionType: edit.commissionType,
      commissionValue: Number(edit.commissionValue) || 0,
      ...(edit.priceOverride ? { priceOverride: Number(edit.priceOverride) } : {}),
    })
  }

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

  useEffect(() => {
    if (user?.role !== 'staff' || !staffList) return
    const mine = staffList.data.find((s) => s.email === user.email)
    if (!mine || mine.id !== staffId) router.replace(`/tenant/${slug}/dashboard`)
  }, [user, staffList, staffId, slug, router])

  useEffect(() => {
    if (staff) {
      const raw = (staff.workingHours ?? {}) as Partial<WorkingHoursMap>
      setWh({ ...DEFAULT_WORKING_HOURS, ...raw })
    }
  }, [staff])

  const saveWorkingHoursMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tenants/${slug}/staff/${staffId}`, {
        method: 'PATCH',
        body: JSON.stringify({ workingHours: wh }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff', slug] })
      toast('Çalışma saatleri kaydedildi')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function toggleDay(key: DayKey) {
    setWh((prev) => ({
      ...prev,
      [key]: prev[key] === null ? { start: '09:00', end: '18:00' } : null,
    }))
  }

  function updateDay(key: DayKey, field: 'start' | 'end', value: string) {
    setWh((prev) => ({
      ...prev,
      [key]: prev[key] ? { ...(prev[key] as DaySchedule), [field]: value } : null,
    }))
  }

  const color = staff ? getStaffColor(staff.colorCode) : '#6B48FF'
  const skills = skillsData?.data ?? []
  const leaves = leavesData?.data ?? []
  const assignedIds = new Set(skills.map((s) => s.serviceId))
  const allServices = servicesData?.data ?? []
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

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-salon-muted">Çalışma Saatleri</p>
                    {isOwnerOrManager && (
                      <Button
                        size="sm"
                        onClick={() => saveWorkingHoursMutation.mutate()}
                        disabled={saveWorkingHoursMutation.isPending}
                      >
                        {saveWorkingHoursMutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {DAYS.map(({ key, label }) => {
                      const dayData = wh[key]
                      const isOpen = dayData !== null
                      return (
                        <div key={key} className="flex items-center gap-3 py-1.5">
                          <span className="text-sm text-gray-700 w-24 shrink-0">{label}</span>
                          <button
                            type="button"
                            disabled={!isOwnerOrManager}
                            onClick={() => toggleDay(key)}
                            className={cn(
                              'px-3 py-1 rounded-full text-xs font-medium border transition-colors shrink-0',
                              isOpen
                                ? 'bg-primary text-white border-primary'
                                : 'border-salon-border text-salon-muted',
                              !isOwnerOrManager && 'cursor-default opacity-75',
                            )}
                          >
                            {isOpen ? 'Açık' : 'Kapalı'}
                          </button>
                          {isOpen && (
                            <>
                              <input
                                type="time"
                                value={dayData.start}
                                disabled={!isOwnerOrManager}
                                onChange={(e) => updateDay(key, 'start', e.target.value)}
                                className="border border-salon-border rounded-md px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-default w-28"
                              />
                              <span className="text-salon-muted text-sm">—</span>
                              <input
                                type="time"
                                value={dayData.end}
                                disabled={!isOwnerOrManager}
                                onChange={(e) => updateDay(key, 'end', e.target.value)}
                                className="border border-salon-border rounded-md px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-default w-28"
                              />
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

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
            ) : skillsLoading || !servicesData ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : allServices.length === 0 ? (
              <p className="text-sm text-salon-muted">Henüz hizmet tanımlanmamış.</p>
            ) : (
              <div className="divide-y divide-salon-border">
                {allServices.map((svc) => {
                  const assigned = assignedIds.has(svc.id)
                  const edit = commissionEdits[svc.id]
                  return (
                    <div key={svc.id} className="py-3 space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={assigned}
                          onChange={(e) => handleToggleService(svc.id, e.target.checked)}
                          className="w-4 h-4 rounded border-salon-border accent-primary cursor-pointer"
                        />
                        <span className={cn('text-sm font-medium', assigned ? 'text-gray-900' : 'text-salon-muted')}>
                          {svc.name}
                        </span>
                        {svc.category && (
                          <span className="text-xs text-salon-muted">{svc.category}</span>
                        )}
                      </label>

                      {assigned && edit && (
                        <div className="ml-7 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCommissionEdits((prev) => ({ ...prev, [svc.id]: { ...prev[svc.id], commissionType: 'percentage' } }))
                              setTimeout(() => handleCommissionBlur(svc.id), 0)
                            }}
                            className={cn(
                              'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                              edit.commissionType === 'percentage'
                                ? 'bg-primary text-white border-primary'
                                : 'border-salon-border text-salon-muted hover:border-gray-400',
                            )}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCommissionEdits((prev) => ({ ...prev, [svc.id]: { ...prev[svc.id], commissionType: 'fixed' } }))
                              setTimeout(() => handleCommissionBlur(svc.id), 0)
                            }}
                            className={cn(
                              'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                              edit.commissionType === 'fixed'
                                ? 'bg-primary text-white border-primary'
                                : 'border-salon-border text-salon-muted hover:border-gray-400',
                            )}
                          >
                            ₺
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={edit.commissionValue}
                            onChange={(e) => setCommissionEdits((prev) => ({ ...prev, [svc.id]: { ...prev[svc.id], commissionValue: e.target.value } }))}
                            onBlur={() => handleCommissionBlur(svc.id)}
                            placeholder={edit.commissionType === 'percentage' ? 'Komisyon %' : 'Komisyon ₺'}
                            className="w-28 border border-salon-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <input
                            type="number"
                            min={0}
                            value={edit.priceOverride}
                            onChange={(e) => setCommissionEdits((prev) => ({ ...prev, [svc.id]: { ...prev[svc.id], priceOverride: e.target.value } }))}
                            onBlur={() => handleCommissionBlur(svc.id)}
                            placeholder="Fiyat override (opsiyonel)"
                            className="w-40 border border-salon-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
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
