import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { permissionsFor } from '@beautyos/shared'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { TodayScreen } from './today-screen'
import '@/ui/test-polyfills'

const push = vi.fn()
const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }), usePathname: () => '/panel/defne/bugun' }))

const request = vi.fn()
const client = { request } as unknown as ApiClient
const NOW = new Date('2026-10-28T11:30:00+03:00')

const row = (id: string, staffId: string, staffName: string, from: string, to: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, staffId, staffName, customerId: 'c-' + id, serviceId: 'sv1', customerName: `Müşteri ${id}`, customerPhone: '+90 532 000 00 00', serviceName: 'Fön',
  startTime: new Date(`2026-10-28T${from}:00+03:00`).toISOString(), endTime: new Date(`2026-10-28T${to}:00+03:00`).toISOString(), durationMinutes: 45, status, priceCharged: 500, ...extra,
})

const staffData = {
  data: [
    { id: 'p1', fullName: 'Derya Aksoy', title: 'Kuaför', skills: [{ serviceId: 'sv1' }] },
    { id: 'p2', fullName: 'Elif Tan', title: 'Estetisyen', skills: [{ serviceId: 'sv1' }] },
  ],
}

let appointments: unknown[] = []
let appointmentsError: ApiError | null = null
let staffError: ApiError | null = null
let weekDashboardError: ApiError | null = null
let services: unknown[] = [{ id: 'sv1' }]
let pendingRows: unknown[] = []
let pendingError: ApiError | null = null

function setupApi() {
  request.mockImplementation(async (path: string, init?: { query?: Record<string, string>; method?: string }) => {
    if (path.endsWith('/appointments') && !init?.method) {
      if (init?.query?.status === 'pending') {
        if (pendingError) throw pendingError
        return { data: pendingRows }
      }
      if (appointmentsError) throw appointmentsError
      return { data: appointments }
    }
    if (path.endsWith('/staff')) {
      if (staffError) throw staffError
      return staffData
    }
    if (path.endsWith('/services')) return { data: services }
    if (path.endsWith('/dashboard') && weekDashboardError && init?.query?.period === 'week') throw weekDashboardError
    if (path.endsWith('/dashboard')) return { todayAppointmentCount: 6, todayRevenue: 3200, revenueChange: 12, appointmentChange: null, occupancyRate: 48, totalCustomers: 100 }
    if (path.endsWith('/customer-candidates')) return { data: [] }
    if (path.endsWith('/status') || path.endsWith('/approve') || path.endsWith('/reject')) return {}
    throw new Error(`beklenmeyen çağrı ${path}`)
  })
}

