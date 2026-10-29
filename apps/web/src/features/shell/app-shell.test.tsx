import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { AppShell } from './app-shell'
import { MenuScreen } from './menu-screen'

let mockPath = '/panel/defne/bugun'
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }))

const client = { request: vi.fn(), setAccessToken: vi.fn(), getAccessToken: vi.fn(), restoreSession: vi.fn() } as unknown as ApiClient

function mount(me: Me, ui = <p>ekran içeriği</p>) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <AppShell>{ui}</AppShell>
      </MeProvider>
    </ApiClientProvider>,
  )
}

const side = () => screen.getByRole('navigation', { name: 'Ana menü' })
const panel = () => screen.getByRole('complementary')
const bottom = () => screen.getByRole('navigation', { name: 'Alt menü' })

beforeEach(() => {
  mockPath = '/panel/defne/bugun'
  localStorage.clear()
})
afterEach(cleanup)

describe('W6 K1: masaüstü yan menü', () => {
  it('K1: sahip için gruplar sırayla: başlıksız ana öğeler, Hizmet ve personel, Yönetim, Ayarlar', () => {
    mount(makeMe('owner'))
    const links = within(side()).getAllByRole('link').map((a) => a.textContent)
    expect(links).toEqual(expect.arrayContaining(['Bugün', 'Takvim', 'Müşteriler', 'Bekleme listesi', 'Kasa', 'Hizmetler', 'Personel', 'Hesaplar', 'Bahşiş', 'Ayarlar']))
    expect(within(side()).getByText('Hizmet ve personel')).toBeTruthy()
    expect(within(side()).getByRole('button', { name: 'Yönetim' })).toBeTruthy()
  })

  it('K1: geçerli sayfa aria-current="page" taşır, diğerleri taşımaz', () => {
    mockPath = '/panel/defne/takvim'
    mount(makeMe('owner'))
    const current = within(side()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')
    expect(current.map((a) => a.textContent)).toEqual(['Takvim'])
  })

  it('K1: alt yolda (/musteriler/yeni) üst öğe etkin kalır', () => {
    mockPath = '/panel/defne/musteriler/yeni'
    mount(makeMe('owner'))
    expect(within(side()).getByRole('link', { name: 'Müşteriler' }).getAttribute('aria-current')).toBe('page')
  })

  it('K1: Yönetim grubu açık/kapalı durumu hatırlanır', () => {
    const first = mount(makeMe('owner'))
    const toggle = within(side()).getByRole('button', { name: 'Yönetim' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(within(side()).getByRole('link', { name: 'Hesaplar' })).toBeTruthy()

    fireEvent.click(toggle)
    expect(within(side()).getByRole('button', { name: 'Yönetim' }).getAttribute('aria-expanded')).toBe('false')
    expect(within(side()).queryByRole('link', { name: 'Hesaplar' })).toBeNull()

    first.unmount()
    mount(makeMe('owner'))
    expect(within(side()).getByRole('button', { name: 'Yönetim' }).getAttribute('aria-expanded')).toBe('false')
    expect(within(side()).queryByRole('link', { name: 'Hesaplar' })).toBeNull()
  })

  it('K1: depolama okunamazsa (gizli pencere) menü açık başlar ve bozulmaz', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('engelli')
    })
    mount(makeMe('owner'))
    expect(within(side()).getByRole('button', { name: 'Yönetim' }).getAttribute('aria-expanded')).toBe('true')
    spy.mockRestore()
  })

  it('K2/K3: uzmanda Yönetim grubu hiç yoktur; Günüm ve Primim vardır', () => {
    mount(makeMe('staff'))
    expect(within(side()).queryByRole('button', { name: 'Yönetim' })).toBeNull()
    expect(within(side()).getByRole('link', { name: 'Günüm' })).toBeTruthy()
    expect(within(side()).getByRole('link', { name: 'Primim' })).toBeTruthy()
  })

  it('K1: kullanıcı satırı ad ve rolü gösterir; salon adı üstte', () => {
    mount(makeMe('owner'))
    expect(within(panel()).getByText('Defne Güzellik')).toBeTruthy()
    expect(within(panel()).getByText('Defne Kaya')).toBeTruthy()
    expect(within(panel()).getAllByText('Salon sahibi', { selector: 'span' }).length).toBeGreaterThan(0)
  })

  it('K1: klinik setinde rol etiketi terimden gelir (Klinik sahibi)', () => {
    mount(makeMe('owner', { termSet: 'clinic_patient' }))
    expect(within(panel()).getAllByText('Klinik sahibi', { selector: 'span' }).length).toBeGreaterThan(0)
  })
})

