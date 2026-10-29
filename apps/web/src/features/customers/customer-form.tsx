'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { istanbulDateStr } from '@/features/appointments/day-logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { RequirePermission, useMe, useTerm } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button, buttonClassName } from '@/ui/button'
import { Card } from '@/ui/card'
import { focusFirstInvalid, InputField, PhoneField, TextareaField } from '@/ui/field'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { createCustomerRecord, fetchCustomerDetail, updateCustomerRecord } from './api'
import {
  emptyValues,
  NAME_MAX,
  NOTES_MAX,
  toCreatePayload,
  toFormValues,
  toUpdatePayload,
  validateCustomer,
  type CustomerErrors,
  type CustomerValues,
  type ServerCustomer,
} from './form-logic'

// Müşteri formu (tasarim.md §8.1 `musteri-yeni`, `musteri-formu`): yeni kayıt ve düzenleme tek bileşen.
// Aynı telefon başka kartta kayıtlıysa (409 DUPLICATE_PHONE) kullanıcıya iki yol sunulur; "Yine de ekle" bilinçli onaydır (ADR-0038).
const capitalize = (text: string) => (text ? text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1) : text)

export function NewCustomerScreen() {
  const t = useTerm()
  return (
    <RequirePermission permission="customer.write">
      <FormShell title={`Yeni ${t('client')}`}>
        <CustomerForm original={null} />
      </FormShell>
    </RequirePermission>
  )
}

export function EditCustomerScreen({ customerId }: { customerId: string }) {
  const slug = useMe().tenant.slug
  const t = useTerm()
  const query = useApiQuery(`customer:${customerId}`, (c, signal) => fetchCustomerDetail(c, slug, customerId, signal))
  let body
  if (query.error && !query.data) {
    body =
      query.error.status === 404 ? (
        <Card>
          <EmptyState title={`${capitalize(t('client'))} bulunamadı.`} description="Kayıt silinmiş ya da bu bağlantı hatalı olabilir." centered />
        </Card>
      ) : (
        <Card>
          <ErrorState
            subject={`${capitalize(t('client'))} bilgileri`}
            onRetry={query.refetch}
            retrying={query.loading}
            lastLoadedAt={query.loadedAt}
            className="px-0"
          />
        </Card>
      )
  } else if (!query.data) {
    body = (
      <SkeletonGroup>
        <Card>
          <div className="grid gap-4">
            <Skeleton className="w-1/2" />
            <Skeleton className="w-2/3" />
            <Skeleton className="w-1/3" />
          </div>
        </Card>
      </SkeletonGroup>
    )
  } else body = <CustomerForm key={query.data.id} original={query.data} />
  return (
    <RequirePermission permission="customer.write">
      <FormShell title={`${capitalize(t('client'))} bilgilerini düzenle`}>{body}</FormShell>
    </RequirePermission>
  )
}

function FormShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid max-w-xl grid-cols-[minmax(0,1fr)] gap-4">
      <h1 className="text-xl leading-7 font-semibold">{capitalize(title)}</h1>
      {children}
    </div>
  )
}

function CustomerForm({ original }: { original: ServerCustomer | null }) {
  const client = useApiClient()
  const router = useRouter()
  const toast = useToast()
  const t = useTerm()
  const slug = useMe().tenant.slug
  const list = `/panel/${encodeURIComponent(slug)}/musteriler`
  const isEdit = original !== null
  const [today] = useState(() => istanbulDateStr(new Date()))
  const [values, setValues] = useState<CustomerValues>(() => (original ? toFormValues(original) : emptyValues()))
  const [errors, setErrors] = useState<CustomerErrors>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const clientWord = t('client')

  const set = (key: keyof CustomerValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    if (key === 'phoneDigits') setDuplicate(false)
  }

  async function save(allowShared: boolean) {
    const found = validateCustomer(values, { today, phoneRequired: !isEdit || Boolean(original?.phone) })
    setErrors(found)
    if (Object.values(found).some(Boolean)) {
      // Hata alanı DOM'a işlendikten sonra odaklanır.
      requestAnimationFrame(() => formRef.current && focusFirstInvalid(formRef.current))
      return
    }
    setBusy(true)
    setFailure(null)
    try {
      if (original) {
        const payload = toUpdatePayload(values, original, allowShared)
        if (Object.keys(payload).length === 0) {
          toast.show({ message: 'Değişiklik yapmadınız.' })
          return
        }
        await updateCustomerRecord(client, slug, original.id, payload)
        toast.show({ message: `${capitalize(clientWord)} bilgileri kaydedildi.` })
      } else {
        await createCustomerRecord(client, slug, toCreatePayload(values, allowShared))
        toast.show({ message: `${capitalize(clientWord)} eklendi.` })
      }
      router.push(list)
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })
      if (apiError.code === 'DUPLICATE_PHONE') setDuplicate(true)
      else setFailure(apiError.text())
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!busy) void save(false)
  }

  return (
    <Card>
      <form ref={formRef} noValidate onSubmit={onSubmit} className="grid gap-4">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <InputField
          label="Ad soyad"
          autoComplete="off"
          maxLength={NAME_MAX}
          value={values.fullName}
          onChange={(event) => set('fullName', event.target.value)}
          error={errors.fullName}
          aria-required="true"
        />
        <PhoneField
          label="Telefon"
          value={values.phoneDigits}
          onValueChange={(digits) => set('phoneDigits', digits)}
          error={errors.phoneDigits}
          aria-required="true"
        />
        {duplicate ? (
          <Banner tone="warning">
            Bu telefonla kayıtlı bir {clientWord} zaten var. Aile bireyleri aynı numarayı kullanıyorsa yine de ekleyebilirsiniz; aksi hâlde mevcut kaydı bulun.
          </Banner>
        ) : null}
        <InputField
          label="E-posta"
          optional
          type="email"
          inputMode="email"
          autoComplete="off"
          value={values.email}
          onChange={(event) => set('email', event.target.value)}
          error={errors.email}
        />
        <InputField
          label="Doğum tarihi"
          optional
          type="date"
          max={today}
          value={values.birthDate}
          onChange={(event) => set('birthDate', event.target.value)}
          error={errors.birthDate}
        />
        {isEdit ? (
          <TextareaField
            label="Tercih notu"
            optional
            maxLength={NOTES_MAX}
            hint="Sağlık bilgisi yazmayın; sağlık notları kart içinde ayrı tutulur."
            value={values.preferenceNotes}
            onChange={(event) => set('preferenceNotes', event.target.value)}
            error={errors.preferenceNotes}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {duplicate ? (
            <>
              <Button type="button" loading={busy} loadingText="Ekleniyor…" onClick={() => void save(true)}>
                Yine de ekle
              </Button>
              <Link href={list} className={buttonClassName({ variant: 'secondary' })}>
                Kayıtlı {clientWord} ara
              </Link>
            </>
          ) : (
            <Button type="submit" loading={busy} loadingText="Kaydediliyor…">
              {isEdit ? 'Değişiklikleri kaydet' : `${capitalize(clientWord)} ekle`}
            </Button>
          )}
          <Link href={list} className={buttonClassName({ variant: 'text' })}>
            Vazgeç
          </Link>
        </div>
      </form>
    </Card>
  )
}
