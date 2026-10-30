import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import { ToastProvider } from '@/ui/toast'
import '@/ui/test-polyfills'
import { AdminLoginScreen, LegalScreen, OverviewScreen, TenantDetailScreen, TenantsScreen } from './screens'

const request = vi.fn()
const setAccessToken = vi.fn()
const client = { request, setAccessToken } as unknown as ApiClient
const mount = (node: React.ReactNode) =>
  render(
    <ApiClientProvider client={client}>
      <ToastProvider>{node}</ToastProvider>
    </ApiClientProvider>,
  )
const writes = () => request.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method)

const owner = (name: string, email: string) => [{ fullName: name, email, phone: null }]
const tenants = [
  { id: 't1', name: 'Güzel Salon', slug: 'guzel', plan: 'trial', isActive: true, trialEndsAt: '2099-01-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', _count: { users: 3, appointments: 9, customers: 40 }, users: owner('Ayşe Yılmaz', 'ayse@example.com') },
  { id: 't2', name: 'Işık Kuaför', slug: 'isik', plan: 'pro', isActive: true, trialEndsAt: null, createdAt: '2026-09-01T00:00:00.000Z', _count: { users: 1, appointments: 2, customers: 5 }, users: owner('Can Demir', 'can@example.com') },
  { id: 't3', name: 'Eski Berber', slug: 'eski', plan: 'trial', isActive: true, trialEndsAt: '2000-01-01T00:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z', _count: { users: 1, appointments: 0, customers: 0 }, users: [] },
]
const detail = {
  tenant: { id: 't1', name: 'Güzel Salon', slug: 'guzel', plan: 'trial', isActive: true, trialEndsAt: '2099-01-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z' },
  activity: { totalAppointments: 12, totalCustomers: 40, totalRevenue: 18500, lastActivityAt: '2026-10-29T10:00:00.000Z' },
}

function api(over: Record<string, unknown> = {}) {
  request.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path in over) {
      const value = over[path]
      if (value instanceof Error) throw value
      return value
    }
    if (init?.method === 'PATCH') return { tenant: detail.tenant }
    if (path.endsWith('/admin/stats')) return { stats: { totalTenants: 21, activeTenants: 17, trialTenants: 6, expiredTenants: 4, recentRegistrations: 3 } }
    if (path.endsWith('/admin/tenants')) return { tenants }
    if (path.endsWith('/admin/tenants/t1')) return detail
    if (path.endsWith('/auth/legal-versions')) return { termsVersion: '2026-10-01', dpaVersion: '2026-10-02', labelVersion: 'e1', marketingTextVersion: 'p1' }
    throw new Error(`beklenmeyen ${path}`)
  })
}

beforeEach(() => {
  request.mockReset()
  setAccessToken.mockReset()
})
afterEach(cleanup)

describe('W33 genel bakış', () => {
  it('K1: toplam, aktif, deneme, süresi dolan ve son 30 gün kayıt sayıları görünür', async () => {
    api()
    mount(<OverviewScreen />)
    const total = (await screen.findByText('Toplam salon')).parentElement as HTMLElement
    expect(within(total).getByText('21')).toBeTruthy()
    expect(within(screen.getByText('Aktif').parentElement as HTMLElement).getByText('17')).toBeTruthy()
    expect(within(screen.getByText('Deneme').parentElement as HTMLElement).getByText('6')).toBeTruthy()
    expect(within(screen.getByText('Süresi dolan').parentElement as HTMLElement).getByText('4')).toBeTruthy()
    expect(within(screen.getByText('Son 30 günde kayıt').parentElement as HTMLElement).getByText('3')).toBeTruthy()
  })
  it('K2: yükleme hatasında anlaşılır metin ve yeniden dene çıkar', async () => {
    api({ '/api/v1/admin/stats': new ApiError({ status: 0, code: 'NETWORK' }) })
    mount(<OverviewScreen />)
    expect(await screen.findByText('Genel bakış yüklenemedi.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeTruthy()
  })
})

describe('W33 salonlar', () => {
  it('K3: salonlar durumlarıyla listelenir; ad ayrıntı sayfasına bağlanır', async () => {
    api()
    mount(<TenantsScreen />)
    const link = await screen.findAllByRole('link', { name: 'Güzel Salon' })
    expect(link[0].getAttribute('href')).toBe('/admin/salonlar/t1')
    expect(screen.getAllByText('Süresi dolmuş').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ayse@example.com').length).toBeGreaterThan(0)
  })
  it('K4: arama büyük I ile yazılsa da küçük ı içeren adı bulur', async () => {
    api()
    mount(<TenantsScreen />)
    await screen.findAllByRole('link', { name: 'Güzel Salon' })
    fireEvent.change(screen.getByLabelText('Salon ara'), { target: { value: 'ISIK' } })
    expect(screen.queryAllByRole('link', { name: 'Güzel Salon' })).toHaveLength(0)
    expect(screen.getAllByRole('link', { name: 'Işık Kuaför' }).length).toBeGreaterThan(0)
  })
  it('K5: sonuç yoksa boş durum ve süzgeçleri temizleme eylemi çıkar', async () => {
    api()
    mount(<TenantsScreen />)
    await screen.findAllByRole('link', { name: 'Güzel Salon' })
    fireEvent.change(screen.getByLabelText('Salon ara'), { target: { value: 'yokboyle' } })
    expect(screen.getByText('Eşleşen salon yok.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Süzgeçleri temizle' }))
    expect(screen.getAllByRole('link', { name: 'Güzel Salon' }).length).toBeGreaterThan(0)
  })
  it('K6: plan süzgeci yalnız o plandaki salonları bırakır', async () => {
    api()
    mount(<TenantsScreen />)
    await screen.findAllByRole('link', { name: 'Güzel Salon' })
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'pro' } })
    expect(screen.queryAllByRole('link', { name: 'Güzel Salon' })).toHaveLength(0)
    expect(screen.getAllByRole('link', { name: 'Işık Kuaför' }).length).toBeGreaterThan(0)
  })
})

