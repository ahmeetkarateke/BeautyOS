'use client'

import { useState, type FormEvent, use } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, X, Phone, Mail, Truck, BookOpen, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface PageProps {
  params: Promise<{ slug: string }>
}

interface Supplier {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  isActive: boolean
}

export default function SuppliersPage(props: PageProps) {
  const params = use(props.params)
  const { slug } = params
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [toDeactivate, setToDeactivate] = useState<Supplier | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', slug],
    queryFn: () => apiFetch<{ data: Supplier[] }>(`/api/v1/tenants/${slug}/suppliers?includeInactive=true`),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/tenants/${slug}/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers', slug] })
      toast('Tedarikçi pasifleştirildi')
      setToDeactivate(null)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Tedarikçiler</h1>
            <p className="text-xs text-salon-muted">Alımlar bu tedarikçilere bağlanır</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setAdding((v) => !v)}>
          <Plus className="w-4 h-4" /> Yeni Tedarikçi
        </Button>
      </div>

      {adding && (
        <SupplierForm
          slug={slug}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <SupplierForm
          slug={slug}
          supplier={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : !data?.data.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="w-10 h-10 mx-auto text-salon-muted opacity-40" />
            <p className="text-sm text-salon-muted mt-3">Henüz tedarikçi yok</p>
            <p className="text-xs text-salon-muted mt-1">"Yeni Tedarikçi" ile ilk kaydı oluşturun.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="bg-white border border-salon-border rounded-lg divide-y divide-salon-border overflow-hidden">
          {data.data.map((s) => (
            <li key={s.id} className={`flex items-start gap-3 px-4 py-3 ${s.isActive ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-900">{s.name}</p>
                  {!s.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-salon-muted">Pasif</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="text-xs text-salon-muted flex items-center gap-1 hover:text-primary">
                      <Phone className="w-3 h-3" /> {s.phone}
                    </a>
                  )}
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="text-xs text-salon-muted flex items-center gap-1 hover:text-primary">
                      <Mail className="w-3 h-3" /> {s.email}
                    </a>
                  )}
                </div>
                {s.notes && <p className="text-xs text-salon-muted mt-1.5">{s.notes}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link
                  href={`/tenant/${slug}/current-accounts/supplier/${s.id}`}
                  className="p-1.5 rounded-md text-salon-muted hover:text-primary hover:bg-primary-100"
                  title="Cari Ekstre"
                >
                  <BookOpen className="w-4 h-4" />
                </Link>
                <Link
                  href={`/tenant/${slug}/purchase-invoices?supplierId=${s.id}`}
                  className="p-1.5 rounded-md text-salon-muted hover:text-primary hover:bg-primary-100"
                  title="Faturalar"
                >
                  <FileText className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setEditing(s)}
                  className="p-1.5 rounded-md text-salon-muted hover:text-primary hover:bg-primary-100"
                  aria-label="Düzenle"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {s.isActive && (
                  <button
                    onClick={() => setToDeactivate(s)}
                    className="p-1.5 rounded-md text-salon-muted hover:text-red-600 hover:bg-red-50"
                    aria-label="Pasifleştir"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDeactivate}
        onOpenChange={(o) => { if (!o) setToDeactivate(null) }}
        title="Tedarikçiyi pasifleştir"
        description="Listeden gizlenecek; mevcut faturalar ve cari geçmiş silinmez."
        confirmLabel="Pasifleştir"
        loading={deactivateMutation.isPending}
        onConfirm={() => { if (toDeactivate) deactivateMutation.mutate(toDeactivate.id) }}
      />
    </div>
  )
}

function SupplierForm({
  slug, supplier, onClose,
}: {
  slug: string
  supplier?: Supplier
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!supplier
  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')

  const mutation = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      return isEdit
        ? apiFetch(`/api/v1/tenants/${slug}/suppliers/${supplier!.id}`, { method: 'PATCH', body })
        : apiFetch(`/api/v1/tenants/${slug}/suppliers`, { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers', slug] })
      toast(isEdit ? 'Tedarikçi güncellendi' : 'Tedarikçi eklendi')
      onClose()
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (name.trim().length < 2) {
      toast('İsim en az 2 karakter olmalıdır', 'error')
      return
    }
    mutation.mutate()
  }

  return (
    <Card className="border-2 border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{isEdit ? 'Tedarikçiyi Düzenle' : 'Yeni Tedarikçi'}</CardTitle>
        <button type="button" onClick={onClose} className="text-salon-muted hover:text-gray-900">
          <X className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sup-name">İsim / Firma Adı</Label>
            <Input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sup-phone">Telefon</Label>
              <Input id="sup-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-email">E-posta</Label>
              <Input id="sup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-notes">Notlar</Label>
            <Textarea id="sup-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">İptal</Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Kaydediliyor...' : (isEdit ? 'Güncelle' : 'Ekle')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
