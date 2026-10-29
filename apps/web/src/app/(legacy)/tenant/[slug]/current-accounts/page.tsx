'use client'

import { useState, useMemo, use } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Search, BookOpen, ChevronRight, TrendingUp, TrendingDown, Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

interface PageProps {
  params: Promise<{ slug: string }>
}

type PartyType = 'customer' | 'supplier'

interface AccountRow {
  id: string
  name: string
  phone: string | null
  debit: number
  credit: number
  balance: number
  lastEntryDate: string | null
}

export default function CurrentAccountsPage(props: PageProps) {
  const params = use(props.params)
  const [activeType, setActiveType] = useState<PartyType>('customer')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)

  const { data, isLoading } = useQuery({
    queryKey: ['current-accounts', params.slug, activeType, debouncedSearch],
    queryFn: () => {
      const qs = new URLSearchParams({ type: activeType })
      if (debouncedSearch) qs.set('search', debouncedSearch)
      return apiFetch<{ data: AccountRow[]; total: number }>(
        `/api/v1/tenants/${params.slug}/current-accounts?${qs.toString()}`,
      )
    },
  })

  const rows = data?.data ?? []

  const totals = useMemo(() => {
    let debit = 0, credit = 0, due = 0
    for (const r of rows) {
      debit += r.debit
      credit += r.credit
      if (activeType === 'customer' && r.balance > 0) due += r.balance     // müşteri bize borçlu
      if (activeType === 'supplier' && r.balance > 0) due += r.balance    // tedarikçiye borçluyuz (cari borç)
    }
    return { debit, credit, due }
  }, [rows, activeType])

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cari Hesap</h1>
          <p className="text-xs text-salon-muted">Müşteri ve tedarikçi açık hesap takibi</p>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-1 border-b border-salon-border">
        {(['customer', 'supplier'] as PartyType[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeType === t
                ? 'border-primary text-primary'
                : 'border-transparent text-salon-muted hover:text-gray-900',
            )}
          >
            {t === 'customer' ? 'Müşteriler' : 'Tedarikçiler'}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-salon-muted">Toplam Borç</p>
                <p className="text-lg font-bold text-gray-900">
                  {isLoading ? '—' : formatCurrency(totals.debit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-salon-muted">Toplam Alacak</p>
                <p className="text-lg font-bold text-gray-900">
                  {isLoading ? '—' : formatCurrency(totals.credit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-salon-muted">
                  {activeType === 'customer' ? 'Açık Bakiye (Tahsil Edilecek)' : 'Açık Bakiye (Ödenecek)'}
                </p>
                <p className="text-lg font-bold text-primary">
                  {isLoading ? '—' : formatCurrency(totals.due)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Arama */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-salon-muted pointer-events-none" />
        <input
          type="search"
          placeholder={activeType === 'customer' ? 'Müşteri ara...' : 'Tedarikçi ara...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 pl-9 pr-4 rounded-md border border-salon-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Liste */}
      <div className="bg-white rounded-lg border border-salon-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-salon-border bg-salon-bg">
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase tracking-wide">
                  {activeType === 'customer' ? 'Müşteri' : 'Tedarikçi'}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-salon-muted uppercase tracking-wide">Borç</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-salon-muted uppercase tracking-wide">Alacak</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-salon-muted uppercase tracking-wide">Bakiye</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase tracking-wide hidden sm:table-cell">Son Hareket</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-salon-border last:border-0">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : rows.length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-salon-muted">
                        {search ? 'Sonuç bulunamadı' : (activeType === 'customer'
                          ? 'Henüz müşteri yok'
                          : 'Henüz tedarikçi yok')}
                      </td>
                    </tr>
                  )
                : rows.map((r) => (
                    <tr key={r.id} className="border-b border-salon-border last:border-0 hover:bg-salon-bg transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/tenant/${params.slug}/current-accounts/${activeType}/${r.id}`}
                          className="font-medium text-gray-900 hover:text-primary block"
                        >
                          {r.name}
                          {r.phone && (
                            <span className="block text-xs text-salon-muted mt-0.5 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {r.phone}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {r.debit > 0 ? formatCurrency(r.debit) : <span className="text-salon-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {r.credit > 0 ? formatCurrency(r.credit) : <span className="text-salon-muted">—</span>}
                      </td>
                      <td className={cn(
                        'px-4 py-3 text-right font-semibold',
                        r.balance > 0 ? 'text-red-600' : r.balance < 0 ? 'text-success' : 'text-salon-muted',
                      )}>
                        {r.balance === 0 ? '—' : formatCurrency(Math.abs(r.balance))}
                        {r.balance !== 0 && (
                          <span className="text-[10px] font-normal block">
                            {r.balance > 0 ? (activeType === 'customer' ? 'borç' : 'borcumuz') : (activeType === 'customer' ? 'alacak' : 'alacağımız')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-salon-muted hidden sm:table-cell">
                        {r.lastEntryDate ? formatDate(r.lastEntryDate) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/tenant/${params.slug}/current-accounts/${activeType}/${r.id}`}
                          className="text-salon-muted hover:text-primary"
                          aria-label="Detay"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
