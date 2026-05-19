'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Trash2, TrendingUp, TrendingDown, ArrowLeftRight,
  Landmark, Wallet, CreditCard, Banknote,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { apiFetch } from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

interface PageProps {
  params: { slug: string; id: string }
}

type AccountType = 'cash' | 'bank' | 'pos' | 'credit_card' | 'other'
type TxType = 'income' | 'expense' | 'transfer_in' | 'transfer_out' | 'opening_balance' | 'adjustment'

interface Account {
  id: string
  type: AccountType
  name: string
  bankName: string | null
  accountHolder: string | null
  iban: string | null
  currency: string
  isActive: boolean
  isDefault: boolean
  notes: string | null
  balance: number
}

interface Transaction {
  id: string
  type: TxType
  amount: number
  date: string
  description: string
  category: string | null
  customer: { id: string; fullName: string } | null
  supplier: { id: string; name: string } | null
  counterpartyAccount: { id: string; name: string; type: string } | null
  referenceType: string | null
  referenceId: string | null
}

interface DetailResponse {
  account: Account
  transactions: Transaction[]
}

const TYPE_META: Record<AccountType, { label: string; icon: typeof Landmark; className: string }> = {
  cash:        { label: 'Kasa',        icon: Wallet,     className: 'bg-amber-100 text-amber-700' },
  bank:        { label: 'Banka',       icon: Landmark,   className: 'bg-blue-100 text-blue-700' },
  pos:         { label: 'POS',         icon: CreditCard, className: 'bg-purple-100 text-purple-700' },
  credit_card: { label: 'Kredi Kartı', icon: CreditCard, className: 'bg-red-100 text-red-600' },
  other:       { label: 'Diğer',       icon: Banknote,   className: 'bg-gray-100 text-gray-700' },
}

const TX_TYPE_META: Record<TxType, { label: string; className: string; sign: '+' | '-' | '' }> = {
  income:          { label: 'Gelir',           className: 'text-success',     sign: '+' },
  expense:         { label: 'Gider',           className: 'text-red-600',     sign: '-' },
  transfer_in:     { label: 'Virman Geldi',    className: 'text-blue-600',    sign: '+' },
  transfer_out:    { label: 'Virman Çıktı',    className: 'text-blue-600',    sign: '-' },
  opening_balance: { label: 'Açılış Bakiyesi', className: 'text-salon-muted', sign: '+' },
  adjustment:      { label: 'Düzeltme',        className: 'text-salon-muted', sign: '+' },
}

