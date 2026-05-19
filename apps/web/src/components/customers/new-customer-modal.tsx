'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
}

interface CustomerInput {
  fullName: string
  phone: string
  email: string
  birthDate: string
}

const INITIAL: CustomerInput = { fullName: '', phone: '', email: '', birthDate: '' }

export function NewCustomerModal({ open, onOpenChange, tenantSlug }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CustomerInput>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerInput, string>>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Modal kapandığında form sıfırla
  useEffect(() => {
    if (!open) {
      setForm(INITIAL)
      setErrors({})
    }
  }, [open])

  // ESC ile kapat
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const mutation = useMutation({
    mutationFn: (data: CustomerInput) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/customers`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: data.fullName,
          phone: data.phone,
          email: data.email || undefined,
          birthDate: data.birthDate || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers', tenantSlug] })
      toast('Müşteri eklendi')
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast(err.message, 'error')
    },
  })

  function validate(): boolean {
    const next: typeof errors = {}
    if (form.fullName.trim().length < 2) next.fullName = 'İsim en az 2 karakter olmalıdır'
    if (form.phone.trim().length < 10) next.phone = 'Geçerli bir telefon numarası giriniz'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Geçerli bir e-posta giriniz'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return
    mutation.mutate(form)
  }

  function update<K extends keyof CustomerInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  if (!mounted || !open) return null

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-customer-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Content */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-salon-border p-6">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5">
          <h2 id="new-customer-title" className="text-lg font-semibold text-gray-900">Yeni Müşteri</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nc-fullName">Ad Soyad</Label>
            <Input
              id="nc-fullName"
              name="fullName"
              placeholder="Ayşe Yılmaz"
              error={errors.fullName}
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nc-phone">Telefon</Label>
            <Input
              id="nc-phone"
              name="phone"
              type="tel"
              placeholder="+90 555 000 00 00"
              error={errors.phone}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nc-email">E-posta (isteğe bağlı)</Label>
            <Input
              id="nc-email"
              name="email"
              type="email"
              placeholder="ayse@email.com"
              error={errors.email}
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nc-birthDate">Doğum Tarihi (isteğe bağlı)</Label>
            <Input
              id="nc-birthDate"
              name="birthDate"
              type="date"
              value={form.birthDate}
              onChange={(e) => update('birthDate', e.target.value)}
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-500">{(mutation.error as Error).message}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Ekleniyor...' : 'Müşteri Ekle'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
