'use client'

import { useMemo, useState } from 'react'
import { ApiError } from '@/lib/v2/api-client'
import { useApiClient } from '@/lib/v2/api-context'
import { useMe } from '@/lib/v2/session'
import { useApiQuery } from '@/lib/v2/use-api-query'
import { Banner } from '@/ui/banner'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Switch } from '@/ui/choice'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { InputField, SelectField, TextareaField } from '@/ui/field'
import { formatMoney } from '@/ui/format'
import { Sheet } from '@/ui/sheet'
import { Skeleton, SkeletonGroup } from '@/ui/skeleton'
import { EmptyState, ErrorState, Forbidden } from '@/ui/states'
import { SummaryStrip } from '@/ui/summary-strip'
import { useToast } from '@/ui/toast'
import { createAccount, fetchAccounts, removeAccount, transferBetween, updateAccount } from './api'
import {
  ACCOUNT_TYPES,
  accountBody,
  accountTypeLabel,
  emptyAccount,
  sortAccounts,
  totalBalance,
  transferBody,
  validateAccount,
  validateTransfer,
  type AccountRow,
  type AccountValues,
  type TransferValues,
} from './logic'

// Hesaplar ve virman (tasarim.md §8.1 Yönetim): kasa, banka, POS, kredi kartı hesapları; iki hesap arası virman. Yalnız sahip ve müdür.
const message = (err: unknown) => (err instanceof ApiError ? err : new ApiError({ status: 0, code: 'NETWORK' })).text()
const has = (permissions: readonly string[], key: string) => permissions.includes(key)

export function AccountsScreen() {
  const me = useMe()
  if (!has(me.permissions, 'finance.account.read')) return <Forbidden />
  return <AccountsBody canWrite={has(me.permissions, 'finance.account.write')} />
}

