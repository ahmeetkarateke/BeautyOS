import { parseAmount } from '@/features/payment/payment-logic'

// Hesaplar saf mantığı (W24). Bakiye ve virman hareketleri sunucuda hesaplanır (Decimal); burada yalnız girdi okunur.
export type AccountRow = {
  id: string
  type: string
  name: string
  bankName?: string | null
  iban?: string | null
  notes?: string | null
  balance: number
  isActive: boolean
  isDefault: boolean
}
export type AccountValues = { type: string; name: string; bankName: string; iban: string; openingText: string; isDefault: boolean; notes: string }
export type TransferValues = { from: string; to: string; amountText: string; description: string }

const TYPE_LABELS: Record<string, string> = { cash: 'Kasa', bank: 'Banka hesabı', pos: 'POS hesabı', credit_card: 'Kredi kartı', other: 'Diğer' }
export const ACCOUNT_TYPES = Object.keys(TYPE_LABELS)
export const accountTypeLabel = (type: string): string => TYPE_LABELS[type] ?? 'Diğer'

const collator = new Intl.Collator('tr')

/** Varsayılan hesap önce, sonra etkinler ada göre, pasifler sonda. */
export function sortAccounts(accounts: readonly AccountRow[]): AccountRow[] {
  return [...accounts].sort((a, b) => Number(b.isActive) - Number(a.isActive) || Number(b.isDefault) - Number(a.isDefault) || collator.compare(a.name, b.name))
}

/** Yalnız etkin hesaplar; kuruş tam sayı olarak toplanır. */
export function totalBalance(accounts: readonly AccountRow[]): number {
  return accounts.filter((a) => a.isActive).reduce((sum, a) => sum + Math.round(a.balance * 100), 0) / 100
}

export const emptyAccount = (): AccountValues => ({ type: 'cash', name: '', bankName: '', iban: '', openingText: '', isDefault: false, notes: '' })

const NAME_MAX = 100
const IBAN_MAX = 50
const NOTES_MAX = 500

/** Açılış bakiyesi: boş = 0; eksi kabul (borçlu hesap). */
function parseOpening(text: string): number | null {
  const raw = text.trim()
  if (raw === '') return 0
  if (/^-?0([,.]0{1,2})?$/.test(raw)) return 0
  const negative = raw.startsWith('-')
  const parsed = parseAmount(negative ? raw.slice(1) : raw)
  return parsed.ok ? (negative ? -parsed.value : parsed.value) : null
}

export function validateAccount(values: AccountValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = values.name.trim()
  if (name.length < 2 || name.length > NAME_MAX) errors.name = `Hesap adı 2 ile ${NAME_MAX} karakter arasında olmalı.`
  // Eksi açılış (borçlu hesap, ör. kredi kartı) geçerlidir: sunucu S-hesap-bakiye ile doğru yönde yazar.
  if (parseOpening(values.openingText) === null) errors.openingText = 'Açılış bakiyesini rakamlarla yazın. Örnek: 1.250,50 ya da borçluysa -1.250,50'
  if (values.iban.trim().length > IBAN_MAX) errors.iban = `IBAN en çok ${IBAN_MAX} karakter olabilir.`
  if (values.notes.length > NOTES_MAX) errors.notes = `Not en çok ${NOTES_MAX} karakter olabilir.`
  return errors
}

export function accountBody(values: AccountValues): Record<string, unknown> {
  const bank = values.bankName.trim()
  const iban = values.iban.replace(/\s+/g, '').toLocaleUpperCase('en-US')
  const notes = values.notes.trim()
  return {
    type: values.type,
    name: values.name.trim(),
    ...(bank ? { bankName: bank } : {}),
    ...(iban ? { iban } : {}),
    openingBalance: parseOpening(values.openingText) ?? 0,
    ...(values.isDefault ? { isDefault: true } : {}),
    ...(notes ? { notes } : {}),
  }
}

export function validateTransfer(values: TransferValues, accounts: readonly AccountRow[]): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.from) errors.from = 'Kaynak hesabı seçin.'
  if (!values.to) errors.to = 'Hedef hesabı seçin.'
  else if (values.to === values.from) errors.to = 'Kaynak ve hedef hesap farklı olmalı.'
  else if (accounts.find((a) => a.id === values.to)?.isActive === false) errors.to = 'Pasif hesaba virman yapılamaz.'
  if (values.from && accounts.find((a) => a.id === values.from)?.isActive === false) errors.from = 'Pasif hesaptan virman yapılamaz.'
  const amount = parseAmount(values.amountText)
  if (!amount.ok) errors.amountText = amount.error
  const description = values.description.trim()
  if (description !== '' && (description.length < 2 || description.length > 300)) errors.description = 'Açıklama 2 ile 300 karakter arasında olmalı.'
  return errors
}

export function transferBody(values: TransferValues): Record<string, unknown> {
  const amount = parseAmount(values.amountText)
  const description = values.description.trim()
  return {
    fromAccountId: values.from,
    toAccountId: values.to,
    amount: amount.ok ? amount.value : 0,
    ...(description ? { description } : {}),
  }
}