function mount(me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <TodayScreen now={NOW} />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const callTo = (suffix: string) => request.mock.calls.find(([p]) => String(p).endsWith(suffix))

beforeEach(() => {
  request.mockReset()
  push.mockReset()
  replace.mockReset()
  appointmentsError = null
  pendingError = null
  staffError = null
  weekDashboardError = null
  services = [{ id: 'sv1' }]
  pendingRows = [row('a4', 'p2', 'Elif Tan', '15:00', '16:00', 'pending', { unverified: true, customerId: null })]
  appointments = [
    row('a1', 'p1', 'Derya Aksoy', '09:00', '10:00', 'completed'),
    row('a2', 'p1', 'Derya Aksoy', '11:00', '12:00', 'in_progress'),
    row('a3', 'p2', 'Elif Tan', '12:00', '12:45', 'confirmed'),
    row('a4', 'p2', 'Elif Tan', '15:00', '16:00', 'pending', { unverified: true, customerId: null }),
  ]
  setupApi()
})
afterEach(cleanup)

describe('W10 Bugün ekranı', () => {
  it('K-yükleniyor: veri gelmeden iskelet ve "Yükleniyor…" duyurusu görünür', () => {
    mount()
    expect(screen.getAllByText('Yükleniyor…').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 1, name: 'Bugün' })).toBeTruthy()
  })

  it('K-gün: İstanbul günü istenir; doluluk şeridi, "Şu an boş" cümlesi ve günün randevuları çizilir', async () => {
    mount()
    await screen.findByTestId('doluluk-seridi')
    expect(callTo('/appointments')![1].query).toEqual({ date: '2026-10-28' })
    // 11:30: Derya meşgul (a2), Elif boş, 12:00'ye kadar.
    expect(screen.getByTestId('simdi-bos').textContent).toBe('Şu an boş: Elif (12:00’ye kadar).')
    expect(screen.getByTestId('randevu-a1')).toBeTruthy()
    expect(screen.getByTestId('randevu-a3')).toBeTruthy()
  })

  it('K-süz: personel çipi günün listesini o kişiye daraltır', async () => {
    mount()
    await screen.findByTestId('randevu-a3')
    const list = screen.getByRole('region', { name: /^Günün randevuları/ })
    fireEvent.click(within(within(list).getByRole('group', { name: 'Personele göre süz' })).getByRole('button', { name: /^Derya/ }))
    expect(within(list).queryByTestId('randevu-a3')).toBeNull()
    expect(within(list).getByTestId('randevu-a1')).toBeTruthy()
  })

  it('K-onay-bulgu: bekleyen online talep şeridi sayıyı yazar ve Gözden geçir onay katmanını açar', async () => {
    mount()
    const banner = await screen.findByTestId('bugun-bulgu')
    expect(banner.textContent).toContain('1 online randevu onay bekliyor.')
    fireEvent.click(within(banner).getByRole('button', { name: 'Gözden geçir' }))
    expect(await screen.findByRole('dialog', { name: 'Online randevu talebi' })).toBeTruthy()
  })

  it('W10-2 Ö1: bekleyen talepler sorgusu hata verirse şerit kaybolmaz; blok içi hata ve Yeniden dene çıkar', async () => {
    pendingError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    const banner = await screen.findByTestId('bugun-bulgu')
    expect(banner.textContent).toContain('Bekleyen online talepler yüklenemedi.')
    pendingError = null
    fireEvent.click(within(banner).getByRole('button', { name: 'Yeniden dene' }))
    await waitFor(() => expect(screen.getByTestId('bugun-bulgu').textContent).toContain('1 online randevu onay bekliyor.'))
  })

  it('W10-1 Ö6: bekleyen talepler yalnız bugünü değil önümüzdeki 14 günü sayar (en az 3 saat sonrası istendiği için çoğu sonraki günlerde)', async () => {
    pendingRows = [
      row('a4', 'p2', 'Elif Tan', '15:00', '16:00', 'pending', { unverified: true, customerId: null }),
      { ...row('f1', 'p1', 'Derya Aksoy', '10:00', '11:00', 'pending', { unverified: true, customerId: null }), startTime: new Date('2026-10-30T10:00:00+03:00').toISOString(), endTime: new Date('2026-10-30T11:00:00+03:00').toISOString() },
    ]
    mount()
    const banner = await screen.findByTestId('bugun-bulgu')
    expect(banner.textContent).toContain('2 online randevu onay bekliyor.')
    expect(banner.textContent).toContain('Müşteri f1')
    const call = request.mock.calls.find(([p, i]) => String(p).endsWith('/appointments') && i?.query?.status === 'pending')!
    expect(call[1].query).toEqual({ dateFrom: '2026-10-28', dateTo: '2026-11-11', status: 'pending' })
  })

  it('K-yetki: onay izni olmayan kullanıcıda şerit ve onay eylemi çizilmez', async () => {
    const me = makeMe('owner')
    mount({ ...me, permissions: permissionsFor('owner').filter((p) => p !== 'appointment.approve') })
    await screen.findByTestId('doluluk-seridi')
    expect(screen.queryByTestId('bugun-bulgu')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Gözden geçir' })).toBeNull()
  })

  it('K-başlat: onaylı randevuda Başlat durumu devam ediyor yapar ve listeyi yeniler', async () => {
    mount()
    const next = await screen.findByRole('region', { name: 'Şimdi ve sırada' })
    fireEvent.click(within(next).getByRole('button', { name: 'Başlat' }))
    await waitFor(() => expect(callTo('/a3/status')).toBeDefined())
    expect(callTo('/a3/status')![1]).toMatchObject({ method: 'PATCH', body: { status: 'in_progress' } })
    await waitFor(() => expect(request.mock.calls.filter(([p, i]) => String(p).endsWith('/appointments') && !i?.method && !i?.query?.status).length).toBe(2))
  })

  it('K-hata: randevular yüklenemezse blok içi hata, son başarılı yükleme ve sahte kasa sıfırı olmaz', async () => {
    appointmentsError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect(await screen.findByText('Bugünün randevuları yüklenemedi.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeTruthy()
    expect(screen.queryByText(/₺0/)).toBeNull()
  })

  it('K-boş: randevu yokken ilk kurulum listesi ve gerçek yüzde görünür', async () => {
    appointments = []
    services = []
    mount()
    const setup = await screen.findByTestId('ilk-kurulum')
    const bar = within(setup).getByRole('progressbar', { name: 'Kurulum ilerlemesi' })
    // salon tamam, hizmet yok, personel var (2 kişi), ilk randevu yok -> 2/4
    expect(bar.getAttribute('aria-valuenow')).toBe('2')
    expect(bar.getAttribute('aria-valuemax')).toBe('4')
    expect(within(setup).getByRole('link', { name: /Hizmetleri ekleyin/ }).getAttribute('href')).toBe('/panel/defne/hizmetler')
    expect(screen.getByText('Bugün randevu yok.')).toBeTruthy()
  })

  it('K-boş: kurulum tamamsa liste gösterilmez, yalnız boş durum görünür', async () => {
    appointments = []
    mount()
    await screen.findByText('Bugün randevu yok.')
    expect(screen.queryByTestId('ilk-kurulum')).toBeNull()
  })

  it('K-ilk-randevu: boş durumdaki eylem randevu oluşturma ekranına gider', async () => {
    appointments = []
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Randevu oluştur' }))
    expect(push).toHaveBeenCalledWith('/panel/defne/takvim?yeni=1')
  })

  it('K-özet: gelir iznine sahip kullanıcı günün özetini görür; dönem değişince dönem istenir', async () => {
    mount()
    const summary = await screen.findByRole('region', { name: 'Günün özeti' })
    await within(summary).findByText('₺3.200')
    expect(callTo('/dashboard')![1].query).toEqual({ period: 'today' })
    fireEvent.click(within(summary).getByRole('radio', { name: 'Bu hafta' }))
    await waitFor(() => expect(request.mock.calls.some(([p, i]) => String(p).endsWith('/dashboard') && i?.query?.period === 'week')).toBe(true))
  })

  it('K-özet-yetki: gelir izni yoksa özet istenmez ve çizilmez', async () => {
    const me = makeMe('owner')
    mount({ ...me, permissions: permissionsFor('owner').filter((p) => p !== 'dashboard.revenue') })
    await screen.findByTestId('doluluk-seridi')
    expect(screen.queryByRole('region', { name: 'Günün özeti' })).toBeNull()
    expect(callTo('/dashboard')).toBeUndefined()
  })

  it('W10-1 K1: hafta özeti yüklenemezse bugünün tutarı hafta etiketiyle gösterilmez; blok içi hata çıkar', async () => {
    weekDashboardError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    const summary = await screen.findByRole('region', { name: 'Günün özeti' })
    await within(summary).findByText('₺3.200')
    fireEvent.click(within(summary).getByRole('radio', { name: 'Bu hafta' }))
    expect(await within(summary).findByText('Günün özeti yüklenemedi.')).toBeTruthy()
    expect(within(summary).queryByText('₺3.200')).toBeNull()
  })

  it('W10-1 Ö1: personel listesi yüklenemezse sonsuz iskelet yerine hata ve Yeniden dene çıkar', async () => {
    staffError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect(await screen.findByText('Personel listesi yüklenemedi.')).toBeTruthy()
    staffError = null
    fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }))
    await screen.findByTestId('doluluk-seridi')
  })

  it('K-uzman: uzman rolü Günüm ekranına yönlendirilir, Bugün verisi istenmez', async () => {
    mount(makeMe('staff'))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/defne/gunum'))
    expect(callTo('/appointments')).toBeUndefined()
  })
})