function AccountsBody({ canWrite }: { canWrite: boolean }) {
  const slug = useMe().tenant.slug
  const query = useApiQuery('accounts', (c, signal) => fetchAccounts(c, slug, signal))
  const [editing, setEditing] = useState<AccountRow | 'new' | null>(null)
  const [transferring, setTransferring] = useState(false)
  const accounts = useMemo(() => sortAccounts(query.data ?? []), [query.data])

  let body
  if (query.error && !query.data) {
    body = (
      <Card>
        <ErrorState subject="Hesaplar" onRetry={query.refetch} retrying={query.loading} lastLoadedAt={query.loadedAt} className="px-0" />
      </Card>
    )
  } else if (!query.data) {
    body = (
      <SkeletonGroup>
        <Card>
          <div className="grid gap-4">
            <Skeleton className="w-1/2" />
            <Skeleton className="w-2/3" />
          </div>
        </Card>
      </SkeletonGroup>
    )
  } else if (accounts.length === 0) {
    body = (
      <Card>
        <EmptyState
          title="Henüz hesap yok."
          description="Kasa, banka ve POS hesaplarınızı ekleyerek paranızın nerede durduğunu izleyin."
          action={canWrite ? { label: 'Hesap ekle', onClick: () => setEditing('new') } : undefined}
          centered
        />
      </Card>
    )
  } else {
    body = (
      <div className="grid gap-4">
        <SummaryStrip
          items={[
            { label: 'Toplam bakiye', value: formatMoney(totalBalance(accounts)) },
            { label: 'Etkin hesap', value: String(accounts.filter((a) => a.isActive).length) },
          ]}
        />
        <Card>
          <ul aria-label="Hesaplar" className="m-0 grid list-none gap-0 p-0">
            {accounts.map((account) => (
              <li key={account.id} className="border-b border-border-subtle last:border-b-0">
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => setEditing(account)}
                    className="flex min-h-(--size-row) w-full cursor-pointer items-center gap-3 rounded-control px-1 py-3 text-left hover:bg-surface-subtle"
                  >
                    <AccountLine account={account} />
                  </button>
                ) : (
                  <div className="flex min-h-(--size-row) items-center gap-3 px-1 py-3">
                    <AccountLine account={account} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl leading-7 font-semibold">Hesaplar</h1>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={accounts.filter((a) => a.isActive).length < 2} onClick={() => setTransferring(true)}>
              Virman yap
            </Button>
            <Button onClick={() => setEditing('new')}>Hesap ekle</Button>
          </div>
        ) : null}
      </div>
      {body}
      {editing ? (
        <AccountSheet
          key={editing === 'new' ? 'new' : editing.id}
          account={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            query.refetch()
          }}
        />
      ) : null}
      {transferring ? (
        <TransferSheet
          accounts={accounts}
          onClose={() => setTransferring(false)}
          onDone={() => {
            setTransferring(false)
            query.refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function AccountLine({ account }: { account: AccountRow }) {
  return (
    <>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-medium">{account.name}</span>
        <span className="text-sm text-text-muted">
          {[accountTypeLabel(account.type), account.isDefault ? 'Varsayılan' : '', account.isActive ? '' : 'Pasif'].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="flex-none font-semibold tabular-nums">{formatMoney(account.balance)}</span>
    </>
  )
}

function toValues(account: AccountRow): AccountValues {
  return {
    type: account.type,
    name: account.name,
    bankName: account.bankName ?? '',
    iban: account.iban ?? '',
    openingText: '',
    isDefault: account.isDefault,
    notes: account.notes ?? '',
  }
}

function AccountSheet({ account, onClose, onSaved }: { account: AccountRow | null; onClose: () => void; onSaved: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const [values, setValues] = useState<AccountValues>(() => (account ? toValues(account) : emptyAccount()))
  const [active, setActive] = useState(account?.isActive ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const set = <K extends keyof AccountValues>(key: K, value: AccountValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setFailure(null)
    try {
      toast.show({ message: await action() })
      onSaved()
    } catch (err) {
      setFailure(message(err))
    } finally {
      setBusy(false)
      setConfirmRemove(false)
    }
  }

  function save() {
    // Düzenlemede açılış bakiyesi alanı yoktur; ad ve diğer alanlar doğrulanır.
    const found = validateAccount(account ? { ...values, openingText: '' } : values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    if (!account) {
      void run(async () => {
        await createAccount(client, slug, accountBody(values))
        return 'Hesap eklendi.'
      })
      return
    }
    const patch: Record<string, unknown> = {}
    if (values.name.trim() !== account.name) patch.name = values.name.trim()
    if (values.bankName.trim() !== (account.bankName ?? '')) patch.bankName = values.bankName.trim() || null
    if (values.iban.replace(/\s+/g, '') !== (account.iban ?? '')) patch.iban = values.iban.replace(/\s+/g, '').toLocaleUpperCase('en-US') || null
    if (values.isDefault !== account.isDefault) patch.isDefault = values.isDefault
    if (active !== account.isActive) patch.isActive = active
    if (values.notes.trim() !== (account.notes ?? '')) patch.notes = values.notes.trim() || null
    if (Object.keys(patch).length === 0) {
      toast.show({ message: 'Değişiklik yapmadınız.' })
      return
    }
    void run(async () => {
      await updateAccount(client, slug, account.id, patch)
      return 'Hesap kaydedildi.'
    })
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title={account ? 'Hesabı düzenle' : 'Hesap ekle'}
      footer={
        <Button disabled={busy} loading={busy && !confirmRemove} loadingText="Kaydediliyor…" onClick={save}>
          {account ? 'Değişiklikleri kaydet' : 'Hesap ekle'}
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        {!account ? (
          <SelectField label="Hesap türü" value={values.type} onChange={(event) => set('type', event.target.value)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {accountTypeLabel(t)}
              </option>
            ))}
          </SelectField>
        ) : null}
        <InputField
          label="Hesap adı"
          maxLength={100}
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          error={errors.name || undefined}
        />
        <InputField label="Banka" optional maxLength={100} value={values.bankName} onChange={(event) => set('bankName', event.target.value)} />
        <InputField
          label="IBAN"
          optional
          maxLength={50}
          autoComplete="off"
          value={values.iban}
          onChange={(event) => set('iban', event.target.value)}
          error={errors.iban || undefined}
        />
        {!account ? (
          <InputField
            label="Açılış bakiyesi (₺)"
            optional
            inputMode="decimal"
            hint="Hesapta şu an bulunan tutar. Boşsa 0 sayılır."
            value={values.openingText}
            onChange={(event) => set('openingText', event.target.value)}
            error={errors.openingText || undefined}
          />
        ) : null}
        <Switch
          label="Varsayılan hesap"
          description="Bu hesap türünde varsayılan olur; yeni gelir ve giderler önce ona yazılır."
          checked={values.isDefault}
          onCheckedChange={(on) => set('isDefault', on)}
        />
        {account ? (
          <Switch
            label="Etkin"
            description="Pasif hesap virman ve yeni hareketlerde seçilemez; geçmiş kayıtlar durur."
            checked={active}
            onCheckedChange={setActive}
          />
        ) : null}
        <TextareaField
          label="Not"
          optional
          maxLength={500}
          value={values.notes}
          onChange={(event) => set('notes', event.target.value)}
          error={errors.notes || undefined}
        />
        {account ? (
          <Button variant="danger" disabled={busy} onClick={() => setConfirmRemove(true)}>
            Hesabı sil
          </Button>
        ) : null}
      </div>
      {confirmRemove && account ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setConfirmRemove(false)
          }}
          title="Hesap silinsin mi?"
          description={`“${account.name}” hareketi yoksa silinir; hareketi varsa kayıtlar korunur ve hesap pasif olur.`}
          actionLabel="Hesabı sil"
          loading={busy}
          loadingText="Siliniyor…"
          onConfirm={() =>
            void run(async () => ((await removeAccount(client, slug, account.id)).deactivated ? 'Hareketi olduğu için hesap pasif yapıldı.' : 'Hesap silindi.'))
          }
        />
      ) : null}
    </Sheet>
  )
}

function TransferSheet({ accounts, onClose, onDone }: { accounts: readonly AccountRow[]; onClose: () => void; onDone: () => void }) {
  const client = useApiClient()
  const slug = useMe().tenant.slug
  const toast = useToast()
  const active = accounts.filter((a) => a.isActive)
  const [values, setValues] = useState<TransferValues>({ from: '', to: '', amountText: '', description: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const set = <K extends keyof TransferValues>(key: K, value: TransferValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  async function save() {
    if (busy) return
    const found = validateTransfer(values, accounts)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    setFailure(null)
    try {
      await transferBetween(client, slug, transferBody(values))
      toast.show({ message: 'Virman yapıldı.' })
      onDone()
    } catch (err) {
      setFailure(message(err))
    } finally {
      setBusy(false)
    }
  }

  const options = (
    <>
      <option value="">Seçin</option>
      {active.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} · {formatMoney(a.balance)}
        </option>
      ))}
    </>
  )

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title="Virman yap"
      description="Parayı bir hesaptan diğerine aktarın. İki hesapta da hareket olarak görünür."
      footer={
        <Button disabled={busy} loading={busy} loadingText="Aktarılıyor…" onClick={() => void save()}>
          Virman yap
        </Button>
      }
    >
      <div className="grid gap-4 pb-2">
        {failure ? <Banner tone="error">{failure}</Banner> : null}
        <SelectField label="Kaynak hesap" value={values.from} onChange={(event) => set('from', event.target.value)} error={errors.from || undefined}>
          {options}
        </SelectField>
        <SelectField label="Hedef hesap" value={values.to} onChange={(event) => set('to', event.target.value)} error={errors.to || undefined}>
          {options}
        </SelectField>
        <InputField
          label="Tutar (₺)"
          inputMode="decimal"
          autoComplete="off"
          value={values.amountText}
          onChange={(event) => set('amountText', event.target.value)}
          error={errors.amountText || undefined}
        />
        <InputField
          label="Açıklama"
          optional
          maxLength={300}
          value={values.description}
          onChange={(event) => set('description', event.target.value)}
          error={errors.description || undefined}
        />
      </div>
    </Sheet>
  )
}
