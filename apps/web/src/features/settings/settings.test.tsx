import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { SettingsHub, SettingsSection } from './settings-screens'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown> }
let settings: unknown
let loadError: ApiError | null
let writeError: ApiError | null

function mount(node: React.ReactNode, me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>{node}</ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const writes = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method)

beforeEach(() => {
  request.mockReset()
  loadError = null
  writeError = null
  settings = {
    name: 'Defne Güzellik',
    settings: {
      phone: '0532 111 22 33',
      address: 'Bahçelievler Mah. 12. Sok.',
      publicBookingEnabled: true,
      onlineBookingApproval: 'manual',
      whatsappNumber: null,
      aboutText: null,
      workingHours: { monday: { start: '09:00', end: '18:00' } },
      activeModules: ['dashboard', 'appointments', 'settings', 'inventory'],
    },
  }
  request.mockImplementation(async (_path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      return {}
    }
    if (loadError) throw loadError
    return settings
  })
})
afterEach(cleanup)

describe('W27 Ayarlar merkezi', () => {
  it('K1: sahip tüm bölümleri (Modüller ve Terimler dahil) bağlantı olarak görür', () => {
    mount(<SettingsHub />)
    const list = screen.getByRole('list', { name: 'Ayar bölümleri' })
    expect(
      within(list)
        .getByRole('link', { name: /Modüller/ })
        .getAttribute('href'),
    ).toBe('/panel/defne/ayarlar/moduller')
    expect(within(list).getByRole('link', { name: /Terimler/ })).toBeTruthy()
  })
  it('K2: müdür Modüller ve Terimler bağlantılarını görmez; resepsiyon hiçbirini görmez (yetkisiz)', () => {
    mount(<SettingsHub />, makeMe('manager'))
    expect(screen.queryByRole('link', { name: /Modüller/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Terimler/ })).toBeNull()
    expect(screen.getByRole('link', { name: /Salon bilgileri/ })).toBeTruthy()
    cleanup()
    mount(<SettingsHub />, makeMe('receptionist'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
  })
  it('K3: müdür adresten Modüller bölümünü açmaya çalışırsa yetkisiz ekran görür ve ayar isteği atılmaz', () => {
    mount(<SettingsSection section="moduller" />, makeMe('manager'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })
  it('K4: bilinmeyen bölüm adı yetkisiz ekran görür (içerik uydurulmaz)', () => {
    mount(<SettingsSection section="olmayan" />)
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
  })
})

describe('W27 Salon bilgileri', () => {
  it('K5: mevcut bilgiler dolu gelir; yalnız değişen alan PATCH edilir; değişiklik yoksa istek yok', async () => {
    mount(<SettingsSection section="salon" />)
    const name = (await screen.findByRole('textbox', { name: 'Salon adı' })) as HTMLInputElement
    expect(name.value).toBe('Defne Güzellik')
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText('Değişiklik yapmadınız.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(name, { target: { value: 'Defne Güzellik Merkezi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ name: 'Defne Güzellik Merkezi' })
    expect(await screen.findByText('Salon bilgileri kaydedildi.')).toBeTruthy()
  })
  it('K6: kısa ad ve geçersiz telefon istek atmaz, nedenini yazar', async () => {
    mount(<SettingsSection section="salon" />)
    const name = await screen.findByRole('textbox', { name: 'Salon adı' })
    fireEvent.change(name, { target: { value: 'A' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefon' }), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText('Salon adı 2 ile 100 karakter arasında olmalı.')).toBeTruthy()
    expect(screen.getByText('Telefonu 7 ile 20 karakter arasında yazın.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })
  it('K7: yükleme hatası ErrorState + Yeniden dene; kayıt hatası şeritte, girilenler korunur', async () => {
    loadError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount(<SettingsSection section="salon" />)
    expect((await screen.findByRole('alert')).textContent).toContain('Ayarlar yüklenemedi.')
    cleanup()
    loadError = null
    writeError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount(<SettingsSection section="salon" />)
    fireEvent.change(await screen.findByRole('textbox', { name: 'Salon adı' }), { target: { value: 'Yeni Ad' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect((await screen.findByRole('alert')).textContent).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'Salon adı' }) as HTMLInputElement).value).toBe('Yeni Ad')
  })
})

describe('W27 Online randevu (onay ayarı, T3)', () => {
  it('K8: mevcut onay kipi seçili gelir; otomatiğe çevirince yalnız onlineBookingApproval gider', async () => {
    mount(<SettingsSection section="online-randevu" />)
    const select = (await screen.findByRole('combobox', { name: 'Online randevular' })) as HTMLSelectElement
    expect(select.value).toBe('manual')
    expect(screen.getByText('Her talebi siz onaylarsınız; onaylanana dek randevu kesinleşmez.')).toBeTruthy()
    fireEvent.change(select, { target: { value: 'auto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ onlineBookingApproval: 'auto' })
  })
  it('K9: sayfa anahtarı kapatılınca publicBookingEnabled:false gider; geçersiz WhatsApp istek atmaz', async () => {
    mount(<SettingsSection section="online-randevu" />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Online randevu sayfası açık' }))
    fireEvent.change(screen.getByRole('textbox', { name: /WhatsApp/ }), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText(/WhatsApp numarasını 7 ile 20/)).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(screen.getByRole('textbox', { name: /WhatsApp/ }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ publicBookingEnabled: false })
  })
})

describe('W27 Çalışma saatleri', () => {
  it('K10: salon saatleri dolu gelir; hepsi kapatılırsa neden yazılır ve istek atılmaz; geçerli kayıt 7 günlük program gönderir', async () => {
    mount(<SettingsSection section="calisma-saatleri" />)
    const end = (await screen.findByLabelText('Pazartesi bitiş')) as HTMLInputElement
    expect(end.value).toBe('18:00')
    fireEvent.click(screen.getByRole('switch', { name: 'Pazartesi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Saatleri kaydet' }))
    expect(await screen.findByText(/En az bir gün açık olmalı/)).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.click(screen.getByRole('switch', { name: 'Pazartesi' }))
    fireEvent.change(screen.getByLabelText('Pazartesi bitiş'), { target: { value: '19:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Saatleri kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    const hours = ((writes()[0][1] as Init).body as { workingHours: Record<string, unknown> }).workingHours
    expect(hours.monday).toEqual({ start: '09:00', end: '19:00' })
    expect(Object.keys(hours)).toHaveLength(7)
  })
})

describe('W27 Modüller (yalnız sahip)', () => {
  it('K11: Bugün ve Ayarlar kilitli (kapatılamaz); modül kapatılınca activeModules listesi gider', async () => {
    mount(<SettingsSection section="moduller" />)
    expect(((await screen.findByRole('switch', { name: 'Ayarlar' })) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('switch', { name: 'Bugün' }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('switch', { name: 'Stok' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ activeModules: ['dashboard', 'appointments', 'settings'] })
  })
  it('K12: değişiklik yoksa istek atılmaz', async () => {
    mount(<SettingsSection section="moduller" />)
    await screen.findByRole('switch', { name: 'Ayarlar' })
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText('Değişiklik yapmadınız.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })
  it('K13: Terimler bölümü "Yakında" der (sahipte)', async () => {
    mount(<SettingsSection section="terimler" />)
    expect(await screen.findByText('Bu bölüm yakında.')).toBeTruthy()
  })
})

describe('W27-1 koşul: SMS kapalıyken otomatik onay yok (müdür kararı)', () => {
  const smsOff = (): Me => ({ ...makeMe('owner'), tenant: { ...makeMe('owner').tenant, bookingMode: 'approval_required' } })

  it('K14: bookingMode approval_required iken onay seçimi çizilmez; kalıcı not yazılır', async () => {
    mount(<SettingsSection section="online-randevu" />, smsOff())
    await screen.findByRole('switch', { name: 'Online randevu sayfası açık' })
    expect(screen.queryByRole('combobox', { name: 'Online randevular' })).toBeNull()
    expect(screen.getByText('SMS doğrulaması açılana kadar online talepler salon onayına düşer.')).toBeTruthy()
    expect(screen.queryByText('Otomatik onaylansın')).toBeNull()
  })

  it('K15: bu modda başka alan kaydedilince onlineBookingApproval gönderilmez', async () => {
    settings = { ...(settings as object), settings: { ...((settings as { settings: object }).settings), onlineBookingApproval: 'auto' } }
    mount(<SettingsSection section="online-randevu" />, smsOff())
    fireEvent.click(await screen.findByRole('switch', { name: 'Online randevu sayfası açık' }))
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ publicBookingEnabled: false })
  })

  it('K16: SMS açık modda (verified) otomatik onay seçeneği vardır', async () => {
    mount(<SettingsSection section="online-randevu" />)
    expect(await screen.findByRole('combobox', { name: 'Online randevular' })).toBeTruthy()
  })
})
