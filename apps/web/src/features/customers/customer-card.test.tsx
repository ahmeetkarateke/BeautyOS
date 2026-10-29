import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { CustomerCardScreen } from './customer-card'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
let card: unknown
let cardError: ApiError | null
let anamnesis: unknown
let anamnesisError: ApiError | null

const baseCard = {
  id: 'c1',
  fullName: 'Ayşe Demir',
  phone: '+905321234567',
  email: 'ayse@ornek.com',
  birthDate: '1990-05-17T00:00:00.000Z',
  preferenceNotes: 'Sıcak su',
  totalVisits: 4,
  lifetimeValue: 3400,
  segment: null,
  lastVisitAt: '2026-10-20T09:00:00.000Z',
  marketingConsentSms: true,
  marketingConsentEmail: false,
  appointments: [
    {
      id: 'a1',
      startTime: '2026-10-20T09:00:00.000Z',
      endTime: '2026-10-20T09:45:00.000Z',
      status: 'completed',
      priceCharged: 850,
      serviceName: 'Fön',
      staffName: 'Derya Aksoy',
    },
    {
      id: 'a2',
      startTime: '2026-10-10T09:00:00.000Z',
      endTime: '2026-10-10T09:45:00.000Z',
      status: 'cancelled',
      priceCharged: 500,
      serviceName: 'Boya',
      staffName: 'Elif Tan',
    },
  ],
}

// Radix sekmesi fare basışında (mousedown) etkinleşir; click değil.
const openTab = (tab: HTMLElement) => fireEvent.mouseDown(tab, { button: 0, ctrlKey: false })

function mount(me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <CustomerCardScreen customerId="c1" />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}

beforeEach(() => {
  request.mockReset()
  card = baseCard
  cardError = null
  anamnesisError = null
  anamnesis = {
    questions: [
      { id: 'q1', label: 'Alerjiniz var mı?', type: 'yes_no', order: 1 },
      { id: 'q2', label: 'Kullandığınız ilaçlar', type: 'short_text', order: 2 },
      { id: 'q3', label: 'Hamilelik', type: 'yes_no', order: 3 },
    ],
    answers: [
      { questionId: 'q1', value: true },
      { questionId: 'q2', value: null },
    ],
  }
  request.mockImplementation(async (path: string) => {
    if (path.endsWith('/anamnesis')) {
      if (anamnesisError) throw anamnesisError
      return anamnesis
    }
    if (cardError) throw cardError
    return card
  })
})
afterEach(cleanup)

