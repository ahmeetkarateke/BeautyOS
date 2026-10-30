import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import { BookingScreen } from './booking-screen'
import { ManageScreen } from './manage-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request, setAccessToken: vi.fn() } as unknown as ApiClient
const mount = (node: React.ReactNode) => render(<ApiClientProvider client={client}>{node}</ApiClientProvider>)
const paths = () => request.mock.calls.map(([p]: [string]) => p)
const bodyOf = (suffix: string) => request.mock.calls.find(([p]: [string]) => p.endsWith(suffix))?.[1]?.body

const tenant = { name: 'Defne Güzellik', publicBookingEnabled: true, phone: '0212 111 22 33', whatsappNumber: '905321112233', brandColor: '#336699', bookingMode: 'approval_required', isHealthRegulated: false }
const slotId = '2099-01-05T10:00:00'
const booked = { referenceCode: 'BK-1', startAt: '2099-01-05T07:00:00.000Z', status: 'pending', approvalRequired: true, manageLink: 'https://x/book/manage#abc' }

function api(over: { tenant?: object; services?: object[]; book?: () => unknown } = {}) {
  request.mockImplementation(async (path: string) => {
    if (path.endsWith('/public/tenant')) return { ...tenant, ...over.tenant }
    if (path.endsWith('/public/services')) return { data: over.services ?? [{ id: 's1', name: 'Saç kesimi', durationMinutes: 30 }] }
    if (path.endsWith('/public/staff')) return { data: [{ id: 'p1', fullName: 'Ayşe Usta', title: null }] }
    if (path.endsWith('/public/slots')) return { date: '2099-01-05', slots: [{ id: slotId, available: true, staffId: 'p1' }] }
    if (path.endsWith('/verify/send') || path.endsWith('/verify/confirm')) return { ok: true }
    if (path.endsWith('/public/book')) return over.book ? over.book() : booked
    throw new Error(`beklenmeyen ${path}`)
  })
}

async function toInfo() {
  fireEvent.click(await screen.findByRole('button', { name: /Saç kesimi/ }))
  const slot = await screen.findByRole('button', { name: '10:00' })
  fireEvent.click(slot)
  fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
  fireEvent.change(await screen.findByLabelText('Ad soyad'), { target: { value: 'Ayşe Yılmaz' } })
  fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '5321112233' } })
}

beforeEach(() => {
  request.mockReset()
  window.history.replaceState(null, '', '/')
})
afterEach(cleanup)

