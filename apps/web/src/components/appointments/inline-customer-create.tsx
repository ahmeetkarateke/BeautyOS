'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface Props {
  tenantSlug: string
  onCreated: (customerId: string) => void
}

export function InlineCustomerCreate({ tenantSlug, onCreated }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/api/v1/tenants/${tenantSlug}/customers`, {
        method: 'POST',
        body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim() }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['customers', tenantSlug] })
      toast(`${fullName} eklendi`)
      onCreated(data.id)
      setOpen(false)
      setFullName('')
      setPhone('')
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
      >
        <UserPlus size={12} />
        Müşteriyi tanımıyorum — hızlı ekle
      </button>
    )
  }

  return (
    <div className="mt-2 border border-salon-border rounded-lg p-3 space-y-2 bg-zinc-50 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">Yeni müşteri</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-salon-muted hover:text-gray-600 dark:hover:text-zinc-300"
        >
          <X size={14} />
        </button>
      </div>
      <input
        type="text"
        placeholder="Ad Soyad *"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="w-full border border-salon-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <input
        type="tel"
        placeholder="Telefon *"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full border border-salon-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button
        type="button"
        disabled={!fullName.trim() || !phone.trim() || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="w-full py-1.5 rounded-md text-xs font-medium bg-primary text-white disabled:opacity-50 transition-opacity"
      >
        {mutation.isPending ? 'Ekleniyor…' : 'Ekle ve Seç'}
      </button>
    </div>
  )
}
