'use client'

import { useEffect, useMemo, useState } from 'react'
import { fetchStaff } from '@/features/appointments/api'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Chip, ChipRow } from '@/ui/chip'
import { DayStrip, buildDayRange } from '@/ui/day-strip'
import { InputField, PhoneField, TextareaField } from '@/ui/field'
import { formatDate, formatMoney } from '@/ui/format'
import { SelectionCard } from '@/ui/selection-card'
import { Sheet } from '@/ui/sheet'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { ErrorState } from '@/ui/states'
import { useToast } from '@/ui/toast'
import { createAppointment, createCustomer, fetchServices, fetchSlots, searchCustomers } from './api'
import { isDraftComplete, newCustomerIssue, slotStartAt, staffForService, type CustomerChoice } from './create-logic'

// Randevu oluştur katmanı (tasarim.md §5 akış): müşteri -> hizmet -> personel -> tarih (14 gün) -> saat -> not.
// Saat dolarsa (SLOT_TAKEN) hata saat bölümünde görünür, saatler yenilenir, seçim temizlenir; katman açık kalır.
const DAYS = 14
const SEARCH_MIN = 2
const SLOT_ERRORS = new Set(['SLOT_TAKEN', 'SLOT_CONFLICT', 'APPOINTMENT_CONFLICT'])

export type CreateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Salon günü (YYYY-MM-DD). */
  today: string
  onCreated: () => void
  /** Takvimden gelen ön seçimler (boş dilime dokunma). */
  initial?: { staffId?: string; time?: string; date?: string }
}

export function CreateAppointmentSheet(props: CreateSheetProps) {
  // Kapanınca durum sıfırlansın diye form her açılışta yeniden kurulur.
  return props.open ? <CreateForm {...props} /> : null
}

