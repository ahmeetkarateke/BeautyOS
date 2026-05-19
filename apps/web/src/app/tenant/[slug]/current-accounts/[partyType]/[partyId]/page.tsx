'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Phone, BookOpen } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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
  params: { slug: string; partyType: 'customer' | 'supplier'; partyId: string }
}

type RefType = 'manual' | 'opening_balance' | 'appointment' | 'invoice' | 'purchase_invoice' | 'payment' | 'refund' | 'adjustment'

interface Entry {
  id: string
  date: string
  debit: number
  credit: number
  description: string
  referenceType: RefType
  referenceId: string | null
  balance: number
}

interface ExtractResponse {
  party: { id: string; type: 'customer' | 'supplier'; name: string; phone: string | null }
  entries: Entry[]
  summary: { totalDebit: number; totalCredit: number; balance: number }
}

const REF_LABELS: Record<RefType, string> = {
  manual: 'Manuel',
  opening_balance: 'Açılış Bakiyesi',
  appointment: 'Randevu',
  invoice: 'Fatura',
  purchase_invoice: 'Alış Faturası',
  payment: 'Tahsilat / Ödeme',
  refund: 'İade',
  adjustment: 'Düzeltme',
}

export default function CurrentAccountExtractPage({ params }: PageProps) {
  const { slug, partyType, partyId } = params
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [toDelete, setToDelete] = useState<Entry | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['current-account-extract', slug, partyType, partyId],
    queryFn: () =>
      apiFetch<ExtractResponse>(`/api/v1/tenants/${slug}/current-accounts/${partyType}/${partyId}/entries`),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/tenants/${slug}/current-accounts/entries/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-account-extract', slug, partyType, partyId] })
      qc.invalidateQueries({ queryKey: ['current-accounts', slug] })
      toast('Kayıt silindi')
      setToDelete(null)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const balance = data?.summary.balance ?? 0
  const owedLabel = partyType === 'customer'
    ? (balance > 0 ? 'Bizden tahsil edilecek' : balance < 0 ? 'Müşteriye iade' : 'Hesap kapalı')
    : (balance > 0 ? 'Tedarikçiye ödenecek' : balance < 0 ? 'Tedarikçiden alacaklıyız' : 'Hesap kapalı')

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/tenant/${slug}/current-accounts`}
          className="p-2 rounded-md hover:bg-salon-bg text-salon-muted hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        {isLoading ? <Skeleton className="h-7 w-48" /> : (
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">{data?.party.name}</h1>
            <p className="text-xs text-salon-muted flex items-center gap-2">
              {partyType === 'customer' ? 'Müşteri' : 'Tedarikçi'}
              {data?.party.phone && (
                <span className="inline-flex items-center gap-1">
                  · <Phone className="w-3 h-3" /> {data.party.phone}
                </span>
              )}
            </p>
          </div>
        )}
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4" /> Yeni Hareket
        </Button>
      </div>

      {/* Bakiye özeti */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-salon-muted">Toplam Borç</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {isLoading ? '—' : formatCurrency(data?.summary.totalDebit ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-salon-muted">Toplam Alacak</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {isLoading ? '—' : formatCurrency(data?.summary.totalCredit ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-salon-muted">Bakiye</p>
            <p className={cn(
              'text-lg font-bold mt-1',
              balance > 0 ? 'text-red-600' : balance < 0 ? 'text-success' : 'text-salon-muted',
            )}>
              {isLoading ? '—' : balance === 0 ? formatCurrency(0) : formatCurrency(Math.abs(balance))}
            </p>
            <p className="text-[10px] text-salon-muted mt-0.5">{owedLabel}</p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <NewEntryForm
          slug={slug}
          partyType={partyType}
          partyId={partyId}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Ekstre */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Hesap Ekstresi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-salon-border bg-salon-bg">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-salon-muted uppercase">Tarih</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-salon-muted uppercase">Açıklama</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-salon-muted uppercase">Borç</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-salon-muted uppercase">Alacak</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-salon-muted uppercase">Bakiye</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? [...Array(4)].map((_, i) => (
                      <tr key={i} className="border-b border-salon-border last:border-0">
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-4 py-2.5"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : (data?.entries ?? []).length === 0
                  ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-salon-muted">
                          Bu hesapta henüz hareket yok. "Yeni Hareket" ile açılış bakiyesi veya tahsilat ekleyebilirsiniz.
                        </td>
                      </tr>
                    )
                  : data!.entries.map((e) => (
                      <tr key={e.id} className="border-b border-salon-border last:border-0 hover:bg-salon-bg">
                        <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="px-4 py-2.5 text-gray-900">
                          {e.description}
                          <span className="block text-[10px] text-salon-muted mt-0.5">{REF_LABELS[e.referenceType]}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {e.debit > 0 ? formatCurrency(e.debit) : <span className="text-salon-muted">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">
                          {e.credit > 0 ? formatCurrency(e.credit) : <span className="text-salon-muted">—</span>}
                        </td>
                        <td className={cn(
                          'px-4 py-2.5 text-right font-medium',
                          e.balance > 0 ? 'text-red-600' : e.balance < 0 ? 'text-success' : 'text-salon-muted',
                        )}>
                          {formatCurrency(Math.abs(e.balance))}
                        </td>
                        <td className="px-4 py-2.5">
                          {(['manual', 'opening_balance', 'adjustment'] as RefType[]).includes(e.referenceType) && (
                            <button
                              onClick={() => setToDelete(e)}
                              className="text-salon-muted hover:text-red-600"
                              aria-label="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) setToDelete(null) }}
        title="Hareketi sil"
        description="Bu kayıt kalıcı olarak silinecek ve bakiye yeniden hesaplanacak."
        confirmLabel="Sil"
        loading={deleteMutation.isPending}
        onConfirm={() => { if (toDelete) deleteMutation.mutate(toDelete.id) }}
      />
    </div>
  )
}

// ─── Yeni hareket formu (inline) ────────────────────────────────────────────

type Direction = 'debit' | 'credit'
type FormRefType = 'manual' | 'opening_balance' | 'payment' | 'adjustment'

function NewEntryForm({
  slug, partyType, partyId, onClose,
}: {
  slug: string
  partyType: 'customer' | 'supplier'
  partyId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  // Default işlem 'payment' (tahsilat/ödeme) → açık hesabı kapatır → credit
  const [direction, setDirection] = useState<Direction>('credit')
  const [refType, setRefType] = useState<FormRefType>('payment')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [accountId, setAccountId] = useState('')

  const { data: accountsData } = useQuery({
    queryKey: ['accounts', slug, 'active-only'],
    queryFn: () =>
      apiFetch<{ data: Array<{ id: string; name: string; type: string; balance: number }> }>(
        `/api/v1/tenants/${slug}/accounts`,
      ),
  })

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tenants/${slug}/current-accounts/entries`, {
        method: 'POST',
        body: JSON.stringify({
          partyType,
          partyId,
          date: new Date(date).toISOString(),
          debit: direction === 'debit' ? Number(amount) : 0,
          credit: direction === 'credit' ? Number(amount) : 0,
          description: description || (
            refType === 'opening_balance' ? 'Açılış bakiyesi'
            : refType === 'payment' ? (direction === 'credit' ? (partyType === 'customer' ? 'Tahsilat' : 'Ödeme') : 'Manuel kayıt')
            : refType === 'adjustment' ? 'Düzeltme'
            : 'Manuel kayıt'
          ),
          referenceType: refType,
          accountId: refType === 'payment' && direction === 'credit' && accountId ? accountId : undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-account-extract', slug, partyType, partyId] })
      qc.invalidateQueries({ queryKey: ['current-accounts', slug] })
      qc.invalidateQueries({ queryKey: ['accounts', slug] })
      qc.invalidateQueries({ queryKey: ['account-detail', slug] })
      toast('Hareket kaydedildi')
      onClose()
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) {
      toast('Geçerli bir tutar girin', 'error')
      return
    }
    mutation.mutate()
  }

  // Hızlı yön ön-seçimi: yeni konvansiyon — debit=açık hesap artışı, credit=kapanış
  function updateRefType(rt: FormRefType) {
    setRefType(rt)
    if (rt === 'payment') {
      // Tahsilat veya ödeme → açık hesabı kapatır → alacak
      setDirection('credit')
    } else if (rt === 'opening_balance') {
      // Geçmişten gelen borç → açık hesap → borç
      setDirection('debit')
    }
  }

  return (
    <Card className="border-2 border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Yeni Hareket</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry-date">Tarih</Label>
              <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-type">İşlem Türü</Label>
              <select
                id="entry-type"
                value={refType}
                onChange={(e) => updateRefType(e.target.value as FormRefType)}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="payment">{partyType === 'customer' ? 'Tahsilat' : 'Ödeme'}</option>
                <option value="opening_balance">Açılış Bakiyesi</option>
                <option value="adjustment">Düzeltme</option>
                <option value="manual">Manuel Kayıt</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Yön</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('debit')}
                className={cn(
                  'flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                  direction === 'debit'
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-salon-border bg-white text-salon-muted hover:text-gray-900',
                )}
              >
                Borç (+ {partyType === 'customer' ? 'Müşteri borçlandı' : 'Bize borç olduk'})
              </button>
              <button
                type="button"
                onClick={() => setDirection('credit')}
                className={cn(
                  'flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                  direction === 'credit'
                    ? 'border-green-300 bg-green-50 text-success'
                    : 'border-salon-border bg-white text-salon-muted hover:text-gray-900',
                )}
              >
                Alacak (− {partyType === 'customer' ? 'Müşteri ödedi' : 'Tedarikçiye ödedik'})
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entry-amount">Tutar (₺)</Label>
            <Input
              id="entry-amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
          </div>

          {refType === 'payment' && direction === 'credit' && (accountsData?.data ?? []).length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="entry-account">
                {partyType === 'customer' ? 'Tahsil edilen hesap (opsiyonel)' : 'Ödeme yapılan hesap (opsiyonel)'}
              </Label>
              <select
                id="entry-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">— Hesaba yansıtma —</option>
                {(accountsData?.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.balance.toFixed(2)}₺)</option>
                ))}
              </select>
              <p className="text-[10px] text-salon-muted">
                Hesap seçerseniz {partyType === 'customer' ? 'gelir' : 'gider'} olarak da kaydedilir.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="entry-desc">Açıklama (opsiyonel)</Label>
            <Textarea
              id="entry-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Boş bırakılırsa otomatik doldurulur"
              maxLength={300}
            />
          </div>

          <div className="flex gap-2 pt-1">
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
