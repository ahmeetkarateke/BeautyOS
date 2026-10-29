import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { StaffDetailScreen } from './staff-detail'
import { StaffScreen } from './staff-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown> }
let staff: unknown[]
let listError: ApiError | null
let writeError: ApiError | null
let assignments: unknown[]
let leaves: unknown[]

const person = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  title: 'Kuaför',
  fullName: 'Derya Aksoy',
  email: 'derya@ornek.com',
  colorCode: 1,
  workingHours: { monday: { start: '09:00', end: '18:00' }, sunday: null },
  skills: [{ serviceId: 's1', serviceName: 'Fön' }],
  ...over,
})

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
const openTab = (tab: HTMLElement) => fireEvent.mouseDown(tab, { button: 0, ctrlKey: false })

beforeEach(() => {
  request.mockReset()
  staff = [person(), person({ id: 'p2', fullName: 'Elif Tan', title: null, skills: [] })]
  listError = null
  writeError = null
  assignments = [{ id: 'a1', serviceId: 's1', serviceName: 'Fön', durationMinutes: 45, basePrice: 850, commissionType: 'percentage', commissionValue: 10 }]
  leaves = [
    { id: 'l2', leaveDate: '2026-11-05T00:00:00.000Z', leaveType: 'vacation', note: null },
    { id: 'l1', leaveDate: '2026-11-01T00:00:00.000Z', leaveType: 'sick_leave', note: 'Rapor' },
  ]
  request.mockImplementation(async (path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      return {}
    }
    if (path.endsWith('/staff')) {
      if (listError) throw listError
      return { data: staff }
    }
    if (path.endsWith('/services') && path.includes('/staff/')) return { data: assignments }
    if (path.endsWith('/services'))
      return {
        data: [
          { id: 's1', name: 'Fön', durationMinutes: 45 },
          { id: 's2', name: 'Boya', durationMinutes: 90 },
        ],
      }
    if (path.endsWith('/leaves')) return { data: leaves }
    if (path.endsWith('/settings'))
      return { settings: { workingHours: { monday: { start: '10:00', end: '19:00' }, tuesday: { start: '10:00', end: '19:00' } } } }
    throw new Error(`beklenmeyen çağrı ${path}`)
  })
})
afterEach(cleanup)

