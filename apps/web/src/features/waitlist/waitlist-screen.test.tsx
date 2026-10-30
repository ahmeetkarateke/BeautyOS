import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { WaitlistScreen } from './waitlist-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown> }
let list: unknown[]
let listError: ApiError | null
let writeError: ApiError | null

const row = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  customerId: `c-${id}`,
  customerName: name,
  customerPhone: '+905321234567',
  serviceName: 'Fön',
  staffName: null,
  preferredDate: null,
  preferredTimeRange: null,
  status: 'waiting',
  notes: null,
  notifiedAt: null,
  createdAt: `2026-10-0${id.length}T08:00:00.000Z`,
  ...over,
})

function mount(me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <WaitlistScreen />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const writes = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method)

beforeEach(() => {
  request.mockReset()
  list = [
    row('a', 'Ayşe Demir', { preferredTimeRange: 'Öğleden sonra' }),
    row('bb', 'Burcu Şen', { status: 'notified' }),
    row('ccc', 'Cansu Er', { status: 'cancelled' }),
  ]
  listError = null
  writeError = null
  request.mockImplementation(async (path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      return {}
    }
    if (path.endsWith('/waitlist')) {
      if (listError) throw listError
      return { data: list }
    }
    if (path.endsWith('/services')) return { data: [{ id: 's1', name: 'Fön', durationMinutes: 45 }] }
    if (path.endsWith('/staff')) return { data: [{ id: 'p1', fullName: 'Derya Aksoy', title: 'Kuaför', skills: [] }] }
    if (path.endsWith('/customers')) return { data: [{ id: 'c1', fullName: 'Ayşe Demir', phone: '0532 111 22 33' }] }
    throw new Error(`beklenmeyen çağrı ${path}`)
  })
})
afterEach(cleanup)

