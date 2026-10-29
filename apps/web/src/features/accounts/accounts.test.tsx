import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { AccountsScreen } from './accounts-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown>; query?: Record<string, unknown> }
let accounts: unknown[]
let listError: ApiError | null
let writeError: ApiError | null
let deleteResult: unknown

const row = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  type: 'cash',
  name,
  bankName: null,
  iban: null,
  notes: null,
  balance: 1000,
  isActive: true,
  isDefault: false,
  ...over,
})

// Hesap izinleri bu dalın shared paketinde olabilir ya da olmayabilir: oturum izinleri açıkça kurulur.
const withPerms = (role: 'owner' | 'receptionist', perms: string[]): Me => ({ ...makeMe(role), permissions: perms as unknown as Me['permissions'] })
const owner = () => withPerms('owner', ['finance.account.read', 'finance.account.write'])
const readOnly = () => withPerms('owner', ['finance.account.read'])

function mount(me: Me = owner()) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <AccountsScreen />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const writes = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method)

beforeEach(() => {
  request.mockReset()
  listError = null
  writeError = null
  deleteResult = undefined
  accounts = [
    row('a1', 'Kasa', { isDefault: true, balance: 1250.5 }),
    row('a2', 'İş Bankası', { type: 'bank', balance: 4000 }),
    row('a3', 'Eski POS', { type: 'pos', isActive: false, balance: 90 }),
  ]
  request.mockImplementation(async (path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      return init.method === 'DELETE' ? deleteResult : {}
    }
    if (listError) throw listError
    return { data: accounts }
  })
})
afterEach(cleanup)

