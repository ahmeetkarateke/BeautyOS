import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { CalendarScreen } from './calendar-screen'
import { UNDO_FAILED_TAKEN } from './use-appointment-move'
import '@/ui/test-polyfills'

// W15 sürükle-bırak: fare olayları jsdom'da dnd-kit'in MouseSensor'ünü gerçekten sürer (1 saat = 72 px).
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/panel/defne/takvim',
  useSearchParams: () => new URLSearchParams(''),
}))

window.matchMedia = ((query: string) => ({
  matches: query.includes('min-width'),
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  onchange: null,
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia

const request = vi.fn()
const client = { request } as unknown as ApiClient
const NOW = new Date('2026-10-28T11:30:00+03:00')
const iso = (hhmm: string) => new Date(`2026-10-28T${hhmm}:00+03:00`).toISOString()

const row = (id: string, staffId: string, staffName: string, from: string, to: string, status: string) => ({
  id,
  staffId,
  staffName,
  customerId: `c-${id}`,
  serviceId: 'sv1',
  customerName: `Müşteri ${id}`,
  customerPhone: '0532 000 00 00',
  serviceName: 'Fön',
  startTime: iso(from),
  endTime: iso(to),
  durationMinutes: 45,
  status,
  priceCharged: 500,
})
const staffData = {
  data: [
    {
      id: 'p1',
      fullName: 'Derya Aksoy',
      title: 'Kuaför',
      skills: [{ serviceId: 'sv1' }],
    },
  ],
}

let patchError: ApiError | null = null
let rows: ReturnType<typeof row>[] = []
const patches = () => request.mock.calls.filter(([, init]) => init?.method === 'PATCH')

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

async function eventOf(id: string) {
  const grid = await screen.findByRole('group', { name: 'Günlük takvim' })
  await waitFor(() => expect(grid.querySelector(`[data-event-id="${id}"]`)).toBeTruthy())
  return grid.querySelector(`[data-event-id="${id}"]`) as HTMLElement
}

/** dnd-kit, bırakmadan sonra 50 ms boyunca tıklamaları bastırır (sürüklemeyi tıklama sanmasın); gerçek kullanıcı bundan hızlı tıklayamaz. */
const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 80))
  })

/** Fareyle basar, `dy` piksel dikey sürükler; bırakmadan önce `between` çağrılır. */
function drag(el: HTMLElement, dy: number, opts: { release?: boolean } = {}) {
  fireEvent.mouseDown(el, { clientX: 10, clientY: 200, button: 0 })
  // dnd-kit ilk harekette yalnız etkinleşir (eşik aşıldı); konum ikinci harekette işlenir.
  fireEvent.mouseMove(document, {
    clientX: 10,
    clientY: 200 + Math.sign(dy) * 8,
  })
  fireEvent.mouseMove(document, { clientX: 10, clientY: 200 + dy })
  if (opts.release !== false) fireEvent.mouseUp(document, { clientX: 10, clientY: 200 + dy })
}

beforeEach(() => {
  request.mockReset()
  push.mockReset()
  patchError = null
  rows = [
    row('a1', 'p1', 'Derya Aksoy', '14:00', '14:45', 'confirmed'),
    row('a2', 'p1', 'Derya Aksoy', '10:00', '10:45', 'confirmed'),
    row('a3', 'p1', 'Derya Aksoy', '16:00', '16:45', 'completed'),
    row('a4', 'p1', 'Derya Aksoy', '12:00', '12:45', 'in_progress'),
  ]
  request.mockImplementation(async (path: string, init?: { method?: string; body?: { startAt: string } }) => {
    if (init?.method === 'PATCH') {
      if (patchError) throw patchError
      // Sunucu gibi: başarıda kayıt yeni saatte kalır (liste yenilemesi yeni yeri döndürür).
      const id = path.split('/').slice(-2)[0]
      const found = rows.find((r) => r.id === id)
      if (found && init.body) {
        const span = Date.parse(found.endTime) - Date.parse(found.startTime)
        found.startTime = init.body.startAt
        found.endTime = new Date(Date.parse(init.body.startAt) + span).toISOString()
      }
      return {}
    }
    if (path.endsWith('/appointments')) return { data: rows }
    if (path.endsWith('/staff')) return staffData
    throw new Error(`beklenmeyen çağrı ${path}`)
  })
})
afterEach(cleanup)

