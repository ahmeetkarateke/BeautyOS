'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, UserPlus, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
}

interface CustomerLite {
  id: string
  fullName: string
  phone: string
}

interface ServiceLite {
  id: string
  name: string
}

interface StaffLite {
  id: string
  fullName: string
}

interface CustomersResponse {
  data: CustomerLite[]
}
interface ServicesResponse {
  data: ServiceLite[]
}
interface StaffResponse {
  data: Array<{ id: string; fullName: string }>
}

export function AddWaitlistModal({ open, onOpenChange, tenantSlug }: Props) {
  const qc = useQueryClient()

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState<string>('')
  const [customerName, setCustomerName] = useState<string>('')
  const [serviceId, setServiceId] = useState<string>('')
  const [staffId, setStaffId] = useState<string>('')
  const [preferredDate, setPreferredDate] = useState<string>('')
  const [preferredTimeRange, setPreferredTimeRange] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Quick "new customer" inline
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newFullName, setNewFullName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  useEffect(() => {
    if (!open) {
      setCustomerSearch('')
      setCustomerId('')
      setCustomerName('')
      setServiceId('')
      setStaffId('')
      setPreferredDate('')
      setPreferredTimeRange('')
      setNotes('')
      setShowNewCustomer(false)
      setNewFullName('')
      setNewPhone('')
    }
  }, [open])

  const customersQuery = useQuery({
    queryKey: ['waitlist-customer-search', tenantSlug, customerSearch],
    queryFn: () =>
      apiFetch<CustomersResponse>(
        `/api/v1/tenants/${tenantSlug}/customers?search=${encodeURIComponent(customerSearch)}`,
      ),
    enabled: open && customerSearch.length >= 2 && !customerId,
  })

  const servicesQuery = useQuery({
    queryKey: ['waitlist-services', tenantSlug],
    queryFn: () => apiFetch<ServicesResponse>(`/api/v1/tenants/${tenantSlug}/services`),
    enabled: open,
  })

  const staffQuery = useQuery({
    queryKey: ['waitlist-staff', tenantSlug],
    queryFn: () => apiFetch<StaffResponse>(`/api/v1/tenants/${tenantSlug}/staff`),
    enabled: open,
  })

  const services: ServiceLite[] = useMemo(() => servicesQuery.data?.data ?? [], [servicesQuery.data])
  const staffList: StaffLite[] = useMemo(
    () => (staffQuery.data?.data ?? []).map((s) => ({ id: s.id, fullName: s.fullName })),
    [staffQuery.data],
  )

  const createCustomerMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string; fullName: string }>(`/api/v1/tenants/${tenantSlug}/customers`, {
        method: 'POST',
        body: JSON.stringify({ fullName: newFullName, phone: newPhone }),
      }),
    onSuccess: (c) => {
      setCustomerId(c.id)
      setCustomerName(c.fullName)
      setShowNewCustomer(false)
      qc.invalidateQueries({ queryKey: ['customers', tenantSlug] })
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const submitMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/waitlist`, {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          serviceId: serviceId || undefined,
          staffId: staffId || undefined,
          preferredDate: preferredDate || undefined,
          preferredTimeRange: preferredTimeRange.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waitlist', tenantSlug] })
      toast('Bekleme listesine eklendi')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerId) {
      toast('Lütfen müşteri seçin', 'error')
      return
    }
    submitMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bekleme Listesine Ekle</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Customer selector */}
          <div className="space-y-2">
            <Label>Müşteri</Label>
            {customerId ? (
              <div className="flex items-center justify-between rounded-md border border-salon-border px-3 py-2 bg-salon-bg">
                <span className="text-sm font-medium text-gray-900">{customerName}</span>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setCustomerId('')
                    setCustomerName('')
                  }}
                >
                  Değiştir
                </button>
              </div>
            ) : showNewCustomer ? (
              <div className="space-y-2 border border-salon-border rounded-md p-3">
                <Input
                  placeholder="Ad Soyad"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                />
                <Input
                  type="tel"
                  placeholder="Telefon"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowNewCustomer(false)}
                  >
                    Vazgeç
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    disabled={createCustomerMutation.isPending || newFullName.length < 2 || newPhone.length < 10}
                    onClick={() => createCustomerMutation.mutate()}
                  >
                    {createCustomerMutation.isPending ? 'Ekleniyor...' : 'Müşteri Oluştur'}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-salon-muted pointer-events-none" />
                  <input
                    type="search"
                    placeholder="İsim veya telefon ile ara (en az 2 karakter)"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full h-11 pl-9 pr-4 rounded-md border border-salon-border bg-white text-sm text-gray-900 placeholder:text-salon-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                {customerSearch.length >= 2 && (
                  <div className="border border-salon-border rounded-md max-h-44 overflow-y-auto">
                    {customersQuery.isLoading ? (
                      <div className="p-3 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-salon-muted" />
                      </div>
                    ) : (customersQuery.data?.data?.length ?? 0) === 0 ? (
                      <div className="p-3 text-sm text-salon-muted text-center">Müşteri bulunamadı</div>
                    ) : (
                      customersQuery.data!.data.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-salon-bg border-b border-salon-border last:border-0"
                          onClick={() => {
                            setCustomerId(c.id)
                            setCustomerName(c.fullName)
                            setCustomerSearch('')
                          }}
                        >
                          <div className="text-sm font-medium text-gray-900">{c.fullName}</div>
                          <div className="text-xs text-salon-muted">{c.phone}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(true)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Yeni müşteri oluştur
                </button>
              </>
            )}
          </div>

          {/* Service */}
          <div className="space-y-2">
            <Label htmlFor="service">Hizmet (isteğe bağlı)</Label>
            <Select id="service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Fark etmez</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Staff */}
          <div className="space-y-2">
            <Label htmlFor="staff">Personel (isteğe bağlı)</Label>
            <Select id="staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Fark etmez</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </Select>
          </div>

          {/* Preferred date */}
          <div className="space-y-2">
            <Label htmlFor="preferredDate">Tercih Edilen Tarih (isteğe bağlı)</Label>
            <Input
              id="preferredDate"
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
            />
          </div>

          {/* Time range */}
          <div className="space-y-2">
            <Label htmlFor="preferredTimeRange">Saat Aralığı</Label>
            <Input
              id="preferredTimeRange"
              placeholder="Örn: öğleden sonra, 10:00-14:00, hafta sonu"
              value={preferredTimeRange}
              onChange={(e) => setPreferredTimeRange(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notlar</Label>
            <Textarea
              id="notes"
              placeholder="Ek bilgi..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" className="flex-1" disabled={submitMutation.isPending || !customerId}>
              {submitMutation.isPending ? 'Ekleniyor...' : 'Listeye Ekle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