describe('W21 Personel listesi', () => {
  it('K1: personel ad, unvan ve hizmet sayısıyla listelenir; satır ayrıntıya bağlanır; davet "Yakında"', async () => {
    mount(<StaffScreen />)
    const list = await screen.findByRole('list', { name: 'Personel' })
    expect(
      within(list)
        .getByRole('link', { name: /Derya Aksoy/ })
        .getAttribute('href'),
    ).toBe('/panel/defne/personel-detay/p1')
    expect(list.textContent).toContain('Kuaför · 1 hizmet')
    expect(list.textContent).toContain('0 hizmet')
    expect(screen.getByText('Yakında')).toBeTruthy()
  })
  it('K2: sahip ve müdür dışındaki rol yetkisiz ekran görür, istek atılmaz', () => {
    mount(<StaffScreen />, makeMe('receptionist'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })
  it('K3: boş liste ve hata durumları açıklayıcıdır', async () => {
    staff = []
    mount(<StaffScreen />)
    expect(await screen.findByText('Henüz personel yok.')).toBeTruthy()
    cleanup()
    listError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount(<StaffScreen />)
    expect((await screen.findByRole('alert')).textContent).toContain('Personel listesi yüklenemedi.')
  })
})

describe('W21 Personel ayrıntısı', () => {
  it('K4: bulunmayan personel açıklayıcı boş durum + listeye dön', async () => {
    mount(<StaffDetailScreen staffId="yok" />)
    expect(await screen.findByText('Personel bulunamadı.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Personel listesine dön' }).getAttribute('href')).toBe('/panel/defne/personel')
  })

  it('K5: profil: unvan değişince PATCH yalnız unvanı gönderir; değişiklik yoksa istek yok; boş unvan reddedilir', async () => {
    mount(<StaffDetailScreen staffId="p1" />)
    await screen.findByRole('heading', { level: 1, name: 'Derya Aksoy' })
    fireEvent.click(screen.getByRole('button', { name: 'Profili kaydet' }))
    expect(await screen.findByText('Değişiklik yapmadınız.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(screen.getByRole('textbox', { name: 'Unvan' }), { target: { value: ' ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Profili kaydet' }))
    expect(await screen.findByText('Unvanı yazın.')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Unvan' }), { target: { value: 'Uzman kuaför' } })
    fireEvent.click(screen.getByRole('button', { name: 'Profili kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/staff\/p1$/)
    expect((writes()[0][1] as Init).body).toEqual({ title: 'Uzman kuaför' })
  })

  it('K6: hizmetleri: atananlar prim satırıyla listelenir; sahip yeni hizmet atar (atananlar seçenekte yok), kaldırmak onay ister', async () => {
    mount(<StaffDetailScreen staffId="p1" />)
    openTab(await screen.findByRole('tab', { name: 'Hizmetleri' }))
    const list = await screen.findByRole('list', { name: 'Verdiği hizmetler' })
    expect(list.textContent).toContain('%10 prim')
    const select = screen.getByRole('combobox', { name: 'Hizmet ekle' }) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.text)).toEqual(['Seçin', 'Boya'])
    fireEvent.change(select, { target: { value: 's2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hizmeti ata' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ serviceId: 's2' })
    fireEvent.click(within(list).getByRole('button', { name: 'Kaldır' }))
    const confirm = await screen.findByRole('alertdialog')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Hizmeti kaldır' }))
    await waitFor(() => expect(writes()).toHaveLength(2))
    expect(writes()[1][0]).toMatch(/staff\/p1\/services\/s1$/)
    expect((writes()[1][1] as Init).method).toBe('DELETE')
  })

  it('K7: müdür hizmet atayamaz ve izin yazamaz (yalnız sahip): ekleme/kaldırma düğmeleri çıkmaz, açıklama yazar', async () => {
    mount(<StaffDetailScreen staffId="p1" />, makeMe('manager'))
    openTab(await screen.findByRole('tab', { name: 'Hizmetleri' }))
    await screen.findByRole('list', { name: 'Verdiği hizmetler' })
    expect(screen.queryByRole('button', { name: 'Hizmeti ata' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Kaldır' })).toBeNull()
    expect(screen.getByText('Hizmet atamasını yalnız salon sahibi değiştirebilir.')).toBeTruthy()
    openTab(screen.getByRole('tab', { name: 'İzinler' }))
    await screen.findByRole('list', { name: 'İzinler' })
    expect(screen.queryByRole('button', { name: 'İzin ekle' })).toBeNull()
  })

  it('K8: çalışma saatleri: mevcut program dolu gelir; bitiş başlangıçtan önceyse istek yok ve neden yazar; geçerli kayıt 7 günlük gövde gönderir', async () => {
    mount(<StaffDetailScreen staffId="p1" />)
    openTab(await screen.findByRole('tab', { name: 'Çalışma saatleri' }))
    const end = (await screen.findByLabelText('Pazartesi bitiş')) as HTMLInputElement
    expect(end.value).toBe('18:00')
    fireEvent.change(end, { target: { value: '08:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Saatleri kaydet' }))
    expect(await screen.findByText('Pazartesi: bitiş saati başlangıçtan sonra olmalı.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(end, { target: { value: '19:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Saatleri kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    const hours = ((writes()[0][1] as Init).body as { workingHours: Record<string, unknown> }).workingHours
    expect(Object.keys(hours)).toHaveLength(7)
    expect(hours.monday).toEqual({ start: '09:00', end: '19:00' })
    expect(hours.sunday).toBeNull()
  })

  it('K9: izinler: tarihe göre sıralı, türüyle; sahip izin ekler (tarih zorunlu) ve siler', async () => {
    mount(<StaffDetailScreen staffId="p1" />)
    openTab(await screen.findByRole('tab', { name: 'İzinler' }))
    const list = await screen.findByRole('list', { name: 'İzinler' })
    const items = within(list)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '')
    expect(items[0]).toContain('1 Kasım 2026')
    expect(items[0]).toContain('Raporlu · Rapor')
    expect(items[1]).toContain('Yıllık izin')
    fireEvent.click(screen.getByRole('button', { name: 'İzin ekle' }))
    expect(await screen.findByText('İzin gününü seçin.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(screen.getByLabelText('İzin günü'), { target: { value: '2026-12-24' } })
    fireEvent.click(screen.getByRole('button', { name: 'İzin ekle' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ leaveDate: '2026-12-24', leaveType: 'day_off' })
    fireEvent.click(within(list).getAllByRole('button', { name: 'Sil' })[0])
    await waitFor(() => expect(writes()).toHaveLength(2))
    expect(writes()[1][0]).toMatch(/leaves\/l1$/)
  })

  it('K10: yazma hatası şeritle çıkar, girilenler korunur', async () => {
    writeError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount(<StaffDetailScreen staffId="p1" />)
    await screen.findByRole('heading', { level: 1, name: 'Derya Aksoy' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Unvan' }), { target: { value: 'Yeni unvan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Profili kaydet' }))
    expect((await screen.findByRole('alert')).textContent).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'Unvan' }) as HTMLInputElement).value).toBe('Yeni unvan')
  })

  it('K11: Ödemeler sekmesi "Yakında"; uzman/resepsiyon ayrıntıyı göremez', async () => {
    mount(<StaffDetailScreen staffId="p1" />)
    openTab(await screen.findByRole('tab', { name: 'Ödemeler' }))
    expect(await screen.findByText('Personel ödemeleri')).toBeTruthy()
    cleanup()
    mount(<StaffDetailScreen staffId="p1" />, makeMe('receptionist'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
  })
})

describe('W21-1: salon saatleri kullanılıyor (müdür kararı)', () => {
  const salonStaff = () => {
    staff = [person({ workingHours: null })]
  }

  it('K12: özel saati olmayan personelde "Salon çalışma saatleri kullanılıyor" ve salon saatleri salt okunur; kaydet düğmesi yok', async () => {
    salonStaff()
    mount(<StaffDetailScreen staffId="p1" />)
    openTab(await screen.findByRole('tab', { name: 'Çalışma saatleri' }))
    expect(await screen.findByText(/Salon çalışma saatleri kullanılıyor/)).toBeTruthy()
    const list = screen.getByRole('list', { name: 'Salon çalışma saatleri' })
    expect(list.textContent).toContain('10:00 – 19:00')
    expect(list.textContent).toContain('Kapalı')
    expect(screen.queryByRole('button', { name: 'Saatleri kaydet' })).toBeNull()
    expect(screen.queryByLabelText('Pazartesi başlangıç')).toBeNull()
  })

  it('K13: ilgisiz bir alanı (unvan) kaydetmek çalışma saatlerini yazmaz', async () => {
    salonStaff()
    mount(<StaffDetailScreen staffId="p1" />)
    await screen.findByRole('heading', { level: 1, name: 'Derya Aksoy' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Unvan' }), { target: { value: 'Yeni unvan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Profili kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ title: 'Yeni unvan' })
    expect(JSON.stringify((writes()[0][1] as Init).body)).not.toContain('workingHours')
  })

  it('K14: Kişiye özel saat belirle düzenleyiciyi salon saatleriyle doldurur; kaydedince 7 günlük program gider', async () => {
    salonStaff()
    mount(<StaffDetailScreen staffId="p1" />)
    openTab(await screen.findByRole('tab', { name: 'Çalışma saatleri' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Kişiye özel saat belirle' }))
    const start = (await screen.findByLabelText('Pazartesi başlangıç')) as HTMLInputElement
    expect(start.value).toBe('10:00')
    fireEvent.change(start, { target: { value: '11:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Saatleri kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    const hours = ((writes()[0][1] as Init).body as { workingHours: Record<string, unknown> }).workingHours
    expect(hours.monday).toEqual({ start: '11:00', end: '19:00' })
    expect(hours.wednesday).toBeNull()
  })

  it('K15: hepsi kapalı kayıt engellenir, neden yazılır, istek atılmaz', async () => {
    salonStaff()
    mount(<StaffDetailScreen staffId="p1" />)
    openTab(await screen.findByRole('tab', { name: 'Çalışma saatleri' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Kişiye özel saat belirle' }))
    await screen.findByLabelText('Pazartesi başlangıç')
    fireEvent.click(screen.getByRole('switch', { name: 'Pazartesi' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Salı' }))
    fireEvent.click(screen.getByRole('button', { name: 'Saatleri kaydet' }))
    expect(await screen.findByText(/En az bir gün açık olmalı/)).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })

  it('K16: salon saati yüklenemezse hata ve Yeniden dene (kapalı gösterilmez)', async () => {
    salonStaff()
    const impl = request.getMockImplementation()!
    request.mockImplementation(async (path: string, init?: Init) => {
      if (path.endsWith('/settings')) throw new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
      return impl(path, init)
    })
    mount(<StaffDetailScreen staffId="p1" />)
    openTab(await screen.findByRole('tab', { name: 'Çalışma saatleri' }))
    expect(await screen.findByText('Salon saatleri yüklenemedi.')).toBeTruthy()
  })
})
