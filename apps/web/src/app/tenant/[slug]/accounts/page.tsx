'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, X, Landmark, Wallet, CreditCard, ChevronRight, Banknote, ArrowLeftRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

interface PageProps {
  params: { slug: string }
}

type AccountType = 'cash' | 'bank' | 'pos' | 'credit_card' | 'other'

interface Account {
  id: string
  type: AccountType
  name: string
  bankName: string | null
  accountHolder: string | null
  iban: string | null
  currency: string
  openingBalance: number
  isActive: boolean
  isDefault: boolean
  notes: string | null
  balance: number
}

const TYPE_META: Record<AccountType, { label: string; icon: typeof Landmark; className: string }> = {
  cash:        { label: 'Kasa',        icon: Wallet,     className: 'bg-amber-100 text-amber-700' },
  bank:        { label: 'Banka',       icon: Landmark,   className: 'bg-blue-100 text-blue-700' },
  pos:         { label: 'POS',         icon: CreditCard, className: 'bg-purple-100 text-purple-700' },
  credit_card: { label: 'Kredi Kartı', icon: CreditCard, className: 'bg-red-100 text-red-600' },
  other:       { label: 'Diğer',       icon: Banknote,   className: 'bg-gray-100 text-gray-700' },
}

export default function AccountsPage({ params }: PageProps) {
  const { slug } = params
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['accounts', slug],
    queryFn: () => apiFetch<{ data: Account[] }>(`/api/v1/tenants/${slug}/accounts?includeInactive=true`),
  })

  const accounts = data?.data ?? []
  const totalsByType = accounts.reduce<Record<string, number>>((acc, a) => {
    if (!a.isActive) return acc
    acc[a.type] = (acc[a.type] ?? 0) + a.balance
    return acc
  }, {})
  const grandTotal = accounts.filter((a) => a.isActive).reduce((s, a) => s + a.balance, 0)

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Banka & Kasa</h1>
            <p className="text-xs text-salon-muted">Banka hesapları, kasa ve POS bakiyeleri</p>
          </div>
        </div>
        <div className="flex gap-2">
          {accounts.filter((a) => a.isActive).length >= 2 && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTransferOpen((v) => !v)}>
              <ArrowLeftRight className="w-4 h-4" /> Virman
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => setAdding((v) => !v)}>
            <Plus className="w-4 h-4" /> Yeni Hesap
          </Button>
        </div>
      </div>

      {/* Toplam Bakiye Kartı */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-salon-muted">Toplam Likidite</p>
          <p className={cn('text-2xl font-bold mt-1', grandTotal < 0 ? 'text-red-600' : 'text-gray-900')}>
            {isLoading ? '—' : formatCurrency(grandTotal)}
          </p>
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-salon-border text-xs">
            {(Object.keys(TYPE_META) as AccountType[]).map((t) => {
              const v = totalsByType[t] ?? 0
              if (!v) return null
              const meta = TYPE_META[t]
              return (
                <div key={t} className="flex items-center gap-1.5">
                  <span className={cn('px-1.5 py-0.5 rounded text-[10px]', meta.className)}>{meta.label}</span>
                  <span className="text-gray-700 font-medium">{formatCurrency(v)}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {adding && <AccountForm slug={slug} onClose={() => setAdding(false)} />}
      {editing && <AccountForm slug={slug} account={editing} onClose={() => setEditing(null)} />}
      {transferOpen && <TransferForm slug={slug} accounts={accounts.filter((a) => a.isActive)} onClose={() => setTransferOpen(false)} />}

      {/* Hesap Listesi */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : !accounts.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Landmark className="w-10 h-10 mx-auto text-salon-muted opacity-40" />
            <p className="text-sm text-salon-muted mt-3">Henüz hesap yok</p>
            <p className="text-xs text-salon-muted mt-1">"Yeni Hesap" ile kasa veya banka hesabınızı ekleyin.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {accounts.map((a) => {
            const meta = TYPE_META[a.type]
            const Icon = meta.icon
            return (
              <Card key={a.id} className={cn('hover:shadow-card-hover transition-shadow', !a.isActive && 'opacity-50')}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <Link href={`/tenant/${slug}/accounts/${a.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center', meta.className)}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{a.name}</p>
                          {a.bankName && <p className="text-xs text-salon-muted truncate">{a.bankName}</p>}
                        </div>
                      </div>
                      <p className={cn('text-xl font-bold mt-3', a.balance < 0 ? 'text-red-600' : 'text-gray-900')}>
                        {formatCurrency(a.balance)}
                      </p>
                      {a.iban && (
                        <p className="text-[10px] text-salon-muted mt-1 font-mono truncate">{a.iban}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-2">
                        {a.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-100 text-primary">Varsayılan</span>
                        )}
                        {!a.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-salon-muted">Pasif</span>
                        )}
                      </div>
                    </Link>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => setEditing(a)}
                        className="p-1.5 rounded-md text-salon-muted hover:text-primary hover:bg-primary-100"
                        aria-label="Düzenle"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/tenant/${slug}/accounts/${a.id}`}
                        className="p-1.5 rounded-md text-salon-muted hover:text-primary hover:bg-primary-100"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Form: Yeni / Düzenle ──────────────────────────────────────────────────

const TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: 'cash',        label: 'Kasa' },
  { value: 'bank',        label: 'Banka Hesabı' },
  { value: 'pos',         label: 'POS' },
  { value: 'credit_card', label: 'Kredi Kartı' },
  { value: 'other',       label: 'Diğer' },
]

function AccountForm({
  slug, account, onClose,
}: {
  slug: string
  account?: Account
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!account
  const [type, setType] = useState<AccountType>(account?.type ?? 'cash')
  const [name, setName] = useState(account?.name ?? '')
  const [bankName, setBankName] = useState(account?.bankName ?? '')
  const [accountHolder, setAccountHolder] = useState(account?.accountHolder ?? '')
  const [iban, setIban] = useState(account?.iban ?? '')
  const [openingBalance, setOpeningBalance] = useState(String(account?.openingBalance ?? ''))
  const [isDefault, setIsDefault] = useState(account?.isDefault ?? false)
  const [notes, setNotes] = useState(account?.notes ?? '')

  const mutation = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({
        ...(isEdit ? {} : { type, openingBalance: Number(openingBalance) || 0 }),
        name: name.trim(),
        bankName: bankName.trim() || undefined,
        accountHolder: accountHolder.trim() || undefined,
        iban: iban.trim() || undefined,
        isDefault,
        notes: notes.trim() || undefined,
      })
      return isEdit
        ? apiFetch(`/api/v1/tenants/${slug}/accounts/${account!.id}`, { method: 'PATCH', body })
        : apiFetch(`/api/v1/tenants/${slug}/accounts`, { method: 'POST', body })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts', slug] })
      toast(isEdit ? 'Hesap güncellendi' : 'Hesap eklendi')
      onClose()
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (name.trim().length < 2) { toast('İsim en az 2 karakter olmalıdır', 'error'); return }
    mutation.mutate()
  }

  return (
    <Card className="border-2 border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{isEdit ? 'Hesabı Düzenle' : 'Yeni Hesap'}</CardTitle>
        <button type="button" onClick={onClose} className="text-salon-muted hover:text-gray-900">
          <X className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="acc-type">Hesap Türü</Label>
              <select
                id="acc-type"
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white"
              >
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">Hesap Adı</Label>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus
                   placeholder={type === 'cash' ? 'Ana Kasa' : type === 'bank' ? 'Garanti İşletme' : 'Hesap adı'} maxLength={100} />
          </div>
          {(type === 'bank' || type === 'pos' || type === 'credit_card') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="acc-bank">Banka</Label>
                  <Input id="acc-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="acc-holder">Hesap Sahibi</Label>
                  <Input id="acc-holder" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} maxLength={100} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-iban">IBAN</Label>
                <Input id="acc-iban" value={iban} onChange={(e) => setIban(e.target.value)} maxLength={50} placeholder="TR..." />
              </div>
            </>
          )}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="acc-opening">Açılış Bakiyesi (₺)</Label>
              <Input id="acc-opening" type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0,00" />
              <p className="text-xs text-salon-muted">Mevcut bakiyenizi girin. Açılış hareketi olarak kaydedilir.</p>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            <span>Bu türde varsayılan hesap</span>
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="acc-notes">Notlar</Label>
            <Textarea id="acc-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
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

// ─── Virman Formu ──────────────────────────────────────────────────────────

function TransferForm({
  slug, accounts, onClose,
}: {
  slug: string
  accounts: Account[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [description, setDescription] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tenants/${slug}/transactions/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          fromAccountId, toAccountId,
          amount: Number(amount),
          date: new Date(date).toISOString(),
          description: description.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts', slug] })
      toast('Virman tamamlandı')
      onClose()
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (fromAccountId === toAccountId) { toast('Farklı hesaplar seçin', 'error'); return }
    if (Number(amount) <= 0) { toast('Geçerli bir tutar girin', 'error'); return }
    mutation.mutate()
  }

  return (
    <Card className="border-2 border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4" /> Virman
        </CardTitle>
        <button type="button" onClick={onClose} className="text-salon-muted hover:text-gray-900">
          <X className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trf-from">Kaynak Hesap</Label>
              <select
                id="trf-from" value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white"
              >
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trf-to">Hedef Hesap</Label>
              <select
                id="trf-to" value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white"
              >
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trf-amount">Tutar (₺)</Label>
              <Input id="trf-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trf-date">Tarih</Label>
              <Input id="trf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trf-desc">Açıklama</Label>
            <Input id="trf-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Otomatik üretilebilir" maxLength={300} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">İptal</Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'İşleniyor...' : 'Virman Yap'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
