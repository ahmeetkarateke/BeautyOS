import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { ServicesScreen } from './services-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown>; query?: Record<string, unknown> }
let list: unknown[]
let listError: ApiError | null
let writeError: ApiError | null

const svc = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  category: 'Saç',
  durationMinutes: 45,
  price: 850,
  bufferMinutes: 0,
  isActive: true,
  isOnlineBookable: true,
  ...over,
})

function mount(me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <ServicesScreen />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const writes = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method)
const fill = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })

beforeEach(() => {
  request.mockReset()
  list = [
    svc('s1', 'Fön'),
    svc('s2', 'Cilt bakımı', { category: 'Cilt', price: 900, durationMinutes: 60 }),
    svc('s3', 'Eski paket', { isActive: false, isOnlineBookable: false }),
    svc('s4', 'Danışma', { category: '' }),
  ]
  listError = null
  writeError = null
  request.mockImplementation(async (_path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      return init.method === 'POST' ? { id: 's9' } : {}
    }
    if (listError) throw listError
    return { data: list }
  })
})
afterEach(cleanup)

describe('W20 Hizmetler', () => {
  it('K1: kategori kartları Türkçe sırada; satırda süre, fiyat, pasif ve online durumu; pasifler dahil istenir', async () => {
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Cilt' })
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Cilt', 'Saç', 'Diğer'])
    expect(request.mock.calls[0][1].query).toEqual({ includeInactive: true })
    const passive = screen.getByRole('button', { name: /Eski paket/ })
    expect(passive.textContent).toContain('Pasif')
    expect(passive.textContent).toContain('Online kapalı')
    expect(screen.getByRole('button', { name: /Cilt bakımı/ }).textContent).toContain('1 sa · ₺900')
  })

  it('K2: sahip ve müdür dışındaki rol listeyi görmez (yetkisiz) ve istek atılmaz', () => {
    mount(makeMe('receptionist'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K3: boş liste açıklayıcı boş durum + Hizmet ekle; hata Yeniden dene', async () => {
    list = []
    mount()
    expect(await screen.findByText('Henüz hizmet yok.')).toBeTruthy()
    cleanup()
    listError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('Hizmetler listesi yüklenemedi.')
  })

  it('K4: yeni hizmet: geçersiz süre istek atmaz; geçerli form POST eder ve listeyi yeniler', async () => {
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Cilt' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Hizmet ekle' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Hizmet ekle' })
    fill(within(dialog).getByRole('textbox', { name: 'Ad' }), 'Manikür')
    fill(within(dialog).getByRole('textbox', { name: /Süre/ }), '3')
    fill(within(dialog).getByRole('textbox', { name: /Fiyat/ }), '400')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hizmet ekle' }))
    expect(await within(dialog).findByText('Süreyi dakika olarak yazın. En az 5 dakika.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fill(within(dialog).getByRole('textbox', { name: /Süre/ }), '30')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hizmet ekle' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][1].body).toEqual({ name: 'Manikür', durationMinutes: 30, price: 400, bufferMinutes: 0 })
    expect(await screen.findByText('Hizmet eklendi.')).toBeTruthy()
  })

  it('K5: online kapalı yeni hizmet iki istekle kaydedilir (oluşturma sonrası isOnlineBookable:false)', async () => {
    mount()
    await screen.findByRole('heading', { level: 2, name: 'Cilt' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Hizmet ekle' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Hizmet ekle' })
    fill(within(dialog).getByRole('textbox', { name: 'Ad' }), 'Özel bakım')
    fill(within(dialog).getByRole('textbox', { name: /Süre/ }), '60')
    fill(within(dialog).getByRole('textbox', { name: /Fiyat/ }), '0')
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Online randevuya açık' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hizmet ekle' }))
    await waitFor(() => expect(writes()).toHaveLength(2))
    expect(writes()[0][1].method).toBe('POST')
    expect(writes()[1][0]).toMatch(/services\/s9$/)
    expect(writes()[1][1].body).toEqual({ isOnlineBookable: false })
  })

  it('K6: düzenle: yalnız değişen alan PATCH edilir; değişiklik yoksa istek yok', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /^Fön/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Hizmet düzenle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Değişiklikleri kaydet' }))
    expect(await screen.findByText('Değişiklik yapmadınız.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fill(within(dialog).getByRole('textbox', { name: /Fiyat/ }), '900')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Değişiklikleri kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/services\/s1$/)
    expect(writes()[0][1].body).toEqual({ price: 900 })
  })

  it('K7: Hizmet kaldır önce onay ister, onayda DELETE gönderir; Vazgeç istek atmaz', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /^Fön/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Hizmet düzenle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hizmet kaldır' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(confirm.textContent).toContain('Geçmiş randevular etkilenmez')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Vazgeç' }))
    expect(writes()).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hizmet kaldır' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Hizmet kaldır' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][1].method).toBe('DELETE')
    expect(await screen.findByText('Hizmet kaldırıldı.')).toBeTruthy()
  })

  it('K8: pasif hizmette Hizmet kaldır düğmesi yok, Etkin anahtarı var', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /Eski paket/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Hizmet düzenle' })
    expect(within(dialog).queryByRole('button', { name: 'Hizmet kaldır' })).toBeNull()
    expect((within(dialog).getByRole('switch', { name: 'Etkin' }) as HTMLInputElement).checked).toBe(false)
  })

  it('K9: sunucu hatasında şerit çıkar, girilenler korunur, katman kapanmaz', async () => {
    writeError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /^Fön/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Hizmet düzenle' })
    fill(within(dialog).getByRole('textbox', { name: /Fiyat/ }), '900')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Değişiklikleri kaydet' }))
    expect((await within(dialog).findByRole('alert')).textContent).toBeTruthy()
    expect((within(dialog).getByRole('textbox', { name: /Fiyat/ }) as HTMLInputElement).value).toBe('900')
  })
})
