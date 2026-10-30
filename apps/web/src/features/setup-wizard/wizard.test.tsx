import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { SetupWizard } from './wizard'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown> }
let writeError: ApiError | null

function mount(me: Me = makeMe('owner', { businessType: 'barbershop' })) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <SetupWizard />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const writes = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method).map(([path, init]) => ({ path: path as string, ...(init as Init) }))
const fill = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  request.mockReset()
  writeError = null
  request.mockImplementation(async (_path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      return init.method === 'POST' ? { id: 's1' } : {}
    }
    return { name: 'Defne Berber', settings: { phone: '05321234567', address: 'Atatürk Cad. 5, Kadıköy', workingHours: null } }
  })
})
afterEach(cleanup)

async function toStaff() {
  mount()
  await screen.findByRole('heading', { level: 1, name: 'İşletme türü' })
  click('Devam et')
  await screen.findByRole('heading', { level: 1, name: 'Salon bilgileri' })
  click('Kaydet ve devam et')
  await screen.findByRole('heading', { level: 1, name: 'Çalışma saatleri' })
  click('Şimdilik atla')
  await screen.findByRole('heading', { level: 1, name: 'Hizmetler' })
  click('Şimdilik atla')
  await screen.findByRole('heading', { level: 1, name: 'Personel' })
}

async function toSalon() {
  mount()
  await screen.findByRole('heading', { level: 1, name: 'İşletme türü' })
  click('Devam et')
  await screen.findByRole('heading', { level: 1, name: 'Salon bilgileri' })
}

