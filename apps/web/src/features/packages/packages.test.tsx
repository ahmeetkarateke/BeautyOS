import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { PackagesScreen } from './packages-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown>; query?: Record<string, unknown> }
let packages: unknown[]
let listError: ApiError | null
let writeError: ApiError | null

const pk = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  serviceId: 's1',
  service: { name: 'Cilt bakımı' },
  totalSessions: 6,
  price: 3000,
  validityDays: 180,
  description: null,
  isActive: true,
  ...over,
})

function mount(me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <PackagesScreen />
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
  packages = [pk('p1', 'Cilt 6 seans'), pk('p2', 'Eski paket', { isActive: false })]
  request.mockImplementation(async (path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      return {}
    }
    if (path.endsWith('/services')) return { data: [{ id: 's1', name: 'Cilt bakımı', durationMinutes: 60 }] }
    if (listError) throw listError
    return { data: packages }
  })
})
afterEach(cleanup)

describe('W26 Paketler', () => {
  it('K1: paketler hizmet, seans, fiyat, süre ve seans başı fiyatla; pasifler sonda; includeInactive istenir', async () => {
    mount()
    const list = await screen.findByRole('list', { name: 'Paketler' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0].textContent).toContain('6 seans · ₺3.000 · 180 gün geçerli')
    expect(rows[0].textContent).toContain('seans başı ₺500')
    expect(rows[1].textContent).toContain('Pasif')
    expect((request.mock.calls[0][1] as Init).query).toEqual({ includeInactive: true })
  })

  it('K2: sahip ve müdür dışı rol yetkisiz ekran görür ve istek atılmaz', () => {
    mount(makeMe('receptionist'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K3: yeni paket: eksik alanlar istek atmaz; geçerli form POST eder', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Paket ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Paket ekle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Paket ekle' }))
    expect(await within(dialog).findByText('Paketin hangi hizmet için olduğunu seçin.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Hizmet' }), { target: { value: 's1' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Paket adı' }), { target: { value: 'Cilt 10 seans' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Seans sayısı' }), { target: { value: '10' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Paket fiyatı/ }), { target: { value: '4.500' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Paket ekle' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({
      serviceId: 's1',
      name: 'Cilt 10 seans',
      totalSessions: 10,
      price: 4500,
      validityDays: null,
      isActive: true,
    })
    expect(await screen.findByText('Paket eklendi.')).toBeTruthy()
  })

  it('K4: düzenle: yalnız değişen alan PATCH edilir; değişiklik yoksa istek yok', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /^Cilt 6 seans/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Paketi düzenle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Değişiklikleri kaydet' }))
    expect(await screen.findByText('Değişiklik yapmadınız.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Paket fiyatı/ }), { target: { value: '3.300' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Değişiklikleri kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/packages\/p1$/)
    expect((writes()[0][1] as Init).body).toEqual({ price: 3300 })
  })

  it('K5: kaldırma onay ister; kullanan müşteri paketi varsa PACKAGE_IN_USE metni görünür', async () => {
    writeError = new ApiError({ status: 409, code: 'PACKAGE_IN_USE' })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /^Cilt 6 seans/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Paketi düzenle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Paketi kaldır' }))
    const confirm = await screen.findByRole('alertdialog')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Vazgeç' }))
    expect(writes()).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Paketi kaldır' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Paketi kaldır' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Bu paketi kullanan etkin müşteri paketi var')
  })

  it('K6: boş liste ve hata durumları açıklayıcıdır', async () => {
    packages = []
    mount()
    expect(await screen.findByText('Henüz paket yok.')).toBeTruthy()
    cleanup()
    listError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('Paketler yüklenemedi.')
  })
})
