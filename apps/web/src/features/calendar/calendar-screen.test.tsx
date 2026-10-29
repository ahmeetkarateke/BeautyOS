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
import { CalendarScreen } from './calendar-screen'
import '@/ui/test-polyfills'

const push = vi.fn()
const replace = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/panel/defne/takvim',
  useSearchParams: () => new URLSearchParams(search),
}))

let desktop = false
function stubMedia() {
  window.matchMedia = ((query: string) => ({
    matches: desktop && query.includes('min-width'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const request = vi.fn()
const client = { request } as unknown as ApiClient
const NOW = new Date('2026-10-28T11:30:00+03:00')

const row = (id: string, staffId: string, staffName: string, from: string, to: string, status: string, day = '2026-10-28', extra: Record<string, unknown> = {}) => ({
  id, staffId, staffName, customerId: `c-${id}`, serviceId: 'sv1', customerName: `Müşteri ${id}`, customerPhone: '0532 000 00 00', serviceName: 'Fön',
  startTime: new Date(`${day}T${from}:00+03:00`).toISOString(), endTime: new Date(`${day}T${to}:00+03:00`).toISOString(), durationMinutes: 45, status, priceCharged: 500, ...extra,
})
const staffData = {
  data: [
    { id: 'p1', fullName: 'Derya Aksoy', title: 'Kuaför', skills: [{ serviceId: 'sv1' }] },
    { id: 'p2', fullName: 'Elif Tan', title: 'Estetisyen', skills: [{ serviceId: 'sv1' }] },
  ],
}
let rows: unknown[] = []
let listError: ApiError | null = null
let staffError: ApiError | null = null
let staffPayload: unknown = staffData

function mount(me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <CalendarScreen now={NOW} />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const apptCalls = () => request.mock.calls.filter(([p, i]) => String(p).endsWith('/appointments') && !i?.method)

beforeEach(() => {
  request.mockReset()
  push.mockReset()
  replace.mockReset()
  search = ''
  desktop = false
  listError = null
  staffError = null
  staffPayload = staffData
  stubMedia()
  rows = [
    row('a1', 'p1', 'Derya Aksoy', '10:00', '11:00', 'confirmed'),
    row('a2', 'p2', 'Elif Tan', '10:30', '11:15', 'in_progress'),
    row('a3', 'p1', 'Derya Aksoy', '14:00', '14:30', 'pending', '2026-10-28', { unverified: true, customerId: null }),
    row('a4', 'p1', 'Derya Aksoy', '10:00', '10:45', 'completed', '2026-10-29'),
  ]
  request.mockImplementation(async (path: string, init?: { query?: Record<string, string> }) => {
    if (path.endsWith('/appointments')) {
      if (listError) throw listError
      const q = init?.query ?? {}
      const from = q.dateFrom ?? q.date
      const to = q.dateTo ?? q.date
      const inRange = (rows as ReturnType<typeof row>[]).filter((r) => {
        const d = r.startTime.slice(0, 10)
        return (!from || d >= from) && (!to || d <= to) && (!q.staffId || r.staffId === q.staffId)
      })
      return { data: inRange }
    }
    if (path.endsWith('/staff')) {
      if (staffError) throw staffError
      return staffPayload
    }
    throw new Error(`beklenmeyen çağrı ${path}`)
  })
})
afterEach(cleanup)

describe('W12 Takvim', () => {
  it('K-yükleniyor: başlık ve iskelet görünür', () => {
    mount()
    expect(screen.getByRole('heading', { level: 1, name: 'Takvim' })).toBeTruthy()
    expect(screen.getAllByText('Yükleniyor…').length).toBeGreaterThan(0)
  })

  it('K-aralık: gün görünümü İstanbul gününü dateFrom=dateTo olarak ister; hafta ve ay aralığı görünüme göre', async () => {
    mount()
    await screen.findByTestId('randevu-a1')
    expect(apptCalls()[0][1].query).toEqual({ dateFrom: '2026-10-28', dateTo: '2026-10-28' })
    cleanup()
    request.mockClear()
    desktop = true
    search = 'gorunum=hafta'
    mount()
    await screen.findByRole('table', { name: /Haftalık özet/ })
    expect(apptCalls()[0][1].query).toEqual({ dateFrom: '2026-10-26', dateTo: '2026-11-01' })
    cleanup()
    request.mockClear()
    search = 'gorunum=ay&tarih=2026-10-15'
    mount()
    await screen.findByRole('group', { name: 'Ay görünümü' })
    expect(apptCalls()[0][1].query).toEqual({ dateFrom: '2026-10-01', dateTo: '2026-10-31' })
  })

  it('K-telefon: saat çizelgesi randevuları saatine göre gruplar; personel çipi süzer', async () => {
    mount()
    const timeline = await screen.findByRole('region', { name: 'Saat çizelgesi' })
    expect(within(timeline).getByTestId('randevu-a1')).toBeTruthy()
    expect(within(timeline).getByTestId('randevu-a2')).toBeTruthy()
    fireEvent.click(within(screen.getByRole('group', { name: 'Personel' })).getByRole('button', { name: /^Elif/ }))
    expect(within(timeline).queryByTestId('randevu-a1')).toBeNull()
    expect(within(timeline).getByTestId('randevu-a2')).toBeTruthy()
  })

  it('K-telefon: durum süzgeci yalnız seçilen durumu gösterir', async () => {
    mount()
    const timeline = await screen.findByRole('region', { name: 'Saat çizelgesi' })
    fireEvent.change(screen.getByLabelText('Durum'), { target: { value: 'pending' } })
    expect(within(timeline).getByTestId('randevu-a3')).toBeTruthy()
    expect(within(timeline).queryByTestId('randevu-a1')).toBeNull()
  })

  it('K-telefon: haftalık ve aylık görünüm telefonda gösterilmez, gün görünümüne düşer', async () => {
    search = 'gorunum=ay'
    mount()
    await screen.findByRole('region', { name: 'Saat çizelgesi' })
    expect(screen.queryByRole('group', { name: 'Ay görünümü' })).toBeNull()
    expect(apptCalls()[0][1].query).toEqual({ dateFrom: '2026-10-28', dateTo: '2026-10-28' })
  })

  it('K-masaüstü: personel sütunları randevu sayısıyla; randevu konumu 72 px/saat ile hesaplanır', async () => {
    desktop = true
    mount()
    const grid = await screen.findByRole('group', { name: 'Günlük takvim' })
    expect(within(grid).getByRole('heading', { name: /Derya/ }).textContent).toContain('2 randevu')
    // Şerit 09:00 başlar; a1 10:00 -> (60 dk / 60) * 72 + 1 = 73 px, yükseklik 72 - 3 = 69
    const event = within(grid).getByRole('button', { name: /10:00 – 11:00, Müşteri a1/ })
    expect(event.style.top).toBe('73px')
    expect(event.style.height).toBe('69px')
  })

  it('K-masaüstü: örtüşen randevular aynı sütunda yan yana şeritlere bölünür', async () => {
    desktop = true
    rows = [row('x', 'p1', 'Derya Aksoy', '10:00', '11:00', 'confirmed'), row('y', 'p1', 'Derya Aksoy', '10:30', '11:30', 'confirmed')]
    mount()
    const grid = await screen.findByRole('group', { name: 'Günlük takvim' })
    const x = within(grid).getByRole('button', { name: /Müşteri x/ })
    const y = within(grid).getByRole('button', { name: /Müşteri y/ })
    expect(x.style.left).toBe('0%')
    expect(y.style.left).toBe('50%')
  })

  it('K-masaüstü: boş dilime tıklamak o kişi, saat ve gün ile randevu oluşturmayı açar (15 dk)', async () => {
    desktop = true
    mount()
    const grid = await screen.findByRole('group', { name: 'Günlük takvim' })
    const slot = grid.querySelector('[data-slot="p2-10:15"]') as HTMLElement
    expect(slot).toBeTruthy()
    fireEvent.click(slot)
    expect(push).toHaveBeenCalledWith('/panel/defne/takvim?yeni=1&personel=p2&saat=10%3A15&tarih=2026-10-28')
  })

  it('K-hafta: haftalık özet personel x gün sayısını verir, gün başlığı o günün görünümüne bağlanır', async () => {
    desktop = true
    search = 'gorunum=hafta'
    mount()
    const table = await screen.findByRole('table', { name: /Haftalık özet/ })
    const derya = within(table).getByRole('row', { name: /Derya/ })
    const cells = within(derya).getAllByRole('cell').map((c) => c.textContent)
    // Pzt 26 .. Paz 1: Çar 28 -> 2 (a1, a3), Per 29 -> 1 (a4)
    expect(cells).toEqual(['0', '0', '2', '1', '0', '0', '0'])
    expect(within(table).getByRole('link', { name: /28/ }).getAttribute('href')).toContain('tarih=2026-10-28')
  })

  it('K-ay: ay görünümünde gün hücresi randevu sayısını söyler ve güne bağlanır', async () => {
    desktop = true
    search = 'gorunum=ay'
    mount()
    const month = await screen.findByRole('group', { name: 'Ay görünümü' })
    const cell = within(month).getByRole('link', { name: /28 Ekim.*3 randevu/ })
    expect(cell.getAttribute('href')).toContain('tarih=2026-10-28')
    // axe label-content-name-mismatch: aria-label görünür metinle çelişmesin; ad içerikten gelir.
    expect(within(month).getAllByRole('link').every((link) => !link.hasAttribute('aria-label'))).toBe(true)
  })

  it('K-gezinme: sonraki gün ve bugün düğmeleri adresi günceller', async () => {
    mount()
    await screen.findByTestId('randevu-a1')
    fireEvent.click(screen.getByRole('button', { name: 'Sonraki gün' }))
    expect(replace).toHaveBeenCalledWith('/panel/defne/takvim?tarih=2026-10-29')
    search = 'tarih=2026-10-29'
    cleanup()
    mount()
    await screen.findByRole('region', { name: 'Saat çizelgesi' })
    fireEvent.click(screen.getByRole('button', { name: 'Bugün' }))
    expect(replace).toHaveBeenLastCalledWith('/panel/defne/takvim')
  })

  it('K-adres: geçersiz tarih ve görünüm parametresi bugüne ve gün görünümüne düşer', async () => {
    search = 'tarih=2026-02-30&gorunum=%3Cscript%3E'
    mount()
    await screen.findByTestId('randevu-a1')
    expect(apptCalls()[0][1].query).toEqual({ dateFrom: '2026-10-28', dateTo: '2026-10-28' })
  })

  it('K-uzman: uzman yalnız kendi randevusunu ister, başlık Takvimim, personel çipleri yok', async () => {
    rows = [row('e1', 's1', 'Elif Demir', '10:00', '11:00', 'confirmed')]
    mount(makeMe('staff'))
    expect(screen.getByRole('heading', { level: 1, name: 'Takvimim' })).toBeTruthy()
    await screen.findByRole('region', { name: 'Saat çizelgesi' })
    expect(apptCalls()[0][1].query).toMatchObject({ staffId: 's1' })
    expect(screen.queryByRole('group', { name: 'Personel' })).toBeNull()
  })

  it('K-boş: gün boşken "Bu gün için randevu yok." ve Randevu oluştur eylemi görünür', async () => {
    rows = []
    mount()
    expect(await screen.findByText('Bu gün için randevu yok.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Randevu oluştur' }))
    expect(push).toHaveBeenCalledWith('/panel/defne/takvim?yeni=1&tarih=2026-10-28')
  })

  it('K-hata: liste yüklenemezse blok içi hata ve Yeniden dene; eski gün verisi gösterilmez', async () => {
    listError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect(await screen.findByText('Takvim yüklenemedi.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeTruthy()
    expect(screen.queryByTestId('randevu-a1')).toBeNull()
  })

  it('K-onay: onay izni olan kullanıcıda bekleyen randevuya tıklamak onay katmanını açar', async () => {
    mount()
    fireEvent.click(await screen.findByTestId('randevu-a3'))
    expect(await screen.findByRole('dialog', { name: 'Online randevu talebi' })).toBeTruthy()
  })

  it('K-ayrıntı: onay izni olmayan kullanıcıda randevuya tıklamak salt okunur ayrıntıyı açar', async () => {
    const me = makeMe('owner')
    mount({ ...me, permissions: permissionsFor('owner').filter((p) => p !== 'appointment.approve') })
    fireEvent.click(await screen.findByTestId('randevu-a3'))
    const dialog = await screen.findByRole('dialog', { name: 'Randevu ayrıntısı' })
    expect(dialog.textContent).toContain('Müşteri a3')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Online randevu talebi' })).toBeNull())
  })
})

describe('W13 takvimden randevu oluşturma', () => {
  it('?yeni=1 adresi Randevu oluştur katmanını açar; kapatınca yeni parametresi adresten kalkar', async () => {
    search = 'yeni=1&tarih=2026-10-28'
    mount()
    const dialog = await screen.findByRole('dialog', { name: 'Randevu oluştur' })
    expect(dialog).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kapat' }))
    await waitFor(() => expect(replace).toHaveBeenCalled())
    expect(String(replace.mock.calls.at(-1)![0])).not.toContain('yeni=1')
  })

  it('yeni parametresi yokken katman açılmaz', async () => {
    mount()
    await screen.findByTestId('randevu-a1')
    expect(screen.queryByRole('dialog', { name: 'Randevu oluştur' })).toBeNull()
  })
})

describe('W12-1 Önemli: sessiz randevu kaybı olmaz', () => {

describe('W12 erişilebilirlik (kabul H1/H2)', () => {
  it('gün şeridi düğmeleri aria-label taşımaz; ad gizli metinden gelir ve görünür metin soluk opaklıkla çizilmez', async () => {
    mount()
    await screen.findByTestId('randevu-a1')
    const strip = screen.getByRole('group', { name: 'Gün seçin' })
    const buttons = within(strip).getAllByRole('button')
    expect(buttons.every((b) => !b.hasAttribute('aria-label'))).toBe(true)
    expect(within(strip).getByRole('button', { name: 'Çar 28' })).toBeTruthy()
    expect(strip.innerHTML).not.toContain('opacity-75')
  })
})

describe('W13 takvimden: sessiz randevu kaybı olmaz', () => {
  it('masaüstünde personel listesi hata verirse hata ve Yeniden dene görünür; boş ızgara çizilmez', async () => {
    desktop = true
    staffError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect(await screen.findByText('Personel listesi yüklenemedi.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Günlük takvim' })).toBeNull()
  })

  it('hizmet ataması kaldırılmış personelin randevusu ızgarada kendi sütunuyla görünür', async () => {
    desktop = true
    staffPayload = {
      data: [
        { id: 'p1', fullName: 'Derya Aksoy', title: 'Kuaför', skills: [{ serviceId: 'sv1' }] },
        { id: 'p2', fullName: 'Elif Tan', title: 'Estetisyen', skills: [] },
      ],
    }
    mount()
    const grid = await screen.findByRole('group', { name: 'Günlük takvim' })
    expect(within(grid).getByRole('heading', { name: /Elif/ })).toBeTruthy()
    expect(within(grid).getByRole('button', { name: /Müşteri a2/ })).toBeTruthy()
  })

  it('listede hiç olmayan (silinmiş) personelin randevusu da çizilir', async () => {
    desktop = true
    rows = [row('z1', 'p9', 'Silinmiş Kişi', '10:00', '11:00', 'confirmed')]
    mount()
    const grid = await screen.findByRole('group', { name: 'Günlük takvim' })
    expect(within(grid).getByRole('button', { name: /Müşteri z1/ })).toBeTruthy()
  })

  it('uzmanın personel profili bağlı değilse sonsuz iskelet yerine açıklama görünür', async () => {
    mount({ ...makeMe('staff'), staffId: null })
    expect(await screen.findByText('Uzman profiliniz bağlı değil.')).toBeTruthy()
  })
})