describe('W31 Kurulum sihirbazı', () => {
  it('K9: e-posta gitmediyse (emailSent false) uyarı ve kopyalanabilir bağlantı gösterilir; gittiyse "Davet gönderildi"', async () => {
    request.mockImplementation(async (path: string, init?: Init) => {
      if (path.endsWith('/invitations')) return { id: 'i1', link: 'https://x.test/invite#abc', emailSent: init?.body?.email === 'gider@ornek.com' }
      if (init?.method) return {}
      return { name: 'Defne Berber', settings: { phone: '05321234567', address: 'Atatürk Cad. 5, Kadıköy', workingHours: null } }
    })
    await toStaff()
    fill(screen.getByLabelText('Ad soyad'), 'Ayşe Demir')
    fill(screen.getByLabelText('E-posta'), 'gitmez@ornek.com')
    click('Daveti gönder')
    expect(await screen.findByText(/E-posta gönderilemedi/)).toBeTruthy()
    expect((screen.getByLabelText('Davet bağlantısı') as HTMLInputElement).value).toBe('https://x.test/invite#abc')
    fill(screen.getByLabelText('Ad soyad'), 'Can Er')
    fill(screen.getByLabelText('E-posta'), 'gider@ornek.com')
    click('Daveti gönder')
    expect(await screen.findByText(/Davet gönderildi: Can Er/)).toBeTruthy()
  })

  it('K10: müdür davet gönderemez (staff.invite yalnız sahipte): form yok, salon sahibi bilgisi var', async () => {
    mount(makeMe('manager', { businessType: 'barbershop' }))
    await screen.findByRole('heading', { level: 1, name: 'İşletme türü' })
    click('Devam et')
    await screen.findByRole('heading', { level: 1, name: 'Salon bilgileri' })
    click('Kaydet ve devam et')
    await screen.findByRole('heading', { level: 1, name: 'Çalışma saatleri' })
    click('Şimdilik atla')
    await screen.findByRole('heading', { level: 1, name: 'Hizmetler' })
    click('Şimdilik atla')
    await screen.findByRole('heading', { level: 1, name: 'Personel' })
    expect(screen.queryByLabelText('E-posta')).toBeNull()
    expect(screen.getByText('Personel davetini salon sahibi gönderir.')).toBeTruthy()
  })

  it('K11: işletme türü değişince hizmet önerileri yeni türe göre gelir', async () => {
    mount()
    await screen.findByRole('heading', { level: 1, name: 'İşletme türü' })
    fireEvent.change(screen.getByLabelText('İşletme türü'), { target: { value: 'nail_studio' } })
    click('Devam et')
    await screen.findByRole('heading', { level: 1, name: 'Salon bilgileri' })
    click('Kaydet ve devam et')
    await screen.findByRole('heading', { level: 1, name: 'Çalışma saatleri' })
    click('Şimdilik atla')
    await screen.findByRole('heading', { level: 1, name: 'Hizmetler' })
    expect(screen.getByLabelText('Manikür (45 dk)')).toBeTruthy()
    expect(screen.queryByLabelText('Sakal tıraşı (20 dk)')).toBeNull()
    expect(writes()[0].body).toEqual({ businessType: 'nail_studio' })
  })

  it('K12: klinik hesapta tür adımından sonra sağlık kuruluşu bilgi adımı açılır', async () => {
    mount(makeMe('owner', { businessType: 'dentist' }))
    await screen.findByRole('heading', { level: 1, name: 'İşletme türü' })
    click('Devam et')
    await screen.findByRole('heading', { level: 1, name: 'Sağlık kuruluşu bilgileri' })
    expect(screen.getByText(/henüz hazır değil/)).toBeTruthy()
  })

  it('K12: salondan dişe geçilince klinik adımı açılır', async () => {
    mount()
    await screen.findByRole('heading', { level: 1, name: 'İşletme türü' })
    fireEvent.change(screen.getByLabelText('İşletme türü'), { target: { value: 'dentist' } })
    click('Devam et')
    expect(await screen.findByRole('heading', { level: 1, name: 'Sağlık kuruluşu bilgileri' })).toBeTruthy()
  })

  it('K12: dişten salona geçilince salon adımı açılır ve ilerleme 2 / 7 olur', async () => {
    mount(makeMe('owner', { businessType: 'dentist' }))
    await screen.findByRole('heading', { level: 1, name: 'İşletme türü' })
    fireEvent.change(screen.getByLabelText('İşletme türü'), { target: { value: 'barbershop' } })
    click('Devam et')
    expect(await screen.findByRole('heading', { level: 1, name: 'Salon bilgileri' })).toBeTruthy()
    expect(screen.getByText('Adım 2 / 7')).toBeTruthy()
  })

  it('K1: ilk adım işletme türüdür, ilerleme çizgisi 1/7 der; tür değişmediyse istek atılmaz', async () => {
    mount()
    await screen.findByRole('heading', { level: 1, name: 'İşletme türü' })
    expect(screen.getByText('Adım 1 / 7')).toBeTruthy()
    click('Devam et')
    await screen.findByRole('heading', { level: 1, name: 'Salon bilgileri' })
    expect(writes()).toHaveLength(0)
  })

  it('K2: salon adımı geçersiz telefonu reddeder ve istek atmaz; düzelince yazar', async () => {
    await toSalon()
    fill(screen.getByLabelText('Telefon'), '123')
    click('Kaydet ve devam et')
    expect(await screen.findByText('Telefonu 7 ile 20 karakter arasında yazın.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fill(screen.getByLabelText('Telefon'), '05329998877')
    click('Kaydet ve devam et')
    await screen.findByRole('heading', { level: 1, name: 'Çalışma saatleri' })
    expect(writes()[0].body).toMatchObject({ phone: '05329998877', name: 'Defne Berber' })
  })

  it('K3: çalışma saatleri atlanınca hiçbir şey yazılmaz; sonraki adım açılır', async () => {
    await toSalon()
    click('Kaydet ve devam et')
    await screen.findByRole('heading', { level: 1, name: 'Çalışma saatleri' })
    const before = writes().length
    click('Şimdilik atla')
    await screen.findByRole('heading', { level: 1, name: 'Hizmetler' })
    expect(writes()).toHaveLength(before)
  })

  it('K4: hizmet önerisi fiyatsız kaydedilemez; fiyatla POST /services gider', async () => {
    await toSalon()
    click('Kaydet ve devam et')
    await screen.findByRole('heading', { level: 1, name: 'Çalışma saatleri' })
    click('Şimdilik atla')
    await screen.findByRole('heading', { level: 1, name: 'Hizmetler' })
    fireEvent.click(screen.getByLabelText('Sakal tıraşı (20 dk)'))
    click('Kaydet ve devam et')
    expect(await screen.findByText(/Fiyatı rakamlarla yazın/)).toBeTruthy()
    expect(writes().some((w) => w.path.endsWith('/services'))).toBe(false)
    fill(screen.getByLabelText('Sakal tıraşı fiyatı (TL)'), '850.50')
    click('Kaydet ve devam et')
    await screen.findByRole('heading', { level: 1, name: 'Personel' })
    const post = writes().find((w) => w.path.endsWith('/services'))
    expect(post?.body).toMatchObject({ name: 'Sakal tıraşı', durationMinutes: 20, price: 850.5 })
  })

  it('K5: personel adımında geçersiz e-posta reddedilir; "Sadece ben" davet göndermeden ilerler', async () => {
    await toSalon()
    for (const label of ['Kaydet ve devam et', 'Şimdilik atla', 'Devam et']) {
      await waitFor(() => screen.getByRole('button', { name: label }))
      click(label)
    }
    await screen.findByRole('heading', { level: 1, name: 'Personel' })
    fill(screen.getByLabelText('Ad soyad'), 'Ayşe Demir')
    fill(screen.getByLabelText('E-posta'), 'ayse')
    click('Daveti gönder')
    expect(await screen.findByText(/E-posta adresini kontrol edin/)).toBeTruthy()
    expect(writes().some((w) => w.path.endsWith('/invitations'))).toBe(false)
    click('Sadece ben')
    await screen.findByRole('heading', { level: 1, name: 'Yasal bilgiler' })
  })

  it('K6: sunucu hatası adımda anlaşılır Türkçe gösterilir ve adım ilerlemez', async () => {
    await toSalon()
    writeError = new ApiError({ status: 0, code: 'NETWORK' })
    click('Kaydet ve devam et')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent?.length).toBeGreaterThan(10)
    expect(screen.getByRole('heading', { level: 1, name: 'Salon bilgileri' })).toBeTruthy()
  })

  it('K7: uzman rolü sihirbazı açamaz (yetkisiz ekran)', () => {
    mount(makeMe('staff'))
    expect(screen.queryByRole('heading', { level: 1, name: 'İşletme türü' })).toBeNull()
  })

  it('K8: hazır adımında "Panele git" onboardingCompleted yazar', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign, origin: 'https://x.test' })
    await toSalon()
    click('Kaydet ve devam et')
    for (const label of ['Şimdilik atla', 'Şimdilik atla']) {
      await waitFor(() => screen.getByRole('button', { name: label }))
      click(label)
    }
    await screen.findByRole('heading', { level: 1, name: 'Personel' })
    click('Sadece ben')
    await screen.findByRole('heading', { level: 1, name: 'Yasal bilgiler' })
    click('Şimdilik atla')
    await screen.findByRole('heading', { level: 1, name: 'Hazır' })
    click('Panele git')
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/panel/defne/bugun'))
    expect(writes().at(-1)?.body).toEqual({ onboardingCompleted: true })
    vi.unstubAllGlobals()
  })
})