describe('W22 Bekleme listesi', () => {
  it('K1: açık kayıtlar (bekleyen önce, haber verilen sonra) durum ve tercihle listelenir; kapananlar ayrı görünümde', async () => {
    mount()
    const open = await screen.findByRole('list', { name: 'Açık kayıtlar' })
    const names = within(open)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '')
    expect(names[0]).toContain('Ayşe Demir')
    expect(names[0]).toContain('Fön · Öğleden sonra')
    expect(names[0]).toContain('Bekliyor')
    expect(names[1]).toContain('Haber verildi')
    expect(within(open).queryByText('Cansu Er')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Kapanan' }))
    expect((await screen.findByRole('list', { name: 'Kapanan kayıtlar' })).textContent).toContain('Listeden çıkarıldı')
  })

  it('K2: bekleme izni olmayan rol yetkisiz ekranı görür ve istek atılmaz', () => {
    mount(makeMe('staff'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K3: Haber ver: mesaj önizlenir, BeautyOS göndermediği uyarısı var, işaretleyince notify gider', async () => {
    mount()
    const open = await screen.findByRole('list', { name: 'Açık kayıtlar' })
    fireEvent.click(within(within(open).getAllByRole('listitem')[0]).getByRole('button', { name: 'Haber ver' }))
    const dialog = await screen.findByRole('dialog', { name: 'Müşteriye haber ver' })
    expect(within(dialog).getByTestId('mesaj-onizleme').textContent).toContain('Merhaba Ayşe,')
    expect(within(dialog).getByText(/BeautyOS bu mesajı kendisi göndermez/)).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: 'WhatsApp’ta aç' }).getAttribute('href')).toContain('https://wa.me/905321234567?text=')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Haber verildi olarak işaretle' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/waitlist\/a\/notify$/)
    expect(await screen.findByText('Haber verildi olarak işaretlendi.')).toBeTruthy()
  })

  it('K4: telefonu olmayan kayıtta WhatsApp/Ara yok, açıklama yazar', async () => {
    list = [row('a', 'Ayşe Demir', { customerPhone: null })]
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Haber ver' }))
    const dialog = await screen.findByRole('dialog', { name: 'Müşteriye haber ver' })
    expect(within(dialog).queryByRole('link')).toBeNull()
    expect(within(dialog).getByText('Telefon kaydı yok; müşteriye başka yoldan ulaşın.')).toBeTruthy()
  })

  it('K5: Listeden çıkar önce onay ister; onayda DELETE gider; Vazgeç istek atmaz', async () => {
    mount()
    const open = await screen.findByRole('list', { name: 'Açık kayıtlar' })
    fireEvent.click(within(within(open).getAllByRole('listitem')[0]).getByRole('button', { name: 'Listeden çıkar' }))
    const confirm = await screen.findByRole('alertdialog')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Vazgeç' }))
    expect(writes()).toHaveLength(0)
    fireEvent.click(within(within(open).getAllByRole('listitem')[0]).getByRole('button', { name: 'Listeden çıkar' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Listeden çıkar' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][1].method).toBe('DELETE')
    expect(await screen.findByText('Listeden çıkarıldı.')).toBeTruthy()
  })

  it('K6: Listeye ekle: müşteri seçilmeden istek yok; seçilince POST gövdesi yalnız dolu alanları taşır', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Listeye ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Listeye ekle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Listeye ekle' }))
    expect(await within(dialog).findByText('Listeye eklenecek kişiyi seçin.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('searchbox', { name: /Müşteri ara/ }), { target: { value: 'ayş' } })
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Ayşe Demir' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Listeye ekle' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ customerId: 'c1' })
    expect(await screen.findByText('Listeye eklendi.')).toBeTruthy()
  })

  it('K7: boş liste açıklayıcı boş durum + Listeye ekle; hata Yeniden dene', async () => {
    list = []
    mount()
    expect(await screen.findByText('Bekleme listesi boş.')).toBeTruthy()
    cleanup()
    listError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('Bekleme listesi yüklenemedi.')
  })

  it('K8: yazma izni olmayan rolde (yalnız waitlist.view) eylem düğmeleri ve Listeye ekle çıkmaz', async () => {
    mount({ ...makeMe('owner'), permissions: ['waitlist.view'] as unknown as Me['permissions'] })
    await screen.findByRole('list', { name: 'Açık kayıtlar' })
    expect(screen.queryByRole('button', { name: 'Listeye ekle' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Haber ver' })).toBeNull()
  })

  it('K9: sunucu hatası (STATUS_LOCKED) haber verme katmanında şeritle çıkar, katman kapanmaz', async () => {
    writeError = new ApiError({ status: 409, code: 'STATUS_LOCKED' })
    mount()
    fireEvent.click(await screen.findAllByRole('button', { name: 'Haber ver' }).then((all) => all[0]))
    const dialog = await screen.findByRole('dialog', { name: 'Müşteriye haber ver' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Haber verildi olarak işaretle' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('artık işlem kabul etmiyor')
  })
})

describe('W22 KVKK: bildirim bağlantısı', () => {
  it('K10: klinik türünde önizlemede ve WhatsApp bağlantısında hizmet adı yok; salonda var', async () => {
    mount({ ...makeMe('owner'), tenant: { ...makeMe('owner').tenant, businessType: 'hair_transplant' } })
    fireEvent.click((await screen.findAllByRole('button', { name: 'Haber ver' }))[0])
    let dialog = await screen.findByRole('dialog', { name: 'Müşteriye haber ver' })
    expect(within(dialog).getByTestId('mesaj-onizleme').textContent).not.toContain('Fön')
    expect(decodeURIComponent(within(dialog).getByRole('link', { name: 'WhatsApp’ta aç' }).getAttribute('href') ?? '')).not.toContain('Fön')
    cleanup()
    mount()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Haber ver' }))[0])
    dialog = await screen.findByRole('dialog', { name: 'Müşteriye haber ver' })
    expect(decodeURIComponent(within(dialog).getByRole('link', { name: 'WhatsApp’ta aç' }).getAttribute('href') ?? '')).toContain('Fön')
  })
})