describe('BookingScreen', () => {
  it('K1: onaylı akışta kod adımı yoktur; talep gönderilir ve "talebiniz alındı" yazılır, SMS vaadi geçmez', async () => {
    api()
    mount(<BookingScreen slug="defne" />)
    await toInfo()
    fireEvent.click(screen.getByRole('button', { name: 'Randevu talebi gönder' }))
    expect(await screen.findByRole('heading', { name: 'Randevu talebiniz alındı' })).toBeTruthy()
    expect(paths().some((p) => p.includes('/verify/'))).toBe(false)
    expect(bodyOf('/public/book')).toMatchObject({ serviceId: 's1', staffId: 'p1', startAt: slotId, customerPhone: '05321112233' })
    expect(document.body.textContent?.toLowerCase()).not.toContain('sms')
  })

  it('K2: doğrulamalı akışta önce kod gönderilir, kod onaylanınca randevu alınır', async () => {
    api({ tenant: { bookingMode: 'verified' }, book: () => ({ ...booked, approvalRequired: false }) })
    mount(<BookingScreen slug="defne" />)
    await toInfo()
    fireEvent.click(screen.getByRole('button', { name: 'Kod gönder' }))
    fireEvent.change(await screen.findByLabelText('Doğrulama kodu'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Randevuyu onayla' }))
    expect(await screen.findByRole('heading', { name: 'Randevunuz alındı' })).toBeTruthy()
    expect(paths().filter((p) => p.includes('/verify/')).map((p) => p.split('/').pop())).toEqual(['send', 'confirm'])
    expect(bodyOf('/verify/confirm')).toEqual({ phone: '05321112233', code: '123456' })
  })

  it('K3: fiyat yalnız API gönderirse görünür', async () => {
    api({ services: [{ id: 's1', name: 'Saç kesimi', durationMinutes: 30, price: 450 }, { id: 's2', name: 'Fön', durationMinutes: 20 }] })
    mount(<BookingScreen slug="defne" />)
    const priced = await screen.findByRole('button', { name: /Saç kesimi/ })
    expect(priced.textContent).toMatch(/450/)
    expect(screen.getByRole('button', { name: /Fön/ }).textContent).not.toMatch(/₺/)
  })

  it('K4: dolu saat seçilince zaman adımına dönülür ve neden yazılır', async () => {
    api({ book: () => { throw new ApiError({ status: 409, code: 'SLOT_TAKEN' }) } })
    mount(<BookingScreen slug="defne" />)
    await toInfo()
    fireEvent.click(screen.getByRole('button', { name: 'Randevu talebi gönder' }))
    expect(await screen.findByText('Bu saat doldu. Başka bir saat seçin.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Uzman ve zaman seçin' })).toBeTruthy()
  })

  it('K5: online randevu kapalıysa telefonla aranması söylenir; salon yoksa bulunamadı gösterilir', async () => {
    api({ tenant: { publicBookingEnabled: false } })
    mount(<BookingScreen slug="defne" />)
    expect(await screen.findByText(/online randevu almıyor/)).toBeTruthy()
    cleanup()
    request.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND' }))
    mount(<BookingScreen slug="yok" />)
    expect(await screen.findByRole('heading', { name: 'Salon bulunamadı' })).toBeTruthy()
  })

  it('K6: sağlık mevzuatına tabi işletmede WhatsApp metninde ve onayda hizmet adı geçmez', async () => {
    api({ tenant: { isHealthRegulated: true } })
    mount(<BookingScreen slug="klinik" />)
    await toInfo()
    fireEvent.click(screen.getByRole('button', { name: 'Randevu talebi gönder' }))
    const link = (await screen.findByRole('link', { name: 'WhatsApp ile yazın' })) as HTMLAnchorElement
    expect(decodeURIComponent(link.href)).not.toContain('Saç kesimi')
    expect(screen.queryByText('Saç kesimi')).toBeNull()
  })

  it('K7: form geçersizse istek atılmaz ve hata alan altında görünür', async () => {
    api()
    mount(<BookingScreen slug="defne" />)
    await toInfo()
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '532' } })
    fireEvent.click(screen.getByRole('button', { name: 'Randevu talebi gönder' }))
    expect(await screen.findByText(/10 haneli/)).toBeTruthy()
    expect(paths().some((p) => p.endsWith('/public/book'))).toBe(false)
  })
})

const lookupBody = {
  tenant: { name: 'Defne Güzellik', slug: 'defne', phone: '0212 111 22 33', address: 'Bahçelievler', isHealthRegulated: false },
  appointment: { referenceCode: 'BK-1', status: 'confirmed', startAt: '2099-01-05T07:00:00.000Z', endAt: '2099-01-05T07:30:00.000Z', serviceName: 'Saç kesimi', staffName: 'Ayşe Usta', serviceId: 's1', staffId: 'p1' },
  canModify: true,
  modifyDeadline: '2099-01-05T05:00:00.000Z',
}

function manageApi(over: Record<string, unknown> = {}) {
  request.mockImplementation(async (path: string) => {
    if (path.endsWith('/bookings/lookup')) return { ...lookupBody, ...over }
    if (path.endsWith('/bookings/cancel')) return { status: 'cancelled' }
    if (path.endsWith('/bookings/reschedule')) return { status: 'pending', startAt: slotId, approvalRequired: true }
    if (path.endsWith('/public/slots')) return { date: '2099-01-05', slots: [{ id: slotId, available: true }] }
    throw new Error(`beklenmeyen ${path}`)
  })
}

