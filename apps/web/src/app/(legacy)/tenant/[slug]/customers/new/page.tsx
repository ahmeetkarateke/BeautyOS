'use client'

import { useState, type FormEvent, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'

interface PageProps {
  params: Promise<{ slug: string }>
}

interface CustomerInput {
  fullName: string
  phone: string
  email: string
  birthDate: string
}

const INITIAL: CustomerInput = { fullName: '', phone: '', email: '', birthDate: '' }

export default function NewCustomerPage(props: PageProps) {
  const params = use(props.params)
  const router = useRouter()
  const qc = useQueryClient()
  const [form, setForm] = useState<CustomerInput>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerInput, string>>>({})

  const mutation = useMutation({
    mutationFn: (data: CustomerInput) =>
      apiFetch<{ id: string }>(`/api/v1/tenants/${params.slug}/customers`, {
        method: 'POST',
        body: JSON.stringify({
          fullName: data.fullName,
          phone: data.phone,
          email: data.email || undefined,
          birthDate: data.birthDate || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers', params.slug] })
      toast('Müşteri eklendi')
      router.push(`/tenant/${params.slug}/customers`)
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

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-xl">
      <div className="flex items-center gap-3">
        <Link
          href={`/tenant/${params.slug}/customers`}
          className="p-2 rounded-md hover:bg-salon-bg transition-colors text-salon-muted hover:text-gray-900"
          aria-label="Geri"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Yeni Müşteri</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Müşteri Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Ad Soyad</Label>
              <Input
                id="fullName"
                name="fullName"
                placeholder="Ayşe Yılmaz"
                autoFocus
                error={errors.fullName}
                value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+90 555 000 00 00"
                error={errors.phone}
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-posta (isteğe bağlı)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ayse@email.com"
                error={errors.email}
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Doğum Tarihi (isteğe bağlı)</Label>
              <Input
                id="birthDate"
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
                onClick={() => router.push(`/tenant/${params.slug}/customers`)}
              >
                İptal
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="flex-1">
                {mutation.isPending ? 'Ekleniyor...' : 'Müşteri Ekle'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