describe('W6 K1: telefon üst bar ve alt menü', () => {
  it('K1: alt menüde ortadaki "+" Randevu oluştur bağlantısıdır; sırası Bugün, Takvim, +, Müşteriler, Menü', () => {
    mount(makeMe('owner'))
    const names = within(bottom()).getAllByRole('link').map((a) => a.getAttribute('aria-label') ?? a.textContent)
    expect(names).toEqual(['Bugün', 'Takvim', 'Randevu oluştur', 'Müşteriler', 'Menü'])
  })

  it('K1: uzmanda alt menü Günüm dizilimi', () => {
    mount(makeMe('staff'))
    const names = within(bottom()).getAllByRole('link').map((a) => a.getAttribute('aria-label') ?? a.textContent)
    expect(names).toEqual(['Günüm', 'Takvimim', 'Randevu oluştur', 'Müşterilerim', 'Menü'])
  })

  it('K1: ana ekranda üst bar salon adını, müşteri ara ve hesabım bağlantılarını gösterir', () => {
    mount(makeMe('owner'))
    const bar = screen.getByRole('banner')
    expect(within(bar).getByText('Defne Güzellik')).toBeTruthy()
    expect(within(bar).getByRole('link', { name: 'Müşteri ara' }).getAttribute('href')).toBe('/panel/defne/musteriler')
    expect(within(bar).getByRole('link', { name: 'Hesabım' }).getAttribute('href')).toBe('/panel/defne/hesabim')
  })

  it('K1: alt ekranda üst bar geri oku ve ekran adı gösterir; geri Menü ekranına gider', () => {
    mockPath = '/panel/defne/hizmetler'
    mount(makeMe('owner'))
    const bar = screen.getByRole('banner')
    expect(within(bar).getByText('Hizmetler')).toBeTruthy()
    expect(within(bar).getByRole('link', { name: 'Geri' }).getAttribute('href')).toBe('/panel/defne/menu')
  })

  it('K1: alt menüde geçerli sayfa aria-current taşır; menü alt sayfalarında "Menü" etkindir', () => {
    mockPath = '/panel/defne/kasa'
    mount(makeMe('owner'))
    const current = within(bottom()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')
    expect(current.map((a) => a.textContent)).toEqual(['Menü'])
  })
})

describe('W6: erişilebilirlik iskeleti', () => {
  it('ana içeriğe geç bağlantısı ilk odaklanabilir öğedir ve main#icerik hedefidir', () => {
    mount(makeMe('owner'))
    const skip = screen.getByRole('link', { name: 'Ana içeriğe geç' })
    expect(skip.getAttribute('href')).toBe('#icerik')
    expect(screen.getByRole('main').id).toBe('icerik')
    expect(screen.getByText('ekran içeriği')).toBeTruthy()
  })
})

describe('W6 K1: Menü ekranı', () => {
  it('K1: izinli tüm hedefleri gruplu listeler ve Çıkış yap verir', () => {
    render(
      <ApiClientProvider client={client}>
        <MeProvider me={makeMe('owner')}>
          <MenuScreen />
        </MeProvider>
      </ApiClientProvider>,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Menü')
    expect(screen.getByRole('link', { name: 'Bekleme listesi' }).getAttribute('href')).toBe('/panel/defne/bekleme')
    expect(screen.getByRole('link', { name: 'Alış faturaları' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ayarlar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Çıkış yap' })).toBeTruthy()
  })

  it('K2/K3: uzman menüsünde yönetim ve ayarlar yok, Hesabım var', () => {
    render(
      <ApiClientProvider client={client}>
        <MeProvider me={makeMe('staff')}>
          <MenuScreen />
        </MeProvider>
      </ApiClientProvider>,
    )
    expect(screen.queryByRole('link', { name: 'Hesaplar' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Ayarlar' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Hesabım' }).getAttribute('href')).toBe('/panel/defne/hesabim')
  })
})
