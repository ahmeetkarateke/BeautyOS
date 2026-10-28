'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Plus, FileText, Filter, CheckCircle2, Circle, Ban } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

interface PageProps {
  params: Promise<{ slug: string }>
}

interface Invoice {
  id: string
  supplierId: string
  supplierName: string
  invoiceNumber: string | null
  invoiceDate: string
  dueDate: string | null
  status: 'draft' | 'posted' | 'cancelled'
  subtotal: number
  taxTotal: number
  total: number
}

const STATUS_META: Record<Invoice['status'], { label: string; className: string; icon: typeof CheckCircle2 }> = {
  draft:     { label: 'Taslak',         className: 'bg-yellow-100 text-yellow-700', icon: Circle },
  posted:    { label: 'Muhasebeleşti',  className: 'bg-green-100 text-success',     icon: CheckCircle2 },
  cancelled: { label: 'İptal',          className: 'bg-red-100 text-red-600',       icon: Ban },
}

export default function PurchaseInvoicesPage(props: PageProps) {
  const params = use(props.params)
  const { slug } = params
  const searchParams = useSearchParams()
  const supplierFilter = searchParams?.get('supplierId') ?? null
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-invoices', slug, statusFilter, supplierFilter],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      if (supplierFilter) qs.set('supplierId', supplierFilter)
      const q = qs.toString()
      return apiFetch<{ data: Invoice[] }>(
        `/api/v1/tenants/${slug}/purchase-invoices${q ? `?${q}` : ''}`,
      )
    },
  })

  const rows = data?.data ?? []
  const totals = rows.reduce(
    (acc, r) => {
      if (r.status === 'posted') acc.posted += r.total
      if (r.status === 'draft') acc.draft += r.total
      return acc
    },
    { posted: 0, draft: 0 },
  )

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Alış Faturaları</h1>
            <p className="text-xs text-salon-muted">Tedarikçi alımları + otomatik stok girişi + cari hesap</p>
          </div>
        </div>
        <Link href={`/tenant/${slug}/purchase-invoices/new`}>
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Yeni Fatura
          </Button>
        </Link>
      </div>

      {/* Özet */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-salon-muted">Muhasebeleşmiş Toplam</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(totals.posted)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-salon-muted">Taslak Toplam</p>
            <p className="text-lg font-bold text-yellow-700 mt-1">{formatCurrency(totals.draft)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtreler */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-salon-muted" />
        {(['all', 'draft', 'posted', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              statusFilter === s
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-salon-muted border-salon-border hover:text-gray-900',
            )}
          >
            {s === 'all' ? 'Tümü' : STATUS_META[s].label}
          </button>
        ))}
        {supplierFilter && (
          <Link
            href={`/tenant/${slug}/purchase-invoices`}
            className="text-xs text-primary hover:underline ml-2"
          >
            Tedarikçi filtresini temizle ×
          </Link>
        )}
      </div>

      {/* Liste */}
      <div className="bg-white rounded-lg border border-salon-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-salon-border bg-salon-bg">
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase">Tarih</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase">Tedarikçi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase hidden sm:table-cell">Fatura No</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-salon-muted uppercase">Toplam</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase">Durum</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-salon-border last:border-0">
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : rows.length === 0
                ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-sm text-salon-muted">
                        Henüz alış faturası yok. "Yeni Fatura" ile başlayın.
                      </td>
                    </tr>
                  )
                : rows.map((r) => {
                    const meta = STATUS_META[r.status]
                    const Icon = meta.icon
                    return (
                      <tr key={r.id} className="border-b border-salon-border last:border-0 hover:bg-salon-bg">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(r.invoiceDate)}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/tenant/${slug}/purchase-invoices/${r.id}`}
                            className="font-medium text-gray-900 hover:text-primary"
                          >
                            {r.supplierName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-salon-muted hidden sm:table-cell">{r.invoiceNumber ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(r.total)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', meta.className)}>
                            <Icon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
