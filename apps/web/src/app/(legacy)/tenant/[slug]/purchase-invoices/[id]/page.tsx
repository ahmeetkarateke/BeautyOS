'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Ban, Trash2, FileText, CheckCircle2, Circle, Phone, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiFetch } from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

interface PageProps {
  params: Promise<{ slug: string; id: string }>
}

interface Item {
  id: string
  inventoryId: string | null
  inventoryName: string | null
  inventoryUnit: string | null
  name: string
  quantity: number
  unitPrice: number
  taxRate: number
  discount: number
  total: number
}

interface InvoiceDetail {
  id: string
  supplier: { id: string; name: string; phone: string | null }
  invoiceNumber: string | null
  invoiceDate: string
  dueDate: string | null
  status: 'draft' | 'posted' | 'cancelled'
  subtotal: number
  taxTotal: number
  discountTotal: number
  total: number
  notes: string | null
  postedAt: string | null
  items: Item[]
}

const STATUS_META: Record<InvoiceDetail['status'], { label: string; className: string; icon: typeof CheckCircle2 }> = {
  draft:     { label: 'Taslak',         className: 'bg-yellow-100 text-yellow-700', icon: Circle },
  posted:    { label: 'Muhasebeleşti',  className: 'bg-green-100 text-success',     icon: CheckCircle2 },
  cancelled: { label: 'İptal',          className: 'bg-red-100 text-red-600',       icon: Ban },
}

export default function PurchaseInvoiceDetailPage(props: PageProps) {
  const params = use(props.params)
  const { slug, id } = params
  const router = useRouter()
  const qc = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<'post' | 'cancel' | 'delete' | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-invoice', slug, id],
    queryFn: () => apiFetch<InvoiceDetail>(`/api/v1/tenants/${slug}/purchase-invoices/${id}`),
  })

  const postMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/tenants/${slug}/purchase-invoices/${id}/post`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-invoice', slug, id] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices', slug] })
      qc.invalidateQueries({ queryKey: ['current-accounts', slug] })
      qc.invalidateQueries({ queryKey: ['inventory', slug] })
      toast('Fatura muhasebeleşti — stok ve cari hesap güncellendi')
      setConfirmAction(null)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/tenants/${slug}/purchase-invoices/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-invoice', slug, id] })
      qc.invalidateQueries({ queryKey: ['purchase-invoices', slug] })
      qc.invalidateQueries({ queryKey: ['current-accounts', slug] })
      qc.invalidateQueries({ queryKey: ['inventory', slug] })
      toast('Fatura iptal edildi — stok ve cari geri alındı')
      setConfirmAction(null)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/api/v1/tenants/${slug}/purchase-invoices/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast('Taslak silindi')
      router.push(`/tenant/${slug}/purchase-invoices`)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!data) return null

  const meta = STATUS_META[data.status]
  const StatusIcon = meta.icon

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href={`/tenant/${slug}/purchase-invoices`} className="p-2 rounded-md hover:bg-salon-bg text-salon-muted hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Alış Faturası {data.invoiceNumber && <span className="text-salon-muted">#{data.invoiceNumber}</span>}
          </h1>
          <p className="text-xs text-salon-muted mt-0.5">
            {formatDate(data.invoiceDate)}
            {data.dueDate && <> · Vade: {formatDate(data.dueDate)}</>}
            {data.postedAt && <> · Muhasebeleşti: {formatDate(data.postedAt)}</>}
          </p>
        </div>
        <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full', meta.className)}>
          <StatusIcon className="w-3.5 h-3.5" />
          {meta.label}
        </span>
      </div>

      {/* Aksiyon Butonları */}
      <div className="flex gap-2 flex-wrap">
        {data.status === 'draft' && (
          <>
            <Button onClick={() => setConfirmAction('post')} className="gap-2">
              <Send className="w-4 h-4" /> Muhasebeleştir
            </Button>
            <Button variant="outline" onClick={() => setConfirmAction('delete')} className="gap-2 text-red-600 border-red-200">
              <Trash2 className="w-4 h-4" /> Taslağı Sil
            </Button>
          </>
        )}
        {data.status === 'posted' && (
          <Button variant="outline" onClick={() => setConfirmAction('cancel')} className="gap-2 text-red-600 border-red-200">
            <Ban className="w-4 h-4" /> Faturayı İptal Et
          </Button>
        )}
      </div>

      {/* Tedarikçi + Toplamlar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Tedarikçi</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Link
              href={`/tenant/${slug}/current-accounts/supplier/${data.supplier.id}`}
              className="text-base font-semibold text-gray-900 hover:text-primary inline-flex items-center gap-2"
            >
              {data.supplier.name}
              <BookOpen className="w-4 h-4 text-salon-muted" />
            </Link>
            {data.supplier.phone && (
              <p className="text-sm text-salon-muted flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {data.supplier.phone}
              </p>
            )}
            {data.notes && <p className="text-sm text-gray-700 pt-2 border-t border-salon-border whitespace-pre-wrap">{data.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Toplam</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <div className="flex justify-between text-salon-muted">
              <span>Ara Toplam</span><span>{formatCurrency(data.subtotal)}</span>
            </div>
            {data.discountTotal > 0 && (
              <div className="flex justify-between text-salon-muted">
                <span>İndirim</span><span>−{formatCurrency(data.discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-salon-muted">
              <span>KDV</span><span>{formatCurrency(data.taxTotal)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-salon-border text-base font-bold text-gray-900">
              <span>Genel Toplam</span><span>{formatCurrency(data.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kalemler */}
      <Card>
        <CardHeader><CardTitle className="text-base">Kalemler</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-salon-border bg-salon-bg text-xs text-salon-muted uppercase">
                  <th className="px-4 py-2.5 text-left font-semibold">Açıklama</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Adet</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Birim Fiyat</th>
                  <th className="px-4 py-2.5 text-right font-semibold hidden sm:table-cell">İndirim</th>
                  <th className="px-4 py-2.5 text-right font-semibold">KDV</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-b border-salon-border last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{it.name}</p>
                      {it.inventoryName && (
                        <p className="text-[11px] text-salon-muted mt-0.5">→ Stok: {it.inventoryName}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">
                      {it.quantity}
                      {it.inventoryUnit && <span className="text-xs text-salon-muted ml-1">{it.inventoryUnit}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{formatCurrency(it.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-right text-salon-muted hidden sm:table-cell">
                      {it.discount > 0 ? formatCurrency(it.discount) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-salon-muted">%{it.taxRate.toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{formatCurrency(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmAction === 'post'}
        onOpenChange={(o) => { if (!o) setConfirmAction(null) }}
        title="Faturayı Muhasebeleştir"
        description="Bağlı stok kalemleri stoğa eklenecek ve tedarikçi cari hesabına borç olarak işlenecek. Bu işlem 'İptal' ile geri alınabilir."
        confirmLabel="Muhasebeleştir"
        loading={postMutation.isPending}
        onConfirm={() => postMutation.mutate()}
      />
      <ConfirmDialog
        open={confirmAction === 'cancel'}
        onOpenChange={(o) => { if (!o) setConfirmAction(null) }}
        title="Faturayı İptal Et"
        description="Stok hareketleri geri alınacak ve tedarikçi cari hesabına ters kayıt atılacak. Bu işlem geri alınamaz."
        confirmLabel="İptal Et"
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate()}
      />
      <ConfirmDialog
        open={confirmAction === 'delete'}
        onOpenChange={(o) => { if (!o) setConfirmAction(null) }}
        title="Taslağı Sil"
        description="Bu taslak fatura kalıcı olarak silinecek."
        confirmLabel="Sil"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  )
}
