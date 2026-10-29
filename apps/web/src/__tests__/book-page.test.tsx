import { Suspense } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PublicBookingPage from '../app/(legacy)/book/[slug]/page'

// S2-K6: eski /book sayfasi bookingMode'a gore telefon kodu adimini atlar ve durust metni gosterir.
const tenantBase = {
  name: 'Salon',
  publicBookingEnabled: true,
  address: null,
  phone: null,
  whatsappNumber: null,
  mapsUrl: null,
  workingHours: null,
  brandColor: null,
  logoUrl: null,
  coverUrl: null,
  aboutText: null,
}

function mockApi(bookingMode: string | undefined, bookResponse: object = {}) {
  const bookBodies: unknown[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
    if (url.endsWith('/public/tenant')) return json({ ...tenantBase, ...(bookingMode ? { bookingMode } : {}) })
    if (url.endsWith('/public/services')) return json({ data: [{ id: 's1', name: 'Manikür', durationMinutes: 30, category: null }] })
    if (url.includes('/public/staff')) return json({ data: [] })
    if (url.includes('/public/slots')) return json({ slots: [{ id: '2030-01-01T10:00:00Z', label: '10:00', available: true, staffId: 'p1' }] })
    if (url.endsWith('/public/book')) {
      bookBodies.push(JSON.parse(String(init?.body)))
      return json({ referenceCode: 'RDV-1', approvalRequired: true, ...bookResponse }, 201)
    }
    return json({}, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { bookBodies }
}

async function renderToContactStep() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Suspense fallback={null}>
        <PublicBookingPage params={fulfilled({ slug: 'salon' })} />
      </Suspense>
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.click(await screen.findByText('Manikür'))
  await user.click(await screen.findByText('Fark etmez'))
  await user.click(await screen.findByRole('button', { name: /Saatleri Gör/ }))
  await user.click(await screen.findByRole('button', { name: '10:00' }))
  await screen.findByText('İletişim Bilgileri')
  return user
}

beforeEach(() => {
  vi.unstubAllGlobals()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('S2-K6: /book sayfasi bookingMode', () => {
  it('approval_required: kod gonder dugmesi yok, dogrulamasiz gonderilebilir ve dusuk metin durust', async () => {
    const { bookBodies } = mockApi('approval_required')
    const user = await renderToContactStep()

    expect(screen.queryByRole('button', { name: /Kod Gönder/ })).toBeNull()
    expect(screen.getByText(/Talebiniz salona iletilir\. Salon onayladığında kesinleşir/)).toBeTruthy()

    await user.type(screen.getByPlaceholderText('Ad Soyad'), 'Ayşe Yılmaz')
    await user.type(screen.getByPlaceholderText(/Telefon/), '05551112233')
    await user.click(screen.getByRole('button', { name: /Randevu Talebini Gönder/ }))

    await waitFor(() => expect(bookBodies).toHaveLength(1))
    expect(bookBodies[0]).toMatchObject({ customerName: 'Ayşe Yılmaz', customerPhone: '05551112233' })
    expect(bookBodies[0]).not.toHaveProperty('notes')
    expect(await screen.findByText(/Talebiniz salona iletildi\. Salon onayladığında kesinleşir/)).toBeTruthy()
    expect(screen.queryByText(/size haber verilecek/)).toBeNull()
  })

  it('verified: kod adimi korunur, dogrulanmadan gonder dugmesi kapali', async () => {
    mockApi('verified')
    const user = await renderToContactStep()

    expect(screen.getByRole('button', { name: /Kod Gönder/ })).toBeTruthy()
    await user.type(screen.getByPlaceholderText('Ad Soyad'), 'Ayşe Yılmaz')
    await user.type(screen.getByPlaceholderText(/Telefon/), '05551112233')
    expect((screen.getByRole('button', { name: /Randevu Talebini Gönder/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('bookingMode donmeyen eski API: kod adimi korunur (guvenli varsayilan)', async () => {
    mockApi(undefined)
    await renderToContactStep()
    expect(screen.getByRole('button', { name: /Kod Gönder/ })).toBeTruthy()
  })
})

// React 19 use(): onceden cozulmus isaretli thenable askiya almadan okunur.
function fulfilled<T>(value: T): Promise<T> {
  return Object.assign(Promise.resolve(value), { status: 'fulfilled' as const, value })
}