describe('ManageScreen', () => {
  it('K8: belirteç # parçasından alınır, adresten silinir ve yalnız POST gövdesinde gider', async () => {
    window.history.replaceState(null, '', '/book/manage#gizli-belirtec-1234567890')
    manageApi()
    mount(<ManageScreen />)
    expect(await screen.findByText('BK-1')).toBeTruthy()
    expect(window.location.hash).toBe('')
    const [path, init] = request.mock.calls[0]
    expect(path).toBe('/api/v1/public/bookings/lookup')
    expect(init.method).toBe('POST')
    expect(init.body).toEqual({ token: 'gizli-belirtec-1234567890' })
  })

  it('K9: belirteç yoksa istek atılmaz, geçersiz bağlantı ekranı çıkar', async () => {
    mount(<ManageScreen />)
    expect(await screen.findByRole('heading', { name: 'Bağlantı geçersiz' })).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K10: sunucu BOOKING_NOT_FOUND derse geçersiz bağlantı ekranı çıkar', async () => {
    window.history.replaceState(null, '', '/book/manage#abcdefghijklmnopqrstuvwxyz')
    request.mockRejectedValue(new ApiError({ status: 404, code: 'BOOKING_NOT_FOUND' }))
    mount(<ManageScreen />)
    expect(await screen.findByRole('heading', { name: 'Bağlantı geçersiz' })).toBeTruthy()
  })

  it('K11: iptal onaydan sonra gider; iptal metni gösterilir', async () => {
    window.history.replaceState(null, '', '/book/manage#abcdefghijklmnopqrstuvwxyz')
    manageApi()
    mount(<ManageScreen />)
    fireEvent.click(await screen.findByRole('button', { name: 'Randevuyu iptal et' }))
    await screen.findByRole('button', { name: 'Vazgeç' })
    fireEvent.click(screen.getByRole('button', { name: 'Randevuyu iptal et' }))
    expect(await screen.findByRole('heading', { name: 'Randevunuz iptal edildi' })).toBeTruthy()
    expect(bodyOf('/bookings/cancel')).toEqual({ token: 'abcdefghijklmnopqrstuvwxyz' })
  })

  it('K12: 2 saatten az kaldıysa düğme yoktur; salonu arama yönergesi çıkar', async () => {
    window.history.replaceState(null, '', '/book/manage#abcdefghijklmnopqrstuvwxyz')
    manageApi({ canModify: false })
    mount(<ManageScreen />)
    expect(await screen.findByText(/2 saatten az kaldı/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Randevuyu iptal et' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Saati değiştir' })).toBeNull()
  })

  it('K13: yeni saat seçilip onaylanınca reschedule gider; onay bekleyen talep metni çıkar', async () => {
    window.history.replaceState(null, '', '/book/manage#abcdefghijklmnopqrstuvwxyz')
    manageApi()
    mount(<ManageScreen />)
    fireEvent.click(await screen.findByRole('button', { name: 'Saati değiştir' }))
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yeni saati onayla' }))
    expect(await screen.findByRole('heading', { name: 'Yeni saat talebiniz alındı' })).toBeTruthy()
    expect(bodyOf('/bookings/reschedule')).toEqual({ token: 'abcdefghijklmnopqrstuvwxyz', startAt: slotId })
  })

  it('K14: değiştirme penceresi kapanmışsa sunucu hatası anlaşılır metinle gösterilir', async () => {
    window.history.replaceState(null, '', '/book/manage#abcdefghijklmnopqrstuvwxyz')
    manageApi()
    mount(<ManageScreen />)
    fireEvent.click(await screen.findByRole('button', { name: 'Saati değiştir' }))
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }))
    request.mockImplementation(async (path: string) => {
      if (path.endsWith('/reschedule')) throw new ApiError({ status: 409, code: 'MODIFY_WINDOW_CLOSED' })
      return path.endsWith('/lookup') ? { ...lookupBody, canModify: false } : { date: 'x', slots: [] }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yeni saati onayla' }))
    expect(await screen.findByText('Randevuya 2 saatten az kaldı. Değişiklik için salonu arayın.')).toBeTruthy()
  })

  it('K15: fiyat yalnız lookup döndürürse gösterilir', async () => {
    window.history.replaceState(null, '', '/book/manage#abcdefghijklmnopqrstuvwxyz')
    manageApi()
    mount(<ManageScreen />)
    await screen.findByText('BK-1')
    expect(screen.queryByText('Tutar')).toBeNull()
  })
})

describe('Salon rengi', () => {
  it('K16: geçerli renk birincil renk olur; bozuk renk yok sayılır', async () => {
    api({ tenant: { brandColor: '#336699' } })
    const { container } = mount(<BookingScreen slug="defne" />)
    await screen.findByRole('button', { name: /Saç kesimi/ })
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--color-primary')).toBe('#336699')
    cleanup()
    api({ tenant: { brandColor: 'red;background:url(x)' } })
    const second = mount(<BookingScreen slug="defne" />)
    await screen.findByRole('button', { name: /Saç kesimi/ })
    expect((second.container.firstElementChild as HTMLElement).style.getPropertyValue('--color-primary')).toBe('')
  })
})