export default function AccountDetailPage({ params }: PageProps) {
  const { slug, id } = params
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'income' | 'expense'>('income')
  const [toDelete, setToDelete] = useState<Transaction | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['account-detail', slug, id],
    queryFn: () => apiFetch<DetailResponse>(`/api/v1/tenants/${slug}/accounts/${id}`),
  })

  const deleteMutation = useMutation({
    mutationFn: (txId: string) => apiFetch(`/api/v1/tenants/${slug}/transactions/${txId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account-detail', slug, id] })
      qc.invalidateQueries({ queryKey: ['accounts', slug] })
      qc.invalidateQueries({ queryKey: ['current-accounts', slug] })
      toast('Hareket silindi')
      setToDelete(null)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!data) return null

  const a = data.account
  const meta = TYPE_META[a.type]
  const Icon = meta.icon

  const totals = data.transactions.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount
      if (t.type === 'expense') acc.expense += t.amount
      return acc
    },
    { income: 0, expense: 0 },
  )

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href={`/tenant/${slug}/accounts`} className="p-2 rounded-md hover:bg-salon-bg text-salon-muted hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className={cn('w-10 h-10 rounded-lg flex items-center justify-center', meta.className)}>
          <Icon className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">{a.name}</h1>
          <p className="text-xs text-salon-muted">
            {meta.label}
            {a.bankName && <> · {a.bankName}</>}
            {a.iban && <> · {a.iban}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-success border-green-200" onClick={() => { setFormType('income'); setShowForm(true) }}>
            <TrendingUp className="w-4 h-4" /> Gelir
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200" onClick={() => { setFormType('expense'); setShowForm(true) }}>
            <TrendingDown className="w-4 h-4" /> Gider
          </Button>
        </div>
      </div>

      {/* Özet */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-salon-muted">Bakiye</p>
            <p className={cn('text-xl font-bold mt-1', a.balance < 0 ? 'text-red-600' : 'text-gray-900')}>
              {formatCurrency(a.balance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-salon-muted">Bu Liste Toplam Gelir</p>
            <p className="text-xl font-bold text-success mt-1">{formatCurrency(totals.income)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-salon-muted">Bu Liste Toplam Gider</p>
            <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totals.expense)}</p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <NewTxForm
          slug={slug}
          accountId={id}
          type={formType}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Hareketler */}
      <Card>
        <CardHeader><CardTitle className="text-base">Hesap Hareketleri</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-salon-border bg-salon-bg text-xs text-salon-muted uppercase">
                  <th className="px-4 py-2.5 text-left font-semibold">Tarih</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Açıklama</th>
                  <th className="px-4 py-2.5 text-left font-semibold hidden sm:table-cell">Tür</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Tutar</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-salon-muted">
                      Henüz hareket yok.
                    </td>
                  </tr>
                ) : data.transactions.map((t) => {
                  const tmeta = TX_TYPE_META[t.type]
                  return (
                    <tr key={t.id} className="border-b border-salon-border last:border-0 hover:bg-salon-bg">
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{formatDate(t.date)}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-gray-900">{t.description}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {t.customer && (
                            <Link href={`/tenant/${slug}/current-accounts/customer/${t.customer.id}`} className="text-[10px] text-primary hover:underline">
                              Müşteri: {t.customer.fullName}
                            </Link>
                          )}
                          {t.supplier && (
                            <Link href={`/tenant/${slug}/current-accounts/supplier/${t.supplier.id}`} className="text-[10px] text-primary hover:underline">
                              Tedarikçi: {t.supplier.name}
                            </Link>
                          )}
                          {t.counterpartyAccount && (
                            <Link href={`/tenant/${slug}/accounts/${t.counterpartyAccount.id}`} className="text-[10px] text-blue-600 hover:underline">
                              <ArrowLeftRight className="w-3 h-3 inline mr-0.5" />
                              {t.counterpartyAccount.name}
                            </Link>
                          )}
                          {t.category && (
                            <span className="text-[10px] text-salon-muted">· {t.category}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span className={cn('text-[11px] font-medium', tmeta.className)}>{tmeta.label}</span>
                      </td>
                      <td className={cn('px-4 py-2.5 text-right font-semibold whitespace-nowrap', tmeta.className)}>
                        {tmeta.sign}{formatCurrency(t.amount)}
                      </td>
                      <td className="px-4 py-2.5">
                        {!t.referenceType || t.referenceType === 'manual' ? (
                          <button
                            onClick={() => setToDelete(t)}
                            className="text-salon-muted hover:text-red-600"
                            aria-label="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) setToDelete(null) }}
        title="Hareketi sil"
        description="Bu hareket silinecek; virman ise karşı tarafı da silinir."
        confirmLabel="Sil"
        loading={deleteMutation.isPending}
        onConfirm={() => { if (toDelete) deleteMutation.mutate(toDelete.id) }}
      />
    </div>
  )
}

// ─── Yeni Gelir/Gider Formu ────────────────────────────────────────────────

interface PartySearchResult { id: string; name: string }

function NewTxForm({
  slug, accountId, type, onClose,
}: {
  slug: string
  accountId: string
  type: 'income' | 'expense'
  onClose: () => void
}) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [partyType, setPartyType] = useState<'none' | 'customer' | 'supplier'>('none')
  const [partyId, setPartyId] = useState('')
  const [linkToCA, setLinkToCA] = useState(true)
  const [partySearch, setPartySearch] = useState('')

  // Cari listesi (müşteri veya tedarikçi)
  const { data: caData } = useQuery({
    queryKey: ['current-accounts', slug, partyType, partySearch],
    queryFn: () => {
      if (partyType === 'none') return Promise.resolve({ data: [] })
      const qs = new URLSearchParams({ type: partyType })
      if (partySearch) qs.set('search', partySearch)
      return apiFetch<{ data: Array<{ id: string; name: string; balance: number }> }>(
        `/api/v1/tenants/${slug}/current-accounts?${qs.toString()}`,
      )
    },
    enabled: partyType !== 'none',
  })

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tenants/${slug}/transactions`, {
        method: 'POST',
        body: JSON.stringify({
          accountId,
          type,
          amount: Number(amount),
          date: new Date(date).toISOString(),
          description: description.trim() || (type === 'income' ? 'Gelir' : 'Gider'),
          category: category.trim() || undefined,
          customerId: partyType === 'customer' && partyId ? partyId : undefined,
          supplierId: partyType === 'supplier' && partyId ? partyId : undefined,
          linkToCurrentAccount: partyType !== 'none' && !!partyId && linkToCA,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account-detail', slug, accountId] })
      qc.invalidateQueries({ queryKey: ['accounts', slug] })
      qc.invalidateQueries({ queryKey: ['current-accounts', slug] })
      toast(type === 'income' ? 'Gelir kaydedildi' : 'Gider kaydedildi')
      onClose()
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) { toast('Geçerli tutar girin', 'error'); return }
    mutation.mutate()
  }

  const isIncome = type === 'income'

  return (
    <Card className={cn('border-2', isIncome ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50')}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          {isIncome ? <TrendingUp className="w-4 h-4 text-success" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
          {isIncome ? 'Yeni Gelir' : 'Yeni Gider'}
        </CardTitle>
        <button type="button" onClick={onClose} className="text-salon-muted hover:text-gray-900">
          ×
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Tutar (₺) *</Label>
              <Input id="tx-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Tarih</Label>
              <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-desc">Açıklama</Label>
            <Input id="tx-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kira, fatura, satış, vb." maxLength={300} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-cat">Kategori (opsiyonel)</Label>
            <Input id="tx-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kira, Elektrik, Ürün satışı" maxLength={50} />
          </div>

          <div className="space-y-1.5 pt-2 border-t border-salon-border">
            <Label>Cari Hesap Bağlantısı (opsiyonel)</Label>
            <div className="flex gap-2">
              {(['none', 'customer', 'supplier'] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => { setPartyType(pt); setPartyId(''); setPartySearch('') }}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors',
                    partyType === pt
                      ? 'border-primary bg-primary-100 text-primary'
                      : 'border-salon-border bg-white text-salon-muted hover:text-gray-900',
                  )}
                >
                  {pt === 'none' ? 'Bağlama' : pt === 'customer' ? 'Müşteri Tahsilatı' : 'Tedarikçi Ödemesi'}
                </button>
              ))}
            </div>
            {partyType !== 'none' && (
              <>
                <Input
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                  placeholder={partyType === 'customer' ? 'Müşteri ara...' : 'Tedarikçi ara...'}
                />
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Seçin —</option>
                  {(caData?.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.balance !== 0 && `(${p.balance > 0 ? 'borç' : 'alacak'}: ${Math.abs(p.balance).toFixed(2)}₺)`}
                    </option>
                  ))}
                </select>
                {partyId && (
                  <label className="flex items-center gap-2 text-xs text-salon-muted">
                    <input type="checkbox" checked={linkToCA} onChange={(e) => setLinkToCA(e.target.checked)} />
                    <span>Cari hesaba {partyType === 'customer' ? 'tahsilat' : 'ödeme'} kaydı oluştur (açık hesabı kapatır)</span>
                  </label>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">İptal</Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
