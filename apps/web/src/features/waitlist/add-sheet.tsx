'use client'

import { useEffect, useState } from 'react'
import { searchCustomers, fetchServices } from '@/features/appointment-create/api'
import { fetchStaff } from '@/features/appointments/api'
import { istanbulDateStr } from '@/features/appointments/day-logic'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { InputField, SelectField, TextareaField } from '@/ui/field'
import { Sheet } from '@/ui/sheet'
import { useToast } from '@/ui/toast'
import { addToWaitlist } from './api'
import { createBody, validateAdd, type AddErrors, type AddValues } from './logic'

// Listeye ekle (tasarim.md `bekleme`): müşteri zorunlu; hizmet, uzman, tarih, saat aralığı ve not isteğe bağlı.
const SEARCH_MIN = 2

export function AddToWaitlistSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [today] = useState(() => istanbulDateStr(new Date()))
  const [values, setValues] = useState<AddValues>({ customerId: '', serviceId: '', staffId: '', date: '', timeRange: '', notes: '' })
  const [pickedName, setPickedName] = useState('')
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [errors, setErrors] = useState<AddErrors>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(id)
  }, [term])
  const searching = !values.customerId && debounced.length >= SEARCH_MIN
  const hits = useApiQuery(searching ? `wl-cust:${debounced}` : null, (c, signal) => searchCustomers(c, slug, debounced, signal))
  const services = useApiQuery('wl-services', (c, signal) => fetchServices(c, slug, signal))
  const staff = useApiQuery('wl-staff', (c, signal) => fetchStaff(c, slug, signal))

  const set = <K extends keyof AddValues>(key: K, value: AddValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function save() {
    if (busy) return
    const found = validateAdd(values, today)
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    setBusy(true)
    setFailure(null)
    try {
      await addToWaitlist(client, slug, createBody(values))
      toast.show({ message: 'Listeye eklendi.' })
      onDone()
    } catch (err) {
      setFailure((err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title="Listeye ekle"
      description="Uygun saat açılınca haber vermek için kişiyi bekleme listesine yazın."
      footer={
        <Button disabled={busy} loading={busy} loadingText="Ekleniyor…" onClick={() => void save()}>
          Listeye ekle
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        {values.customerId ? (
          <div className="flex items-center justify-between gap-3 rounded-card border border-border px-3 py-2">
            <span className="min-w-0 truncate font-medium">{pickedName}</span>
            <Button variant="text" size="sm" onClick={() => set('customerId', '')}>
              Değiştir
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <InputField
              label="Müşteri ara"
              type="search"
              maxLength={100}
              autoComplete="off"
              hint="Ad ya da telefonla arayın (en az 2 karakter)."
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              error={errors.customerId}
            />
            {searching && hits.error && !hits.data ? (
              <Banner tone="error" action={{ label: 'Yeniden dene', onClick: hits.refetch }}>
                Müşteri araması yapılamadı.
              </Banner>
            ) : null}
            {searching && hits.data && hits.data.length === 0 ? (
              <p className="text-sm text-text-muted">Eşleşen müşteri yok. Önce Müşteriler bölümünden ekleyin.</p>
            ) : null}
            {hits.data && searching ? (
              <ul aria-label="Müşteri sonuçları" className="m-0 grid list-none gap-1 p-0">
                {hits.data.map((hit) => (
                  <li key={hit.id}>
                    <Button
                      variant="secondary"
                      className="w-full justify-start"
                      onClick={() => {
                        set('customerId', hit.id)
                        setPickedName(hit.fullName)
                      }}
                    >
                      {hit.fullName}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        <SelectField label="Hizmet" optional value={values.serviceId} onChange={(event) => set('serviceId', event.target.value)}>
          <option value="">Fark etmez</option>
          {(services.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Uzman" optional value={values.staffId} onChange={(event) => set('staffId', event.target.value)}>
          <option value="">Fark etmez</option>
          {(staff.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <InputField
          label="Tercih edilen gün"
          optional
          type="date"
          min={today}
          value={values.date}
          onChange={(event) => set('date', event.target.value)}
          error={errors.date}
        />
        <InputField
          label="Saat aralığı"
          optional
          maxLength={60}
          hint="Örnek: Öğleden sonra"
          value={values.timeRange}
          onChange={(event) => set('timeRange', event.target.value)}
        />
        <TextareaField label="Not" optional maxLength={500} value={values.notes} onChange={(event) => set('notes', event.target.value)} />
      </div>
    </Sheet>
  )
}
