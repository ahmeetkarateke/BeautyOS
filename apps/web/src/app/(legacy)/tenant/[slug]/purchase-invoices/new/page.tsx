'use client'

import { useState, useMemo, type FormEvent, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Save, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/components/ui/toaster'

interface PageProps {
  params: Promise<{ slug: string }>
}

interface Supplier { id: string; name: string; phone: string | null }
interface InventoryItem { id: string; name: string; unit: string; unitCost: number }

interface LineItem {
  key: string
  inventoryId: string | null
  name: string
  quantity: number
  unitPrice: number
  taxRate: number
  discount: number
}

function newLine(): LineItem {
  return { key: Math.random().toString(36).slice(2), inventoryId: null, name: '', quantity: 1, unitPrice: 0, taxRate: 20, discount: 0 }
}

function lineTotal(line: LineItem): { afterDiscount: number; tax: number; total: number } {
  const gross = line.quantity * line.unitPrice
  const afterDiscount = Math.max(0, gross - line.discount)
  const tax = (afterDiscount * line.taxRate) / 100
  return { afterDiscount, tax, total: afterDiscount + tax }
}

export default function NewPurchaseInvoicePage(props: PageProps) {
  const params = use(props.params)
  const { slug } = params
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [supplierId, setSupplierId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([newLine()])

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', slug, 'active'],
    queryFn: () => apiFetch<{ data: Supplier[] }>(`/api/v1/tenants/${slug}/suppliers`),
  })

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory', slug],
    queryFn: () => apiFetch<{ data: InventoryItem[] }>(`/api/v1/tenants/${slug}/inventory`),
  })

  const inventoryMap = useMemo(() => {
    const m = new Map<string, InventoryItem>()
    for (const it of inventoryData?.data ?? []) m.set(it.id, it)
    return m
  }, [inventoryData])

  const totals = useMemo(() => {
    let subtotal = 0, taxTotal = 0, total = 0, discountTotal = 0
    for (const item of items) {
      const t = lineTotal(item)
      subtotal += t.afterDiscount
      taxTotal += t.tax
      total += t.total
      discountTotal += item.discount
    }
    return { subtotal, taxTotal, total, discountTotal }
  }, [items])

  const mutation = useMutation({
    mutationFn: (post: boolean) =>
      apiFetch<{ id: string }>(`/api/v1/tenants/${slug}/purchase-invoices`, {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          invoiceNumber: invoiceNumber.trim() || undefined,
          invoiceDate: new Date(invoiceDate).toISOString(),
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          notes: notes.trim() || undefined,
          items: items.map((it) => ({
            inventoryId: it.inventoryId,
            name: it.name,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            taxRate: it.taxRate,
            discount: it.discount,
          })),
          post,
        }),
      }),
    onSuccess: (res, post) => {
      toast(post ? 'Fatura kaydedildi ve muhasebeleşti' : 'Taslak kaydedildi')
      router.push(`/tenant/${slug}/purchase-invoices/${res.id}`)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  function updateLine(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((p, i) => i === idx ? { ...p, ...patch } : p))
  }

  function removeLine(idx: number) {
    setItems((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))
  }

  function pickInventory(idx: number, inventoryId: string) {
    if (!inventoryId) {
      updateLine(idx, { inventoryId: null })
      return
    }
    const inv = inventoryMap.get(inventoryId)
    if (!inv) return
    updateLine(idx, {
      inventoryId,
      name: inv.name,
      unitPrice: inv.unitCost > 0 ? inv.unitCost : 0,
    })
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>, post: boolean) {
    e.preventDefault()
    if (!supplierId) { toast('Tedarikçi seçin', 'error'); return }
    if (items.length === 0) { toast('En az bir kalem ekleyin', 'error'); return }
    for (const it of items) {
      if (!it.name.trim()) { toast('Tüm kalemlerin adı dolu olmalı', 'error'); return }
      if (it.quantity <= 0 || it.unitPrice < 0) { toast('Geçersiz adet/fiyat', 'error'); return }
    }
    mutation.mutate(post)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href={`/tenant/${slug}/purchase-invoices`} className="p-2 rounded-md hover:bg-salon-bg text-salon-muted hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Yeni Alış Faturası</h1>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Fatura Bilgileri</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="pi-sup">Tedarikçi *</Label>
              <select
                id="pi-sup"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full border border-salon-border rounded-lg px-3 py-2 text-sm bg-white"
                required
              >
                <option value="">— Seçin —</option>
                {(suppliersData?.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {(suppliersData?.data ?? []).length === 0 && (
                <p className="text-xs text-salon-muted">
                  Önce <Link href={`/tenant/${slug}/suppliers`} className="text-primary hover:underline">tedarikçi ekleyin</Link>.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pi-no">Fatura No</Label>
              <Input id="pi-no" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="A-2026-001" maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pi-date">Fatura Tarihi *</Label>
              <Input id="pi-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pi-due">Vade</Label>
              <Input id="pi-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Kalemler */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Fatura Kalemleri</CardTitle>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setItems((p) => [...p, newLine()])}>
              <Plus className="w-4 h-4" /> Kalem Ekle
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-salon-border bg-salon-bg text-xs text-salon-muted uppercase">
                    <th className="px-3 py-2 text-left font-semibold">Stok Kalemi (opsiyonel)</th>
                    <th className="px-3 py-2 text-left font-semibold">Açıklama *</th>
                    <th className="px-3 py-2 text-right font-semibold w-20">Adet</th>
                    <th className="px-3 py-2 text-right font-semibold w-28">Birim Fiyat</th>
                    <th className="px-3 py-2 text-right font-semibold w-24">İndirim</th>
                    <th className="px-3 py-2 text-right font-semibold w-20">KDV %</th>
                    <th className="px-3 py-2 text-right font-semibold w-28">Satır Toplam</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const t = lineTotal(item)
                    return (
                      <tr key={item.key} className="border-b border-salon-border last:border-0">
                        <td className="px-3 py-2">
                          <select
                            value={item.inventoryId ?? ''}
                            onChange={(e) => pickInventory(idx, e.target.value)}
                            className="w-full border border-salon-border rounded-md px-2 py-1.5 text-xs bg-white"
                          >
                            <option value="">— Bağlı değil —</option>
                            {(inventoryData?.data ?? []).map((inv) => (
                              <option key={inv.id} value={inv.id}>{inv.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={item.name}
                            onChange={(e) => updateLine(idx, { name: e.target.value })}
                            placeholder="Boya, krem vb."
                            className="h-8 text-xs"
                            maxLength={200}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min="1" step="1"
                            value={item.quantity}
                            onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                            className="h-8 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min="0" step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })}
                            className="h-8 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min="0" step="0.01"
                            value={item.discount}
                            onChange={(e) => updateLine(idx, { discount: Number(e.target.value) })}
                            className="h-8 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min="0" max="100" step="0.01"
                            value={item.taxRate}
                            onChange={(e) => updateLine(idx, { taxRate: Number(e.target.value) })}
                            className="h-8 text-xs text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                          {formatCurrency(t.total)}
                        </td>
                        <td className="px-3 py-2">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              className="text-salon-muted hover:text-red-600"
                              aria-label="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Toplamlar */}
            <div className="border-t border-salon-border p-4 bg-salon-bg">
              <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between text-salon-muted">
                  <span>Ara Toplam (KDV hariç)</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-salon-muted">
                  <span>İndirim</span>
                  <span>{formatCurrency(totals.discountTotal)}</span>
                </div>
                <div className="flex justify-between text-salon-muted">
                  <span>KDV</span>
                  <span>{formatCurrency(totals.taxTotal)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-salon-border text-base font-bold text-gray-900">
                  <span>Genel Toplam</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="space-y-1.5">
              <Label htmlFor="pi-notes">Notlar</Label>
              <Textarea id="pi-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 gap-2"
            disabled={mutation.isPending}
            onClick={(e) => handleSubmit(e as never, false)}
          >
            <Save className="w-4 h-4" />
            Taslak Kaydet
          </Button>
          <Button
            type="button"
            className="flex-1 gap-2"
            disabled={mutation.isPending}
            onClick={(e) => handleSubmit(e as never, true)}
          >
            <Send className="w-4 h-4" />
            {mutation.isPending ? 'İşleniyor...' : 'Kaydet & Muhasebeleştir'}
          </Button>
        </div>
        <p className="text-xs text-salon-muted">
          <strong>Muhasebeleştirme:</strong> Bağlı stok kalemleri otomatik stoğa girilir,
          tedarikçi cari hesabına borç olarak işlenir. Daha sonra iptal edilebilir.
        </p>
      </form>
    </div>
  )
}
