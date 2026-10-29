import { describe, expect, it } from 'vitest'
import {
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
} from './logic'

const acc = (over: Partial<AccountRow> = {}): AccountRow => ({ id: 'a1', type: 'cash', name: 'Kasa', balance: 1000, isActive: true, isDefault: false, ...over })
const valid: AccountValues = {
  type: 'bank',
  name: 'İş Bankası',
  bankName: 'İş Bankası',
  iban: 'TR33 0006 1005 1978 6457 8413 26',
  openingText: '1.250,50',
  isDefault: false,
  notes: '',
}

describe('W24 accountTypeLabel', () => {
  it('K1: hesap türleri Türkçe; bilinmeyen tür "Diğer"', () => {
    expect(accountTypeLabel('cash')).toBe('Kasa')
    expect(accountTypeLabel('bank')).toBe('Banka hesabı')
    expect(accountTypeLabel('pos')).toBe('POS hesabı')
    expect(accountTypeLabel('credit_card')).toBe('Kredi kartı')
    expect(accountTypeLabel('zzz')).toBe('Diğer')
  })
})

describe('W24 sortAccounts / totalBalance', () => {
  it('K2: varsayılan hesap önce, sonra etkinler ada göre (Türkçe), pasifler sonda', () => {
    const sorted = sortAccounts([
      acc({ id: 'p', name: 'Eski', isActive: false }),
      acc({ id: 'z', name: 'Zeta' }),
      acc({ id: 'c', name: 'Çiçek' }),
      acc({ id: 'd', name: 'Ana', isDefault: true }),
    ])
    expect(sorted.map((a) => a.id)).toEqual(['d', 'c', 'z', 'p'])
  })
  it('K2: toplam bakiye yalnız etkin hesapları toplar; kuruş hatası yok', () => {
    expect(totalBalance([acc({ balance: 0.1 }), acc({ balance: 0.2 }), acc({ balance: 500, isActive: false })])).toBe(0.3)
  })
})

describe('W24 validateAccount', () => {
  it('K3: geçerli hesap hatasızdır (açılış bakiyesi Türkçe biçimde)', () => {
    expect(validateAccount(valid)).toEqual({})
  })
  it('K3: ad 2-100; yalnız ad alanı işaretlenir', () => {
    expect(Object.keys(validateAccount({ ...valid, name: 'A' }))).toEqual(['name'])
    expect(Object.keys(validateAccount({ ...valid, name: 'a'.repeat(101) }))).toEqual(['name'])
  })
  it('K3: açılış bakiyesi boş = 0 kabul; eksi KABUL (borçlu hesap; sunucu S-hesap-bakiye ile doğru yönde yazar); harf reddedilir', () => {
    expect(validateAccount({ ...valid, openingText: '' })).toEqual({})
    expect(validateAccount({ ...valid, openingText: '-250,5' })).toEqual({})
    expect(validateAccount({ ...valid, openingText: '-0,01' })).toEqual({})
    expect(accountBody({ ...valid, openingText: '-5.000' }).openingBalance).toBe(-5000)
    expect(validateAccount({ ...valid, openingText: '0' })).toEqual({})
    expect(Object.keys(validateAccount({ ...valid, openingText: 'abc' }))).toEqual(['openingText'])
  })
  it('K3: IBAN 50, not 500 karakteri geçemez', () => {
    expect(Object.keys(validateAccount({ ...valid, iban: 'x'.repeat(51) }))).toEqual(['iban'])
    expect(Object.keys(validateAccount({ ...valid, notes: 'x'.repeat(501) }))).toEqual(['notes'])
  })
})

describe('W24 accountBody', () => {
  it('K4: oluşturma gövdesi sayıyı çevirir, boş isteğe bağlı alanı göndermez, IBAN boşluksuz büyük harf', () => {
    expect(accountBody(valid)).toEqual({ type: 'bank', name: 'İş Bankası', bankName: 'İş Bankası', iban: 'TR330006100519786457841326', openingBalance: 1250.5 })
    expect(accountBody({ ...emptyAccount(), name: 'Kasa' })).toEqual({ type: 'cash', name: 'Kasa', openingBalance: 0 })
  })
  it('K4: varsayılan işaretliyse isDefault: true gider', () => {
    expect(accountBody({ ...valid, isDefault: true }).isDefault).toBe(true)
  })
})

describe('W24 virman', () => {
  const accounts = [acc({ id: 'a', balance: 500 }), acc({ id: 'b', balance: 0 }), acc({ id: 'c', isActive: false })]
  it('K5: geçerli virman hatasızdır', () => {
    expect(validateTransfer({ from: 'a', to: 'b', amountText: '100', description: '' }, accounts)).toEqual({})
  })
  it('K5: aynı hesaba virman reddedilir; kaynak ve hedef zorunlu', () => {
    expect(validateTransfer({ from: 'a', to: 'a', amountText: '100', description: '' }, accounts).to).toBe('Kaynak ve hedef hesap farklı olmalı.')
    expect(Object.keys(validateTransfer({ from: '', to: '', amountText: '100', description: '' }, accounts)).sort()).toEqual(['from', 'to'])
  })
  it('K5: tutar sıfır/eksi/harf reddedilir; pasif hesap seçilemez', () => {
    expect(validateTransfer({ from: 'a', to: 'b', amountText: '0', description: '' }, accounts).amountText).toBe('Tutar 0’dan büyük olmalı.')
    expect(Object.keys(validateTransfer({ from: 'a', to: 'b', amountText: 'x', description: '' }, accounts))).toEqual(['amountText'])
    expect(validateTransfer({ from: 'a', to: 'c', amountText: '10', description: '' }, accounts).to).toBe('Pasif hesaba virman yapılamaz.')
  })
  it('K5: açıklama 2-300 (doluysa)', () => {
    expect(Object.keys(validateTransfer({ from: 'a', to: 'b', amountText: '10', description: 'x' }, accounts))).toEqual(['description'])
  })
  it('K6: gövde alan adlarını sunucuya göre kurar; boş açıklama gönderilmez', () => {
    expect(transferBody({ from: 'a', to: 'b', amountText: '1.250,50', description: '' })).toEqual({ fromAccountId: 'a', toAccountId: 'b', amount: 1250.5 })
    expect(transferBody({ from: 'a', to: 'b', amountText: '10', description: ' Kasa devri ' }).description).toBe('Kasa devri')
  })
})
