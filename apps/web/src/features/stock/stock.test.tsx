import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { StockScreen } from './stock-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown> }
let items: unknown[]
let listError: ApiError | null
let writeError: ApiError | null

const item = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  sku: null,
  quantity: 10,
  lowStockThreshold: 3,
  unitCost: 50,
  sellingPrice: null,
  unit: 'adet',
  ...over,
})

function mount(me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <StockScreen />
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
  items = [item('i1', 'Şampuan'), item('i2', 'Boya', { quantity: 0 }), item('i3', 'Krem', { quantity: 2, sku: 'KRM-1' })]
  request.mockImplementation(async (path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      return {}
    }
    if (path.endsWith('/movements')) return { data: [{ id: 'm1', type: 'in', quantity: 20, notes: null, occurredAt: '2026-10-20T09:00:00.000Z' }] }
    if (listError) throw listError
    return { data: items }
  })
})
afterEach(cleanup)

describe('W25 Stok', () => {
  it('K1: tükenen ve az kalan ürünler en üstte durum metniyle; uyarı bandı sayıyı yazar', async () => {
    mount()
    const list = await screen.findByRole('list', { name: 'Ürünler' })
    const rows = within(list)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '')
    expect(rows[0]).toContain('Boya')
    expect(rows[0]).toContain('Tükendi')
    expect(rows[1]).toContain('Krem')
    expect(rows[1]).toContain('Az kaldı')
    expect(rows[2]).toContain('Şampuan')
    expect(screen.getByText('2 üründe stok azaldı ya da bitti. Listenin en üstündeler.')).toBeTruthy()
  })

  it('K2: sahip ve müdür dışı rol yetkisiz ekran görür ve istek atılmaz', () => {
    mount(makeMe('receptionist'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K3: yeni ürün: boş ad ve maliyet istek atmaz; geçerli form POST eder (sayılar, boş alanlar gönderilmez)', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Ürün ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ürün ekle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ürün ekle' }))
    expect(await within(dialog).findByText('Ürün adı 1 ile 120 karakter arasında olmalı.')).toBeTruthy()
    expect(within(dialog).getByText('Birim maliyeti rakamlarla yazın. Örnek: 49,90')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Ürün adı' }), { target: { value: 'Fön spreyi' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Birim maliyet/ }), { target: { value: '49,90' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Başlangıç miktarı' }), { target: { value: '12' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ürün ekle' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ name: 'Fön spreyi', unit: 'adet', quantity: 12, lowStockThreshold: 0, unitCost: 49.9 })
    expect(await screen.findByText('Ürün eklendi.')).toBeTruthy()
  })

  it('K4: düzenle: miktar alanı yoktur (yalnız hareketle değişir); yalnız değişen alan PATCH edilir; değişiklik yoksa istek yok', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /^Şampuan/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Ürünü düzenle' })
    expect(within(dialog).queryByRole('textbox', { name: 'Başlangıç miktarı' })).toBeNull()
    expect(within(dialog).getByText(/Mevcut stok: 10 adet/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Değişiklikleri kaydet' }))
    expect(await screen.findByText('Değişiklik yapmadınız.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Uyarı eşiği/ }), { target: { value: '5' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Değişiklikleri kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/inventory\/i1$/)
    expect((writes()[0][1] as Init).body).toEqual({ lowStockThreshold: 5 })
  })

  it('K5: ürün silme onay ister; hareketli ürün için sunucu CONFLICT dönerse anlaşılır şerit çıkar', async () => {
    writeError = new ApiError({ status: 409, code: 'CONFLICT' })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /^Şampuan/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Ürünü düzenle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ürünü sil' }))
    const confirm = await screen.findByRole('alertdialog')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Vazgeç' }))
    expect(writes()).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ürünü sil' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Ürünü sil' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('çakışıyor')
  })

  it('K6: hareket ekle: adet 0 istek atmaz; çıkışta mevcut stoktan fazlası reddedilir; geçerli hareket POST edilir; son hareketler listelenir', async () => {
    mount()
    const row = (await screen.findByRole('list', { name: 'Ürünler' })).querySelectorAll('li')[2] as HTMLElement
    fireEvent.click(within(row).getByRole('button', { name: /^Hareket ekle.*Şampuan/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Stok hareketi ekle' })
    expect((await within(dialog).findByRole('list', { name: 'Son hareketler' })).textContent).toContain('Alım')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hareketi kaydet' }))
    expect(await within(dialog).findByText('Adedi 1 ile 1.000.000 arasında tam sayı olarak yazın.')).toBeTruthy()
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Hareket türü' }), { target: { value: 'out' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Adet' }), { target: { value: '99' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hareketi kaydet' }))
    expect(await within(dialog).findByText('Mevcut stok 10; bundan fazlasını çıkaramazsınız.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Adet' }), { target: { value: '4' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hareketi kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/inventory\/i1\/movements$/)
    expect((writes()[0][1] as Init).body).toEqual({ type: 'out', quantity: 4 })
  })

  it('K7: boş liste açıklayıcı; hata Yeniden dene', async () => {
    items = []
    mount()
    expect(await screen.findByText('Henüz ürün yok.')).toBeTruthy()
    cleanup()
    listError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('Stok listesi yüklenemedi.')
  })
})
