'use client'

import { useId, useState } from 'react'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe, useTerm } from '@/lib/v2/session'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Switch } from '@/ui/choice'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { InputField } from '@/ui/field'
import { Sheet } from '@/ui/sheet'
import { useToast } from '@/ui/toast'
import { createService, removeService, updateService } from './api'
import { emptyService, toCreateBody, toFormValues, toUpdateBody, validateService, type ServiceErrors, type ServiceRow, type ServiceValues } from './logic'

// Hizmet formu (tasarim.md §8.1 `hizmet-formu`): ekle ve düzenle tek katman. Prim, verenler ve reçete alanları sunucuda henüz yok.
const capitalize = (text: string) => (text ? text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1) : text)

export function ServiceSheet({
  service,
  categories,
  onClose,
  onSaved,
}: {
  service: ServiceRow | null
  categories: readonly string[]
  onClose: () => void
  onSaved: () => void
}) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const t = useTerm()
  const word = t('service')
  const listId = useId()
  const [created, setCreated] = useState<ServiceRow | null>(null)
  // Oluşturma sonrası ikinci istek düşerse kayıt vardır: katman düzenleme kipine geçer, yeniden basış ikinci kayıt açmaz.
  const current = service ?? created
  const isEdit = current !== null
  const [values, setValues] = useState<ServiceValues>(() => (service ? toFormValues(service) : emptyService()))
  const [errors, setErrors] = useState<ServiceErrors>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const set = <K extends keyof ServiceValues>(key: K, value: ServiceValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function run(action: () => Promise<void>, doneMessage: string) {
    setBusy(true)
    setFailure(null)
    try {
      await action()
      toast.show({ message: doneMessage })
      onSaved()
    } catch (err) {
      setFailure((err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text())
    } finally {
      setBusy(false)
      setConfirmRemove(false)
    }
  }

  function save() {
    const found = validateService(values)
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    if (current) {
      const body = toUpdateBody(values, current)
      if (Object.keys(body).length === 0) {
        toast.show({ message: 'Değişiklik yapmadınız.' })
        return
      }
      void run(() => updateService(client, slug, current.id, body), `${capitalize(word)} kaydedildi.`)
    } else {
      void run(
        async () => {
          const body = toCreateBody(values)
          const made = await createService(client, slug, body)
          // Oluşturma ucu çevrimiçi görünürlüğü almaz: kapalı istenmişse ikinci istekle kapatılır.
          if (!values.isOnlineBookable) {
            try {
              await updateService(client, slug, made.id, { isOnlineBookable: false })
            } catch (err) {
              setCreated({
                id: made.id,
                name: String(body.name),
                category: typeof body.category === 'string' ? body.category : null,
                durationMinutes: Number(body.durationMinutes),
                price: Number(body.price),
                bufferMinutes: Number(body.bufferMinutes),
                isActive: true,
                isOnlineBookable: true,
              })
              throw err
            }
          }
        },
        `${capitalize(word)} eklendi.`,
      )
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title={isEdit ? `${capitalize(word)} düzenle` : `${capitalize(word)} ekle`}
      footer={
        <Button disabled={busy} loading={busy && !confirmRemove} loadingText="Kaydediliyor…" onClick={save}>
          {isEdit ? 'Değişiklikleri kaydet' : `${capitalize(word)} ekle`}
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <InputField
          label="Ad"
          maxLength={100}
          autoComplete="off"
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          error={errors.name}
        />
        <InputField
          label="Kategori"
          optional
          maxLength={50}
          autoComplete="off"
          list={listId}
          hint="Aynı kategorideki hizmetler listede bir arada görünür."
          value={values.category}
          onChange={(event) => set('category', event.target.value)}
          error={errors.category}
        />
        <datalist id={listId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Süre (dk)"
            inputMode="numeric"
            value={values.durationText}
            onChange={(event) => set('durationText', event.target.value)}
            error={errors.durationText}
          />
          <InputField
            label="Fiyat (₺)"
            inputMode="decimal"
            value={values.priceText}
            onChange={(event) => set('priceText', event.target.value)}
            error={errors.priceText}
          />
        </div>
        <InputField
          label="Ara süre (dk)"
          optional
          inputMode="numeric"
          hint="Hizmetten sonra ayrılan hazırlık süresi. Yoksa 0."
          value={values.bufferText}
          onChange={(event) => set('bufferText', event.target.value)}
          error={errors.bufferText}
        />
        <Switch
          label="Online randevuya açık"
          description="Kapalıysa yalnız salon çalışanları bu hizmete randevu açabilir."
          checked={values.isOnlineBookable}
          onCheckedChange={(checked) => set('isOnlineBookable', checked)}
        />
        {isEdit ? (
          <Switch
            label="Etkin"
            description="Kapalı hizmet randevu oluşturulurken seçilemez; geçmiş randevular etkilenmez."
            checked={values.isActive}
            onCheckedChange={(checked) => set('isActive', checked)}
          />
        ) : null}
        {isEdit && current?.isActive ? (
          <Button variant="danger" disabled={busy} onClick={() => setConfirmRemove(true)}>
            {capitalize(word)} kaldır
          </Button>
        ) : null}
      </div>
      {confirmRemove && current ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmRemove(false)
          }}
          title={`${capitalize(word)} kaldırılsın mı?`}
          description={`“${current.name}” listeden kalkar ve yeni randevuda seçilemez. Geçmiş randevular etkilenmez; sonra Etkin ayarıyla geri açabilirsiniz.`}
          actionLabel={`${capitalize(word)} kaldır`}
          loading={busy}
          loadingText="Kaldırılıyor…"
          onConfirm={() => void run(() => removeService(client, slug, current.id), `${capitalize(word)} kaldırıldı.`)}
        />
      ) : null}
    </Sheet>
  )
}
