'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

  // Modal açılıp kapandığında form sıfırla
  useEffect(() => {
    if (!open) {
      setForm(INITIAL)
      setErrors({})
    }
  }, [open])

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

  function field<K extends keyof CustomerInput>(key: K) {
    return {
      name: key,
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Müşteri</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Ad Soyad</Label>
            <Input id="fullName" placeholder="Ayşe Yılmaz" error={errors.fullName} {...field('fullName')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" type="tel" placeholder="+90 555 000 00 00" error={errors.phone} {...field('phone')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-posta (isteğe bağlı)</Label>
            <Input id="email" type="email" placeholder="ayse@email.com" error={errors.email} {...field('email')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">Doğum Tarihi (isteğe bağlı)</Label>
            <Input id="birthDate" type="date" {...field('birthDate')} />
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
      </DialogContent>
    </Dialog>
  )
}
