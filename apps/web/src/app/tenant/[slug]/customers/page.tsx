'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, Plus, Phone, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { NewCustomerModal } from '@/components/customers/new-customer-modal'

interface Customer {
  id: string
  fullName: string
  phone: string
  email?: string
  totalVisits: number
  lastVisitDate?: string
  createdAt: string
}

const columnHelper = createColumnHelper<Customer>()

interface PageProps {
  params: { slug: string }
}

export default function CustomersPage({ params }: PageProps) {
  const router = useRouter()
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [modalOpen, setModalOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', params.slug],
    queryFn: () =>
      apiFetch<{ data: Customer[] }>(`/api/v1/tenants/${params.slug}/customers`),
  })

  const columns = useMemo(
    () => [
      columnHelper.accessor('fullName', {
        header: 'İsim',
        cell: (info) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-primary">
                {info.getValue().charAt(0)}
              </span>
            </div>
            <span className="font-medium text-gray-900">{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('phone', {
        header: 'Telefon',
        cell: (info) => (
          <a
            href={`tel:${info.getValue()}`}
            className="flex items-center gap-1.5 text-sm text-salon-muted hover:text-primary transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            {info.getValue()}
          </a>
        ),
      }),
      columnHelper.accessor('totalVisits', {
        header: 'Ziyaret',
        cell: (info) => (
          <span className="text-sm font-medium text-gray-700">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('lastVisitDate', {
        header: 'Son Ziyaret',
        cell: (info) =>
          info.getValue() ? (
            <span className="text-sm text-salon-muted">{formatDate(info.getValue()!)}</span>
          ) : (
            <span className="text-sm text-salon-muted">—</span>
          ),
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Müşteriler</h1>
        <Button size="sm" className="gap-2" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Yeni Müşteri
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-salon-muted" />
        <input
          type="text"
          placeholder="İsim veya telefon ile ara..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-full h-11 pl-9 pr-4 rounded-md border border-salon-border bg-white text-sm placeholder:text-salon-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-salon-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-salon-border bg-salon-bg">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-salon-muted uppercase tracking-wide cursor-pointer select-none"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <ChevronUp className="w-3 h-3" />}
                        {header.column.getIsSorted() === 'desc' && <ChevronDown className="w-3 h-3" />}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading
                ? [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-salon-border last:border-0">
                      {[...Array(4)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                : table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-salon-border last:border-0 hover:bg-salon-bg transition-colors cursor-pointer"
                      onClick={() => router.push(`/tenant/${params.slug}/customers/${row.original.id}`)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!isLoading && table.getRowModel().rows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-salon-muted">Müşteri bulunamadı</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-salon-border bg-salon-bg">
          <p className="text-xs text-salon-muted">
            {table.getFilteredRowModel().rows.length} müşteri gösteriliyor
          </p>
        </div>
      </div>

      <NewCustomerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        tenantSlug={params.slug}
      />
    </div>
  )
}