describe('W33 salon ayrıntısı', () => {
  it('K7: son 30 gün özeti ve tek ciro rakamı görünür; müşteri verisi yoktur', async () => {
    api()
    mount(<TenantDetailScreen id="t1" />)
    expect(await screen.findByRole('heading', { name: 'Güzel Salon' })).toBeTruthy()
    expect(screen.getByText('Randevu (son 30 gün)').parentElement?.textContent).toContain('12')
    expect(screen.getByText('Ciro (son 30 gün)').parentElement?.textContent).toMatch(/18\.500/)
  })
  it('K8: plan değiştirilince yalnız plan PATCH ile gider', async () => {
    api()
    mount(<TenantDetailScreen id="t1" />)
    await screen.findByRole('heading', { name: 'Güzel Salon' })
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'pro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Planı kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0]).toEqual(['/api/v1/admin/tenants/t1', { method: 'PATCH', body: { plan: 'pro' } }])
  })
  it('K9: pasife alma onay ister; vazgeçilirse istek gitmez, onaylanırsa isActive false gider', async () => {
    api()
    mount(<TenantDetailScreen id="t1" />)
    await screen.findByRole('heading', { name: 'Güzel Salon' })
    fireEvent.click(screen.getByRole('button', { name: 'Salonu pasife al' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Vazgeç' }))
    expect(writes()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Salonu pasife al' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salonu pasife al' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][1]).toEqual({ method: 'PATCH', body: { isActive: false } })
  })
  it('K10: deneme 14 gün uzatılınca bitiş tarihi mevcut bitişin 14 gün sonrası olarak gider', async () => {
    api()
    mount(<TenantDetailScreen id="t1" />)
    await screen.findByRole('heading', { name: 'Güzel Salon' })
    fireEvent.change(screen.getByLabelText('Uzatma süresi'), { target: { value: '14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Denemeyi uzat' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][1]).toEqual({ method: 'PATCH', body: { trialEndsAt: '2099-01-15T00:00:00.000Z' } })
  })
  it('K11: deneme planında olmayan salonda uzatma görünmez', async () => {
    api({ '/api/v1/admin/tenants/t1': { ...detail, tenant: { ...detail.tenant, plan: 'pro', trialEndsAt: null } } })
    mount(<TenantDetailScreen id="t1" />)
    await screen.findByRole('heading', { name: 'Güzel Salon' })
    expect(screen.queryByRole('button', { name: 'Denemeyi uzat' })).toBeNull()
  })
  it('K12: kayıt başarısızsa hata metni yazılır ve ekran açık kalır', async () => {
    api()
    mount(<TenantDetailScreen id="t1" />)
    await screen.findByRole('heading', { name: 'Güzel Salon' })
    request.mockImplementation(async () => {
      throw new ApiError({ status: 0, code: 'NETWORK' })
    })
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'starter' } })
    fireEvent.click(screen.getByRole('button', { name: 'Planı kaydet' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
  it('K13: salon bulunamazsa anlaşılır boş durum çıkar', async () => {
    api({ '/api/v1/admin/tenants/t9': new ApiError({ status: 404, code: 'NOT_FOUND' }) })
    mount(<TenantDetailScreen id="t9" />)
    expect(await screen.findByText('Salon bulunamadı.')).toBeTruthy()
  })
})

describe('W33 yasal belge sürümleri', () => {
  it('K14: yürürlükteki sürümler listelenir; yayınlama için yakında notu vardır ve yayınla düğmesi yoktur', async () => {
    api()
    mount(<LegalScreen />)
    expect(await screen.findByText('2026-10-01')).toBeTruthy()
    expect(screen.getByText('2026-10-02')).toBeTruthy()
    expect(screen.getByText(/Yeni sürüm yayınlama yakında/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /yayınla/i })).toBeNull()
  })
})

describe('W33 yönetim girişi', () => {
  it('K15: doğru bilgiyle admin-login çağrılır, token belleğe alınır ve yönetime gidilir', async () => {
    request.mockResolvedValue({ token: 'tkn', user: { id: 'u' } })
    const navigate = vi.fn()
    mount(<AdminLoginScreen navigate={navigate} />)
    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: ' root@example.com ' } })
    fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: 'Gizli1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin'))
    expect(request).toHaveBeenCalledWith('/api/v1/auth/admin-login', { method: 'POST', body: { email: 'root@example.com', password: 'Gizli1234' } })
    expect(setAccessToken).toHaveBeenCalledWith('tkn')
  })
  it('K16: hatalı girişte yönlendirme olmaz, hata metni görünür', async () => {
    request.mockRejectedValue(new ApiError({ status: 401, code: 'INVALID_CREDENTIALS' }))
    const navigate = vi.fn()
    mount(<AdminLoginScreen navigate={navigate} />)
    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'root@example.com' } })
    fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: 'Yanlis1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(navigate).not.toHaveBeenCalled()
    expect(setAccessToken).not.toHaveBeenCalled()
  })
})
