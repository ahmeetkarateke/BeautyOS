import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { CustomersScreen } from './customers-screen'
import '@/ui/test-polyfills'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => '/panel/defne/musteriler' }))

const request = vi.fn()
const client = { request } as unknown as ApiClient

const row = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id,
  fullName: name,
  phone: '+90 532 111 22 33',
  totalVisits: 2,
  lastVisitDate: '2026-10-20T09:00:00.000Z',
  ...over,
})
let handler: (query: Record<string, unknown>) => unknown

function mount(me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <CustomersScreen />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const calls = () => request.mock.calls.map(([, init]) => (init?.query ?? {}) as Record<string, unknown>)
const type = (value: string) => fireEvent.change(screen.getByRole('searchbox', { name: /Müşteri ara/ }), { target: { value } })

beforeEach(() => {
  request.mockReset()
  push.mockReset()
  handler = () => ({ data: [row('c1', 'Ayşe Demir'), row('c2', 'Burcu Şen', { phone: null, totalVisits: 0, lastVisitDate: null })], nextCursor: null })
  request.mockImplementation(async (_path: string, init?: { query?: Record<string, unknown> }) => {
    const result = handler(init?.query ?? {})
    if (result instanceof Error) throw result
    return result
  })
})
afterEach(cleanup)

describe('W17 Müşteriler (sahip/müdür/resepsiyon)', () => {
  it('K1: liste aramasız yüklenir; ad, telefon ve ziyaret satırı görünür; kart açılır', async () => {
    mount()
    expect(screen.getByRole('heading', { level: 1, name: 'Müşteriler' })).toBeTruthy()
    const list = await screen.findByRole('list', { name: 'Müşteriler' })
    expect(calls()[0].search).toBeUndefined()
    expect(within(list).getByText('2 ziyaret · son: 20 Eki', { exact: false })).toBeTruthy()
    fireEvent.click(within(list).getByRole('button', { name: /Ayşe Demir/ }))
    expect(push).toHaveBeenCalledWith('/panel/defne/musteri/c1')
  })

  it('K4: telefonu olmayan müşteri (Telegram) "Telefon yok" yazar ve açılabilir', async () => {
    mount()
    const item = await screen.findByRole('button', { name: /Burcu Şen/ })
    expect(item.textContent).toContain('Telefon yok')
    expect(item.textContent).toContain('Henüz ziyaret yok')
  })

  it('K6: Daha fazla göster imleçle sonraki sayfayı ekler, kopya satırı atar', async () => {
    handler = (q) =>
      q.cursor
        ? { data: [row('c2', 'Burcu Şen'), row('c3', 'Cansu Er')], nextCursor: null }
        : { data: [row('c1', 'Ayşe Demir'), row('c2', 'Burcu Şen')], nextCursor: 'c2' }
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Daha fazla göster' }))
    await screen.findByRole('button', { name: /Cansu Er/ })
    expect(calls()[1].cursor).toBe('c2')
    expect(screen.getAllByRole('button', { name: /Burcu Şen/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Daha fazla göster' })).toBeNull()
  })

  it('K7: sonraki sayfa hatası sessiz kalmaz: şerit çıkar, satırlar ve düğme kalır', async () => {
    handler = (q) => (q.cursor ? new ApiError({ status: 500, code: 'INTERNAL_ERROR' }) : { data: [row('c1', 'Ayşe Demir')], nextCursor: 'c1' })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Daha fazla göster' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Devamı yüklenemedi')
    expect(screen.getByRole('button', { name: /Ayşe Demir/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Daha fazla göster' })).toBeTruthy()
  })

  it('K8: arama 2 karakterde istek atar; eski listenin satırları sonuçla karışmaz', async () => {
    handler = (q) => (q.search ? { data: [row('c9', 'Ayla Kaya')], nextCursor: null } : { data: [row('c1', 'Ayşe Demir')], nextCursor: null })
    mount()
    await screen.findByRole('button', { name: /Ayşe Demir/ })
    type('ayl')
    await screen.findByRole('button', { name: /Ayla Kaya/ })
    expect(screen.queryByRole('button', { name: /Ayşe Demir/ })).toBeNull()
    expect(calls().at(-1)?.search).toBe('ayl')
  })

  it('K8b: sonraki sayfadan gelen satır, arama değişince sonuca karışmaz (ek sayfalar sorgu anahtarına bağlı)', async () => {
    handler = (q) => {
      if (q.search) return { data: [row('c9', 'Ayla Kaya')], nextCursor: null }
      return q.cursor ? { data: [row('c3', 'Cansu Er')], nextCursor: null } : { data: [row('c1', 'Ayşe Demir')], nextCursor: 'c1' }
    }
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Daha fazla göster' }))
    await screen.findByRole('button', { name: /Cansu Er/ })
    type('ayl')
    await screen.findByRole('button', { name: /Ayla Kaya/ })
    expect(screen.queryByRole('button', { name: /Cansu Er/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Ayşe Demir/ })).toBeNull()
  })

  it('K9: sonuç yoksa aranan terimle boş durum + Müşteri ekle', async () => {
    handler = (q) => (q.search ? { data: [], nextCursor: null } : { data: [row('c1', 'Ayşe Demir')], nextCursor: null })
    mount()
    await screen.findByRole('button', { name: /Ayşe Demir/ })
    type('zzz')
    expect(await screen.findByText('“zzz” ile eşleşen müşteri yok.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Müşteri ekle' }))
    expect(push).toHaveBeenCalledWith('/panel/defne/musteri-yeni')
  })

  it('K10: hiç müşteri yoksa liste boş durumu', async () => {
    handler = () => ({ data: [], nextCursor: null })
    mount()
    expect(await screen.findByText('Henüz müşteri kaydı yok.')).toBeTruthy()
  })

  it('K11: liste hatası ErrorState + Yeniden dene; yeniden deneyince liste gelir', async () => {
    let fail = true
    handler = () => (fail ? new ApiError({ status: 500, code: 'INTERNAL_ERROR' }) : { data: [row('c1', 'Ayşe Demir')], nextCursor: null })
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('Müşteri listesi yüklenemedi.')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }))
    await screen.findByRole('button', { name: /Ayşe Demir/ })
  })

  it('K12: yükleniyor durumunda iskelet görünür', () => {
    handler = () => new Promise(() => {}) as unknown as Error
    mount()
    expect(screen.getAllByText('Yükleniyor…').length).toBeGreaterThan(0)
  })
})

describe('W17 Müşteriler (uzman, arama kipi, R4)', () => {
  const staff = () => ({ ...makeMe('staff'), staffId: 's1' })

  it('K2: uzmanda liste yok; açılışta istek atılmaz, başlık Müşterilerim, arama ipucu var', () => {
    mount(staff())
    expect(screen.getByRole('heading', { level: 1, name: 'Müşterilerim' })).toBeTruthy()
    expect(screen.getByText('Müşteri bulmak için arayın.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K2: 2 karakterde istek atılmaz (en az 3), 3 karakterde atılır', async () => {
    handler = () => ({ data: [], nextCursor: null })
    mount(staff())
    type('ay')
    await new Promise((r) => setTimeout(r, 450))
    expect(request).not.toHaveBeenCalled()
    type('ayş')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    expect(calls()[0].search).toBe('ayş')
  })

  it('K3: maskeli ve kendisinin olmayan kart açılmaz, nedeni yazar; kendi müşterisi açılır', async () => {
    handler = () => ({
      data: [
        row('c1', 'Ayşe Demir', { isOwn: true, phoneMasked: false }),
        row('c2', 'Ayşegül Kara', { isOwn: false, phoneMasked: true, phone: '0533 *** ** 66', totalVisits: null, lastVisitDate: null }),
      ],
      nextCursor: null,
    })
    mount(staff())
    type('ayş')
    const own = await screen.findByRole('button', { name: /Ayşe Demir/ })
    fireEvent.click(own)
    expect(push).toHaveBeenCalledWith('/panel/defne/musteri/c1')
    expect(screen.queryByRole('button', { name: /Ayşegül Kara/ })).toBeNull()
    const masked = screen.getByText('Ayşegül Kara').closest('li') as HTMLElement
    expect(masked.textContent).toContain('0533 *** ** 66')
    expect(masked.textContent).toContain('Sizin müşteriniz değil')
  })

  it('K13: uzman müşteri ekleyemez (izin yok): Müşteri ekle düğmesi çıkmaz', () => {
    mount(staff())
    expect(screen.queryByRole('link', { name: 'Müşteri ekle' })).toBeNull()
  })
})