describe('W24 Hesaplar', () => {
  it('K1: hesaplar türü, varsayılan ve pasif durumuyla listelenir; toplam yalnız etkin hesapları sayar; pasifler dahil istenir', async () => {
    mount()
    const list = await screen.findByRole('list', { name: 'Hesaplar' })
    const items = within(list)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '')
    expect(items[0]).toContain('Kasa')
    expect(items[0]).toContain('Varsayılan')
    expect(items[2]).toContain('Pasif')
    expect(screen.getByText('₺5.250,50')).toBeTruthy()
    expect((request.mock.calls[0][1] as Init).query).toEqual({ includeInactive: true })
  })

  it('K2: hesap izni olmayan rol yetkisiz ekran görür ve istek atılmaz', () => {
    mount(makeMe('receptionist'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K3: yalnız okuma izninde Hesap ekle, Virman ve düzenleme yoktur', async () => {
    mount(readOnly())
    await screen.findByRole('list', { name: 'Hesaplar' })
    expect(screen.queryByRole('button', { name: 'Hesap ekle' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Virman yap' })).toBeNull()
  })

  it('K4: yeni hesap: kısa ad istek atmaz; geçerli form POST eder (IBAN boşluksuz, açılış bakiyesi sayı)', async () => {
    mount()
    await screen.findByRole('list', { name: 'Hesaplar' })
    fireEvent.click(screen.getByRole('button', { name: 'Hesap ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hesap ekle' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Hesap adı' }), { target: { value: 'A' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hesap ekle' }))
    expect(await within(dialog).findByText('Hesap adı 2 ile 100 karakter arasında olmalı.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Hesap türü' }), { target: { value: 'bank' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Hesap adı' }), { target: { value: 'Garanti' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /IBAN/ }), { target: { value: 'tr33 0006 1005' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Açılış bakiyesi/ }), { target: { value: '1.500,25' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hesap ekle' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ type: 'bank', name: 'Garanti', iban: 'TR330006 1005'.replace(' ', ''), openingBalance: 1500.25 })
    expect(await screen.findByText('Hesap eklendi.')).toBeTruthy()
  })

  it('K5: düzenle: yalnız değişen alan PATCH edilir; değişiklik yoksa istek yok; açılış bakiyesi alanı yok', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /^İş Bankası/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Hesabı düzenle' })
    expect(within(dialog).queryByRole('textbox', { name: /Açılış bakiyesi/ })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Değişiklikleri kaydet' }))
    expect(await screen.findByText('Değişiklik yapmadınız.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Hesap adı' }), { target: { value: 'İş Bankası TL' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Değişiklikleri kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/accounts\/a2$/)
    expect((writes()[0][1] as Init).body).toEqual({ name: 'İş Bankası TL' })
  })

  it('K6: Hesabı sil onay ister; hareketli hesapta sunucu pasifleştirir ve bunu söyler', async () => {
    deleteResult = { deactivated: true }
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /^İş Bankası/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Hesabı düzenle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hesabı sil' }))
    const confirm = await screen.findByRole('alertdialog')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Vazgeç' }))
    expect(writes()).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hesabı sil' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Hesabı sil' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).method).toBe('DELETE')
    expect(await screen.findByText('Hareketi olduğu için hesap pasif yapıldı.')).toBeTruthy()
  })

  it('K7: virman: aynı hesap ve boş tutar istek atmaz; geçerli virman fromAccountId/toAccountId ile gider', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Virman yap' }))
    const dialog = await screen.findByRole('dialog', { name: 'Virman yap' })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Kaynak hesap' }), { target: { value: 'a1' } })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Hedef hesap' }), { target: { value: 'a1' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Virman yap' }))
    expect(await within(dialog).findByText('Kaynak ve hedef hesap farklı olmalı.')).toBeTruthy()
    expect(within(dialog).getByText('Tutarı yazın.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Hedef hesap' }), { target: { value: 'a2' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Tutar/ }), { target: { value: '250' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Virman yap' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/transactions\/transfer$/)
    expect((writes()[0][1] as Init).body).toEqual({ fromAccountId: 'a1', toAccountId: 'a2', amount: 250 })
    expect(await screen.findByText('Virman yapıldı.')).toBeTruthy()
  })

  it('K8: virman seçeneklerinde pasif hesap yoktur; tek etkin hesap varsa Virman yap devre dışıdır', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Virman yap' }))
    const dialog = await screen.findByRole('dialog', { name: 'Virman yap' })
    const options = Array.from((within(dialog).getByRole('combobox', { name: 'Kaynak hesap' }) as HTMLSelectElement).options).map((o) => o.text)
    expect(options.some((t) => t.includes('Eski POS'))).toBe(false)
    cleanup()
    accounts = [row('a1', 'Kasa')]
    mount()
    expect(((await screen.findByRole('button', { name: 'Virman yap' })) as HTMLButtonElement).disabled).toBe(true)
  })

  it('K9: sunucu hatası (INVALID_ACCOUNT) virman katmanında şeritle çıkar; girilenler korunur', async () => {
    writeError = new ApiError({ status: 400, code: 'INVALID_ACCOUNT' })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Virman yap' }))
    const dialog = await screen.findByRole('dialog', { name: 'Virman yap' })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Kaynak hesap' }), { target: { value: 'a1' } })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Hedef hesap' }), { target: { value: 'a2' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Tutar/ }), { target: { value: '10' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Virman yap' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Seçilen hesap bulunamadı')
    expect((within(dialog).getByRole('textbox', { name: /Tutar/ }) as HTMLInputElement).value).toBe('10')
  })

  it('K10: boş liste açıklayıcı boş durum; hata Yeniden dene', async () => {
    accounts = []
    mount()
    expect(await screen.findByText('Henüz hesap yok.')).toBeTruthy()
    cleanup()
    listError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('Hesaplar yüklenemedi.')
  })
})

describe('W24-1 öneriler ve kritik', () => {
  it('K11 (Kritik): eksi açılış bakiyesi istek atmaz ve nedenini yazar', async () => {
    mount()
    await screen.findByRole('list', { name: 'Hesaplar' })
    fireEvent.click(screen.getByRole('button', { name: 'Hesap ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hesap ekle' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Hesap adı' }), { target: { value: 'Kredi kartı' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Açılış bakiyesi/ }), { target: { value: '-5000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hesap ekle' }))
    expect(await within(dialog).findByText(/Açılış bakiyesi 0 ya da artı olmalı/)).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })

  it('K12: yalnız okuma izninde hesap satırı düğme değil düz metindir; yazma izninde düğmedir', async () => {
    mount(readOnly())
    await screen.findByRole('list', { name: 'Hesaplar' })
    expect(screen.queryByRole('button', { name: /^Kasa/ })).toBeNull()
    expect(within(screen.getByRole('list', { name: 'Hesaplar' })).getAllByRole('listitem')[0].textContent).toContain('Kasa')
  })

  it('K13: Varsayılan hesap açıklaması türü başına olduğunu söyler', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Hesap ekle' }))
    expect(await screen.findByText(/Bu hesap türünde varsayılan olur/)).toBeTruthy()
  })
})