describe('W18 Müşteri kartı', () => {
  it('K1: başlık, özet, Ara/WhatsApp/Düzenle ve Genel sekmesi (telefon, e-posta, doğum tarihi, not, kampanya)', async () => {
    mount()
    expect((await screen.findByRole('heading', { level: 1, name: 'Ayşe Demir' })).textContent).toBe('Ayşe Demir')
    expect(screen.getByText('₺3.400')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ara: Ayşe Demir' }).getAttribute('href')).toBe('tel:+905321234567')
    expect(screen.getByRole('link', { name: 'WhatsApp: Ayşe Demir' }).getAttribute('href')).toBe('https://wa.me/905321234567')
    expect(screen.getByRole('link', { name: 'Düzenle' }).getAttribute('href')).toBe('/panel/defne/musteri/c1/duzenle')
    const general = screen.getByRole('tabpanel')
    expect(general.textContent).toContain('ayse@ornek.com')
    expect(general.textContent).toContain('17 Mayıs 1990')
    expect(general.textContent).toContain('Sıcak su')
    expect(general.textContent).toContain('İzin verdi')
  })

  it('K2: telefonu olmayan kartta Ara ve WhatsApp yoktur, "Telefon yok" yazar', async () => {
    card = { ...baseCard, phone: null }
    mount()
    await screen.findByRole('heading', { level: 1, name: 'Ayşe Demir' })
    expect(screen.queryByRole('link', { name: /^Ara:/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /^WhatsApp:/ })).toBeNull()
    expect(screen.getByRole('tabpanel').textContent).toContain('Telefon yok')
  })

  it('K3: Randevular sekmesi son randevuları durumla listeler; iptal edilenin tutarı üstü çizili', async () => {
    mount()
    openTab(await screen.findByRole('tab', { name: 'Randevular' }))
    const list = await screen.findByRole('list', { name: 'Randevular' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(list.textContent).toContain('Fön · Derya Aksoy')
    expect(within(list).getByText('₺500').className).toContain('line-through')
  })

  it('K4: randevusu olmayan müşteride boş durum yazar', async () => {
    card = { ...baseCard, appointments: [] }
    mount()
    openTab(await screen.findByRole('tab', { name: 'Randevular' }))
    expect(await screen.findByText('Henüz randevu yok.')).toBeTruthy()
  })

  it('K5 (R9): sağlık izni olan rolde Sağlık bilgileri sekmesi alerji notu ve anamnez yanıtlarıyla görünür', async () => {
    card = { ...baseCard, allergyNotes: 'Penisilin' }
    mount()
    openTab(await screen.findByRole('tab', { name: 'Sağlık bilgileri' }))
    const panel = await screen.findByText('Alerjiniz var mı?')
    expect(panel).toBeTruthy()
    const text = screen.getByRole('tabpanel').textContent ?? ''
    expect(text).toContain('Penisilin')
    expect(text).toContain('Evet')
    expect(text).toContain('Yanıtlanmadı')
  })

  it('K6 (R9): sağlık izni olmayan rolde (resepsiyon) sekme hiç yoktur ve anamnez isteği atılmaz', async () => {
    mount(makeMe('receptionist'))
    await screen.findByRole('heading', { level: 1, name: 'Ayşe Demir' })
    expect(screen.queryByRole('tab', { name: 'Sağlık bilgileri' })).toBeNull()
    expect(request.mock.calls.some(([p]) => String(p).endsWith('/anamnesis'))).toBe(false)
  })

  it('K7: anamnez yüklenemezse hata ve Yeniden dene; sessiz boşluk yok', async () => {
    anamnesisError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    openTab(await screen.findByRole('tab', { name: 'Sağlık bilgileri' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Sağlık bilgileri yüklenemedi.')
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeTruthy()
  })

  it('K8: soru tanımlı değilse açıklayıcı metin yazar', async () => {
    anamnesis = { questions: [], answers: [] }
    mount()
    openTab(await screen.findByRole('tab', { name: 'Sağlık bilgileri' }))
    expect(await screen.findByText(/Müşteri formu soruları tanımlı değil/)).toBeTruthy()
  })

  it('K9: kayıt yoksa ya da erişim yoksa (404) açıklayıcı boş durum + listeye dön', async () => {
    cardError = new ApiError({ status: 404, code: 'NOT_FOUND' })
    mount()
    expect(await screen.findByText('Müşteri bulunamadı.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Müşteriler listesine dön' }).getAttribute('href')).toBe('/panel/defne/musteriler')
  })

  it('K10: yükleme hatası ErrorState + Yeniden dene; yeniden deneyince kart gelir', async () => {
    cardError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('Müşteri kartı yüklenemedi.')
    cardError = null
    fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }))
    await screen.findByRole('heading', { level: 1, name: 'Ayşe Demir' })
  })

  it('K11: yükleniyor durumunda iskelet görünür', () => {
    request.mockImplementation(() => new Promise(() => {}))
    mount()
    expect(screen.getAllByText('Yükleniyor…').length).toBeGreaterThan(0)
  })

  it('K12: telefonu olmayan Telegram müşterisinde ad uzun/boşluksuz olsa da başlık taşmaz (overflow-wrap)', async () => {
    card = { ...baseCard, fullName: 'A'.repeat(80) }
    mount()
    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading.className).toContain('[overflow-wrap:anywhere]')
  })

  it('K13: uzmanın düzenleme izni yoksa Düzenle bağlantısı çıkmaz', async () => {
    mount({ ...makeMe('staff'), staffId: 's1' })
    await screen.findByRole('heading', { level: 1, name: 'Ayşe Demir' })
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Düzenle' })).toBeNull())
  })
})
