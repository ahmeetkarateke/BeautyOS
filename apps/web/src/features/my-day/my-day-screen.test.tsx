import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { MyDayScreen } from './my-day-screen'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => '/panel/defne/gunum' }))

const request = vi.fn()
const client = { request } as unknown as ApiClient
const NOW = new Date('2026-10-28T11:30:00+03:00')

const row = (id: string, from: string, to: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, staffId: 's1', staffName: 'Elif Demir', customerId: `c-${id}`, serviceId: 'sv1', customerName: `Müşteri ${id}`, customerPhone: '0532 111 22 33', serviceName: 'Fön',
  startTime: new Date(`2026-10-28T${from}:00+03:00`).toISOString(), endTime: new Date(`2026-10-28T${to}:00+03:00`).toISOString(), durationMinutes: 45, status, priceCharged: 500, ...extra,
})

let rows: unknown[] = []
let dayError: ApiError | null = null

function mount(me: Me = makeMe('staff')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <MyDayScreen now={NOW} />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const callTo = (suffix: string) => request.mock.calls.find(([p]) => String(p).endsWith(suffix))

beforeEach(() => {
  request.mockReset()
  push.mockReset()
  dayError = null
  rows = [row('a1', '09:00', '09:45', 'completed'), row('a2', '11:45', '12:30', 'confirmed'), row('a3', '14:00', '15:00', 'pending')]
  request.mockImplementation(async (path: string) => {
    if (path.endsWith('/appointments')) {
      if (dayError) throw dayError
      return { data: rows }
    }
    if (path.endsWith('/status')) return {}
    throw new Error(`beklenmeyen çağrı ${path}`)
  })
})
afterEach(cleanup)

describe('W11 Günüm (uzman)', () => {
  it('K-yükleniyor: veri gelmeden iskelet ve başlık görünür', () => {
    mount()
    expect(screen.getAllByText('Yükleniyor…').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 1, name: 'Günüm' })).toBeTruthy()
  })

  it('K-sorgu: yalnız kendi randevuları, İstanbul günüyle istenir', async () => {
    mount()
    await screen.findByTestId('gunum-siradaki')
    expect(callTo('/appointments')![1].query).toEqual({ date: '2026-10-28', staffId: 's1' })
  })

  it('K-sıradaki: sıradaki randevu büyük kartta, kalan dakikayla görünür', async () => {
    mount()
    const card = await screen.findByTestId('gunum-siradaki')
    expect(within(card).getByRole('heading', { name: 'Sıradaki' })).toBeTruthy()
    expect(card.textContent).toContain('15 dk sonra')
    expect(card.textContent).toContain('11:45 – 12:30')
    expect(card.textContent).toContain('Müşteri a2')
    expect(card.textContent).toContain('Fön · 45 dk')
  })

  it('K-şimdi: devam eden randevu varsa kart "Şimdi" ve "Devam ediyor" der', async () => {
    rows = [row('a1', '11:00', '12:00', 'in_progress')]
    mount()
    const card = await screen.findByTestId('gunum-siradaki')
    expect(within(card).getByRole('heading', { name: 'Şimdi' })).toBeTruthy()
    expect(card.textContent).toContain('Devam ediyor')
  })

  it('K-ara: müşteriyi arama bağlantısı tel: adresidir ve boşluksuzdur', async () => {
    mount()
    const card = await screen.findByTestId('gunum-siradaki')
    expect(within(card).getByRole('link', { name: 'Ara: Müşteri a2' }).getAttribute('href')).toBe('tel:05321112233')
  })

  it('K-başlat: Başlat durumu devam ediyor yapar ve listeyi yeniler', async () => {
    mount()
    const card = await screen.findByTestId('gunum-siradaki')
    fireEvent.click(within(card).getByRole('button', { name: 'Başlat' }))
    await waitFor(() => expect(callTo('/a2/status')).toBeDefined())
    expect(callTo('/a2/status')![1]).toMatchObject({ method: 'PATCH', body: { status: 'in_progress' } })
    await waitFor(() => expect(request.mock.calls.filter(([p, i]) => String(p).endsWith('/appointments') && !i?.method).length).toBe(2))
  })

  it('K-sıra: günün sırası tüm randevuları saat sırasıyla listeler; özet tamamlanan ve kalanı sayar', async () => {
    mount()
    const list = await screen.findByRole('region', { name: 'Günün sırası' })
    expect(within(list).getAllByTestId(/^randevu-/).map((el) => el.getAttribute('data-testid'))).toEqual(['randevu-a1', 'randevu-a2', 'randevu-a3'])
    const summary = screen.getByRole('region', { name: 'Bugün' })
    expect(within(summary).getByText('Tamamlanan').nextElementSibling?.textContent).toBe('1')
    expect(within(summary).getByText('Kalan').nextElementSibling?.textContent).toBe('2')
  })

  it('K-boş: randevu yokken "Bugün randevunuz yok." yazar', async () => {
    rows = []
    mount()
    expect(await screen.findByText('Bugün randevunuz yok.')).toBeTruthy()
  })

  it('K-hata: yüklenemezse blok içi hata ve Yeniden dene çıkar', async () => {
    dayError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect(await screen.findByText('Randevularınız yüklenemedi.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeTruthy()
  })

  it('K-profil: uzman profili olmayan hesapta istek atılmaz, Bugün’e yönlendirme bilgisi görünür', async () => {
    mount({ ...makeMe('owner'), staffId: null })
    expect(await screen.findByText('Bu hesapta uzman profili yok.')).toBeTruthy()
    expect(callTo('/appointments')).toBeUndefined()
  })

  it('K-izin: izinlerim bölümü hazır olmayan özelliği "Yakında" olarak belirtir', async () => {
    mount()
    const leave = await screen.findByRole('region', { name: 'İzinlerim' })
    expect(leave.textContent).toContain('Yakında')
  })
})