function CreateForm({ onOpenChange, today, onCreated, initial }: CreateSheetProps) {
  const client = useApiClient()
  const me = useMe()
  const slug = me.tenant.slug
  const toast = useToast()
  const isExpert = me.role === 'staff'
  const ownId = isExpert ? (me.staffId ?? '') : ''

  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [customer, setCustomer] = useState<CustomerChoice | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [serviceId, setServiceId] = useState('')
  const [staffChoice, setStaffChoice] = useState('')
  const [date, setDate] = useState(initial?.date ?? today)
  // null: kullanıcı dokunmadı (ön seçim geçerli); '': temizlendi.
  const [slotChoice, setSlotChoice] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [slotError, setSlotError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  // Aynı telefon başka kartta kayıtlı: kullanıcı kayıtlı müşteriyi seçer ya da bilerek yeni kart ister (ADR-0038).
  const [duplicatePhone, setDuplicatePhone] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(timer)
  }, [term])

  const searching = customer === null && debounced.length >= SEARCH_MIN
  const hits = useApiQuery(searching ? `cust:${debounced}` : null, (c, signal) => searchCustomers(c, slug, debounced, signal))
  const services = useApiQuery('services', (c, signal) => fetchServices(c, slug, signal))
  const staffQuery = useApiQuery(isExpert ? null : 'staff', (c, signal) => fetchStaff(c, slug, signal))

  const staffOptions = useMemo(() => (serviceId ? staffForService(staffQuery.data ?? [], serviceId) : []), [staffQuery.data, serviceId])
  const staffId = isExpert
    ? ownId
    : staffOptions.some((s) => s.id === staffChoice)
      ? staffChoice
      : staffOptions.some((s) => s.id === initial?.staffId)
        ? (initial?.staffId ?? '')
        : ''

  const slots = useApiQuery(serviceId && staffId ? `slots:${serviceId}:${staffId}:${date}` : null, (c, signal) => fetchSlots(c, slug, serviceId, staffId, date, signal))
  const freeSlots = useMemo(() => (slots.data ?? []).filter((s) => s.available), [slots.data])
  const slotId =
    slotChoice !== null
      ? freeSlots.some((s) => s.id === slotChoice)
        ? slotChoice
        : ''
      : (freeSlots.find((s) => s.label === initial?.time)?.id ?? '')

  const days = useMemo(() => buildDayRange(today, DAYS).map((d) => ({ date: d })), [today])
  const service = services.data?.find((s) => s.id === serviceId)
  const slot = freeSlots.find((s) => s.id === slotId)
  const complete = isDraftComplete({ customer, serviceId, staffId, slotId })

  function pickCustomer(next: CustomerChoice | null) {
    setCustomer(next)
    setCreatedId(null)
    setFormError(null)
    setDuplicatePhone(false)
  }

  function editNewCustomer(patch: { name?: string; phoneDigits?: string }) {
    if (customer?.kind !== 'new') return
    setCustomer({ ...customer, ...patch })
    setCreatedId(null)
  }

  async function submit(allowSharedPhone = false) {
    if (!customer || !complete) return
    setBusy(true)
    setFormError(null)
    setSlotError(null)
    setDuplicatePhone(false)
    try {
      let customerId: string
      if (customer.kind === 'existing') customerId = customer.id
      else {
        // Saat dolup yeniden denenirse müşteri ikinci kez oluşturulmaz.
        customerId = createdId ?? (await createCustomer(client, slug, customer.name, customer.phoneDigits, allowSharedPhone)).id
        setCreatedId(customerId)
      }
      await createAppointment(client, slug, { customerId, serviceId, staffId, startAt: slotStartAt(slotId), ...(notes.trim() ? { notes: notes.trim() } : {}) })
      toast.show({ message: 'Randevu oluşturuldu.' })
      onCreated()
      onOpenChange(false)
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError({ status: 0, code: 'NETWORK' })
      if (SLOT_ERRORS.has(apiError.code)) {
        setSlotError(apiError.text())
        setSlotChoice('')
        slots.refetch()
      } else {
        setFormError(apiError.text())
        if (apiError.code === 'DUPLICATE_PHONE') setDuplicatePhone(true)
      }
    } finally {
      setBusy(false)
    }
  }

  const summary = [
    customer ? (customer.kind === 'new' ? customer.name.trim() : customer.name) : null,
    service?.name ?? null,
    slot ? `${formatDate(new Date(`${date}T12:00:00Z`), 'short')} ${slot.label}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      size="lg"
      title="Randevu oluştur"
      footer={
        <>
          {summary ? <p className="mr-auto min-w-0 flex-1 basis-full truncate self-center text-sm text-text-secondary sm:basis-auto">{summary}</p> : null}
          <Button disabled={!complete || busy} loading={busy} loadingText="Kaydediliyor…" onClick={() => void submit(false)}>
            Randevu oluştur
          </Button>
        </>
      }
    >
      <div className="grid gap-5 pb-2">
        <CustomerSection
          term={term}
          onTerm={setTerm}
          customer={customer}
          onPick={pickCustomer}
          onEditNew={editNewCustomer}
          hits={hits}
          searching={searching}
          settled={debounced === term.trim()}
        />

        <Section title="Hizmet">
          {services.error && !services.data ? (
            <ErrorState subject="Hizmetler" onRetry={services.refetch} retrying={services.loading} className="px-0" />
          ) : !services.data ? (
            <ListSkeleton />
          ) : services.data.length === 0 ? (
            <p className="text-sm text-text-muted">Henüz hizmet tanımlı değil. Önce Hizmetler ekranından ekleyin.</p>
          ) : (
            <div role="group" aria-label="Hizmet" className="grid gap-2 sm:grid-cols-2">
              {services.data.map((s) => (
                <SelectionCard
                  key={s.id}
                  title={s.name}
                  description={`${s.durationMinutes} dk`}
                  price={isExpert || s.price == null ? undefined : formatMoney(s.price)}
                  selected={s.id === serviceId}
                  onSelect={() => {
                    setServiceId(s.id)
                    setSlotChoice(null)
                    setSlotError(null)
                  }}
                />
              ))}
            </div>
          )}
        </Section>

        {!isExpert && serviceId ? (
          <Section title="Personel">
            {staffQuery.error && !staffQuery.data ? (
              <ErrorState subject="Personel listesi" onRetry={staffQuery.refetch} retrying={staffQuery.loading} className="px-0" />
            ) : !staffQuery.data ? (
              <ListSkeleton />
            ) : staffOptions.length === 0 ? (
              <p className="text-sm text-text-muted">Bu hizmeti veren personel yok. Personel ekranından hizmet atayın.</p>
            ) : (
              <ChipRow aria-label="Personel">
                {staffOptions.map((p) => (
                  <Chip key={p.id} pressed={p.id === staffId} onToggle={() => { setStaffChoice(p.id); setSlotChoice(null); setSlotError(null) }}>
                    {p.name}
                  </Chip>
                ))}
              </ChipRow>
            )}
          </Section>
        ) : null}

        {serviceId && staffId ? (
          <Section title="Tarih ve saat">
            <DayStrip days={days} selected={date} onSelect={(d) => { setDate(d); setSlotChoice(null); setSlotError(null) }} />
            {slotError ? <Banner tone="error">{slotError}</Banner> : null}
            {slots.error && !slots.data ? (
              <ErrorState subject="Boş saatler" onRetry={slots.refetch} retrying={slots.loading} className="px-0" />
            ) : !slots.data ? (
              <ListSkeleton />
            ) : freeSlots.length === 0 ? (
              <p className="text-sm text-text-muted">Bu gün boş saat yok. Başka bir gün seçin.</p>
            ) : (
              <div role="group" aria-label="Boş saatler" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {freeSlots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={s.id === slotId}
                    onClick={() => { setSlotChoice(s.id); setSlotError(null) }}
                    className={
                      s.id === slotId
                        ? 'min-h-11 cursor-pointer rounded-control border border-primary bg-primary text-sm font-medium text-on-primary tabular-nums'
                        : 'min-h-11 cursor-pointer rounded-control border border-border bg-surface text-sm font-medium text-text tabular-nums hover:border-text-muted'
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </Section>
        ) : null}

        <TextareaField label="Not" optional rows={2} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
        {formError ? <Banner tone="error">{formError}</Banner> : null}
        {duplicatePhone && customer?.kind === 'new' ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setTerm(`0${customer.phoneDigits}`)
                pickCustomer(null)
              }}
            >
              Kayıtlı müşteriyi seç
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void submit(true)}>
              Yine de yeni müşteri ekle
            </Button>
          </div>
        ) : null}
      </div>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {children}
    </section>
  )
}

function ListSkeleton() {
  return (
    <SkeletonGroup className="grid gap-2">
      <Skeleton />
      <Skeleton className="w-2/3" />
    </SkeletonGroup>
  )
}

function CustomerSection({
  term,
  onTerm,
  customer,
  onPick,
  onEditNew,
  hits,
  searching,
  settled,
}: {
  term: string
  onTerm: (value: string) => void
  customer: CustomerChoice | null
  onPick: (customer: CustomerChoice | null) => void
  onEditNew: (patch: { name?: string; phoneDigits?: string }) => void
  hits: ReturnType<typeof useApiQuery<Awaited<ReturnType<typeof searchCustomers>>>>
  searching: boolean
  settled: boolean
}) {
  if (customer?.kind === 'existing') {
    return (
      <Section title="Müşteri">
        <div className="flex items-center justify-between gap-3 rounded-card border border-border px-3 py-2">
          <span className="min-w-0 truncate font-medium">{customer.name}</span>
          <Button variant="text" size="sm" onClick={() => onPick(null)}>
            Değiştir
          </Button>
        </div>
      </Section>
    )
  }

  if (customer?.kind === 'new') {
    const issue = newCustomerIssue(customer.name, customer.phoneDigits)
    return (
      <Section title="Yeni müşteri">
        <InputField label="Ad soyad" value={customer.name} onChange={(event) => onEditNew({ name: event.target.value })} error={issue === 'name' ? 'Ad en az 2 harf olmalı.' : undefined} />
        <PhoneField label="Telefon" value={customer.phoneDigits} onValueChange={(digits) => onEditNew({ phoneDigits: digits })} error={issue === 'phone' && customer.phoneDigits.length > 0 ? 'Telefon 5 ile başlayan 10 hane olmalı.' : undefined} />
        <div>
          <Button variant="text" size="sm" onClick={() => onPick(null)}>
            Kayıtlı müşteri ara
          </Button>
        </div>
      </Section>
    )
  }

  const loaded = searching && settled && hits.data !== undefined
  return (
    <Section title="Müşteri">
      <InputField label="Müşteri ara" type="search" role="searchbox" hint="Ad ya da telefonla arayın (en az 2 karakter)." value={term} onChange={(event) => onTerm(event.target.value)} />
      {searching && hits.error && !hits.data ? (
        <Banner tone="error" action={{ label: 'Yeniden dene', onClick: hits.refetch }}>
          Müşteri araması yapılamadı.
        </Banner>
      ) : null}
      {loaded ? (
        <div className="grid gap-1.5">
          {hits.data!.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => onPick({ kind: 'existing', id: hit.id, name: hit.fullName })}
              className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-card border border-border bg-surface px-3 text-left hover:border-text-muted"
            >
              <span className="truncate font-medium">{hit.fullName}</span>
              {hit.phone ? <span className="flex-none text-sm text-text-muted tabular-nums">{hit.phone}</span> : null}
            </button>
          ))}
          <Button variant="secondary" onClick={() => onPick({ kind: 'new', name: term.trim(), phoneDigits: '' })}>
            {term.trim()} adıyla yeni müşteri ekle
          </Button>
        </div>
      ) : null}
    </Section>
  )
}