describe('W15 sürükle-bırak', () => {
  it('K1: yalnız ileri tarihli ve kapanmamış randevu sürüklenebilir (geçmiş, devam eden, tamamlanan değil)', async () => {
    mount()
    expect((await eventOf('a1')).dataset.movable).toBe('true')
    expect((await eventOf('a2')).dataset.movable).toBeUndefined()
    expect((await eventOf('a3')).dataset.movable).toBeUndefined()
    expect((await eventOf('a4')).dataset.movable).toBeUndefined()
  })

  it('K2: uzman (saat değiştirme izni yok) hiçbir randevuyu sürükleyemez', async () => {
    mount({ ...makeMe('staff'), staffId: 'p1' })
    expect((await eventOf('a1')).dataset.movable).toBeUndefined()
    fireEvent.mouseDown(await eventOf('a1'), {
      clientX: 10,
      clientY: 200,
      button: 0,
    })
    fireEvent.mouseMove(document, { clientX: 10, clientY: 272 })
    fireEvent.mouseUp(document, { clientX: 10, clientY: 272 })
    expect(patches()).toHaveLength(0)
  })

  it('K3: sürüklerken hedef dilim 15 dk adımla görünür; bırakınca yeni saat sunucuya gider ve "Geri al" bildirimi çıkar', async () => {
    mount()
    const el = await eventOf('a1')
    drag(el, 72, { release: false })
    const ghost = await screen.findByTestId('tasima-hedef')
    expect(ghost.dataset.valid).toBe('true')
    expect(ghost.textContent).toContain('15:00 – 15:45')
    fireEvent.mouseUp(document, { clientX: 10, clientY: 272 })
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(patches()[0][0]).toMatch(/appointments\/a1\/reschedule$/)
    expect(patches()[0][1].body).toEqual({ startAt: iso('15:00') })
    expect(await screen.findByText('Randevu 15:00’e taşındı.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Geri al' })).toBeTruthy()
  })

  it('K4: Geri al, eski başlangıç saatini yeniden gönderir', async () => {
    mount()
    drag(await eventOf('a1'), 72)
    const undoButton = await screen.findByRole('button', { name: 'Geri al' })
    await settle()
    fireEvent.click(undoButton)
    await waitFor(() => expect(patches()).toHaveLength(2))
    expect(patches()[1][1].body).toEqual({ startAt: iso('14:00') })
    expect(await screen.findByText('Taşıma geri alındı.')).toBeTruthy()
  })

  it('K5: SLOT_TAKEN: randevu yerine döner, hata şeridi çıkar, "taşındı" bildirimi çıkmaz', async () => {
    patchError = new ApiError({ status: 409, code: 'SLOT_TAKEN' })
    mount()
    const el = await eventOf('a1')
    drag(el, 72)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Bu saat doldu. Başka bir saat seçin.')
    expect(screen.queryByText(/taşındı\./)).toBeNull()
    await waitFor(() =>
      expect((screen.getByRole('group', { name: 'Günlük takvim' }).querySelector('[data-event-id="a1"]') as HTMLElement).textContent).toMatch(
        /14:00 – 14:45/,
      ),
    )
  })

  it('K5: ağ hatasında da randevu yerine döner ve anlaşılır şerit çıkar (sessiz kayıp yok)', async () => {
    patchError = new ApiError({ status: 0, code: 'NETWORK' })
    mount()
    drag(await eventOf('a1'), 72)
    expect((await screen.findByRole('alert')).textContent).toMatch(/bağlan/i)
    expect(screen.queryByText(/taşındı\./)).toBeNull()
  })

  it('K6: geçmiş bir saate bırakmak istek göndermez; hedef kırmızı, bildirim neden söyler', async () => {
    mount()
    const el = await eventOf('a1')
    drag(el, -3 * 72, { release: false })
    expect((await screen.findByTestId('tasima-hedef')).dataset.valid).toBe('false')
    fireEvent.mouseUp(document, { clientX: 10, clientY: 200 - 216 })
    expect(await screen.findByText('Geçmiş bir saate taşınamaz. Randevuyu ileri bir saate bırakın.')).toBeTruthy()
    expect(patches()).toHaveLength(0)
  })

  it('K7: 6 px altındaki hareket sürükleme değil tıklamadır: istek yok, ayrıntı açılır', async () => {
    mount()
    const el = await eventOf('a1')
    fireEvent.mouseDown(el, { clientX: 10, clientY: 200, button: 0 })
    fireEvent.mouseMove(document, { clientX: 10, clientY: 203 })
    fireEvent.mouseUp(document, { clientX: 10, clientY: 203 })
    await settle()
    fireEvent.click(el)
    expect(patches()).toHaveLength(0)
    expect(await screen.findByRole('dialog', { name: 'Randevu ayrıntısı' })).toBeTruthy()
  })

  it('K8: Geri al sırasında eski saat dolmuşsa nedeni ve çözümü söyleyen şerit çıkar', async () => {
    mount()
    drag(await eventOf('a1'), 72)
    const undo = await screen.findByRole('button', { name: 'Geri al' })
    await settle()
    patchError = new ApiError({ status: 409, code: 'SLOT_TAKEN' })
    fireEvent.click(undo)
    expect((await screen.findByRole('alert')).textContent).toContain(UNDO_FAILED_TAKEN)
  })

  it('K9: klavye karşılığı: randevu düğmesi Enter ile ayrıntıyı açar ve orada Saati değiştir vardır', async () => {
    mount()
    const el = await eventOf('a1')
    expect(el.getAttribute('role')).toBeNull()
    expect(el.getAttribute('aria-describedby')).toBeNull()
    await settle()
    fireEvent.click(el)
    const dialog = await screen.findByRole('dialog', {
      name: 'Randevu ayrıntısı',
    })
    expect(within(dialog).getByRole('button', { name: 'Saati değiştir' })).toBeTruthy()
  })

  it('K10: bırakma sonrası liste yenilemesi gelene dek randevu yeni yerinde kalır (eski yere göz kırpma yok)', async () => {
    mount()
    const el = await eventOf('a1')
    drag(el, 72)
    await screen.findByText('Randevu 15:00’e taşındı.')
    await act(async () => {})
    const now = (screen.getByRole('group', { name: 'Günlük takvim' }).querySelector('[data-event-id="a1"]') as HTMLElement).textContent
    expect(now).toMatch(/15:00 – 15:45/)
  })
})
