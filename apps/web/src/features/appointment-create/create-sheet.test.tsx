import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import type { Me } from '@/lib/v2/me'
import { ToastProvider } from '@/ui/toast'
import { CreateAppointmentSheet } from './create-sheet'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
const onOpenChange = vi.fn()
const onCreated = vi.fn()

const services = { data: [{ id: 'sv1', name: 'Fön', durationMinutes: 45, price: 500, category: 'Saç' }, { id: 'sv2', name: 'Cilt bakımı', durationMinutes: 60, price: 900, category: 'Cilt' }] }
const staff = {
  data: [
    { id: 'p1', fullName: 'Derya Aksoy', title: 'Kuaför', skills: [{ serviceId: 'sv1' }] },
    { id: 'p2', fullName: 'Elif Tan', title: 'Estetisyen', skills: [{ serviceId: 'sv2' }] },
  ],
}
const customersData = { data: [{ id: 'c1', fullName: 'Ayşe Demir', phone: '0532 111 22 33' }] }
let slotsData: { slots: { id: string; label: string; available: boolean }[] }
let slotsError: ApiError | null
let createError: ApiError | null
let customerError: ApiError | null
let emptySearch: boolean

type Init = { method?: string; body?: Record<string, unknown>; query?: Record<string, string> }
const calls = (suffix: string, method?: string) =>
  request.mock.calls.filter(([p, i]) => String(p).endsWith(suffix) && (i as Init | undefined)?.method === method)

function mount(me: Me = makeMe('owner'), props: Partial<React.ComponentProps<typeof CreateAppointmentSheet>> = {}) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <CreateAppointmentSheet open onOpenChange={onOpenChange} today="2026-10-28" onCreated={onCreated} {...props} />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}

beforeEach(() => {
  request.mockReset()
  onOpenChange.mockReset()
  onCreated.mockReset()
  slotsError = null
  createError = null
  customerError = null
  emptySearch = false
  slotsData = {
    slots: [
      { id: '2026-10-28T07:00:00', label: '10:00', available: true },
      { id: '2026-10-28T07:45:00', label: '10:45', available: false },
      { id: '2026-10-28T08:30:00', label: '11:30', available: true },
    ],
  }
  request.mockImplementation(async (path: string, init?: Init) => {
    if (path.endsWith('/services')) return services
    if (path.endsWith('/staff')) return staff
    if (path.endsWith('/slots')) {
      if (slotsError) throw slotsError
      return slotsData
    }
    if (path.endsWith('/customers') && init?.method === 'POST') {
      if (customerError) throw customerError
      return { id: 'cNew' }
    }
    if (path.endsWith('/customers')) return emptySearch ? { data: [] } : customersData
    if (path.endsWith('/appointments') && init?.method === 'POST') {
      if (createError) throw createError
      return { id: 'a9' }
    }
    throw new Error(`beklenmeyen çağrı ${path}`)
  })
})
afterEach(cleanup)

async function pickExistingCustomer() {
  fireEvent.change(screen.getByRole('searchbox', { name: /Müşteri ara/ }), { target: { value: 'Ayşe' } })
  fireEvent.click(await screen.findByRole('button', { name: /Ayşe Demir/ }))
}
async function pickNewCustomer() {
  emptySearch = true
  fireEvent.change(screen.getByRole('searchbox', { name: /Müşteri ara/ }), { target: { value: 'Zeynep Kaya' } })
  fireEvent.click(await screen.findByRole('button', { name: /Zeynep Kaya adıyla yeni müşteri ekle/ }))
  fireEvent.change(screen.getByLabelText(/Telefon/), { target: { value: '532 123 45 67' } })
}
async function pickServiceAndStaff() {
  fireEvent.click(await screen.findByRole('button', { name: /Fön/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Derya/ }))
}
const submit = () => screen.getByRole('button', { name: 'Randevu oluştur' }) as HTMLButtonElement

describe('W13 Randevu oluştur', () => {
  it('K-arama: 2 karakterden önce arama yapılmaz; sonra müşteri listelenir ve seçilir', async () => {
    mount()
    fireEvent.change(screen.getByRole('searchbox', { name: /Müşteri ara/ }), { target: { value: 'A' } })
    expect(calls('/customers', undefined)).toHaveLength(0)
    await pickExistingCustomer()
    expect(calls('/customers', undefined)[0][1].query).toMatchObject({ search: 'Ayşe' })
    expect(screen.getByRole('button', { name: 'Değiştir' })).toBeTruthy()
  })

  it('K-personel: yalnız seçilen hizmeti veren personel listelenir', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /Fön/ }))
    expect(await screen.findByRole('button', { name: /Derya/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Elif/ })).toBeNull()
  })

  it('K-saat: yalnız boş saatler seçilebilir; dolu saat çizilmez; slot Z ekli ISO ile gönderilir', async () => {
    mount()
    await pickExistingCustomer()
    await pickServiceAndStaff()
    expect(await screen.findByRole('button', { name: '10:00' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '10:45' })).toBeNull()
    expect(submit().disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '11:30' }))
    expect(submit().disabled).toBe(false)
    fireEvent.click(submit())
    await waitFor(() => expect(calls('/appointments', 'POST')).toHaveLength(1))
    expect(calls('/appointments', 'POST')[0][1].body).toEqual({ customerId: 'c1', serviceId: 'sv1', staffId: 'p1', startAt: '2026-10-28T08:30:00Z' })
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('K-yeni-müşteri: arama sonuçsuzsa yeni müşteri formu açılır; önce müşteri sonra randevu oluşturulur', async () => {
    mount()
    await pickNewCustomer()
    await pickServiceAndStaff()
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }))
    fireEvent.click(submit())
    await waitFor(() => expect(calls('/appointments', 'POST')).toHaveLength(1))
    expect(calls('/customers', 'POST')[0][1].body).toEqual({ fullName: 'Zeynep Kaya', phone: '05321234567' })
    expect(calls('/appointments', 'POST')[0][1].body).toMatchObject({ customerId: 'cNew' })
  })

  it('K-409: SLOT_TAKEN saat bölümünde hata gösterir, saatleri yeniler, seçimi temizler ve katmanı açık tutar', async () => {
    mount()
    await pickExistingCustomer()
    await pickServiceAndStaff()
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }))
    createError = new ApiError({ status: 409, code: 'SLOT_TAKEN' })
    const before = calls('/slots', undefined).length
    fireEvent.click(submit())
    expect((await screen.findByRole('alert')).textContent).toContain('Bu saat doldu.')
    await waitFor(() => expect(calls('/slots', undefined).length).toBeGreaterThan(before))
    expect(submit().disabled).toBe(true)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('K-409-yeni-müşteri: saat dolduktan sonra yeniden denemede müşteri ikinci kez oluşturulmaz', async () => {
    mount()
    await pickNewCustomer()
    await pickServiceAndStaff()
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }))
    createError = new ApiError({ status: 409, code: 'SLOT_TAKEN' })
    fireEvent.click(submit())
    await screen.findByRole('alert')
    createError = null
    fireEvent.click(await screen.findByRole('button', { name: '11:30' }))
    fireEvent.click(submit())
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(calls('/customers', 'POST')).toHaveLength(1)
  })

  it('K-hata: boş saat yoksa açıklama görünür', async () => {
    slotsData = { slots: [{ id: '2026-10-28T07:00:00', label: '10:00', available: false }] }
    mount()
    await pickExistingCustomer()
    await pickServiceAndStaff()
    expect(await screen.findByText('Bu gün boş saat yok. Başka bir gün seçin.')).toBeTruthy()
  })

  it('K-hata: saat sorgusu hata verirse hata ve Yeniden dene görünür (sessiz boşluk yok)', async () => {
    slotsError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    await pickExistingCustomer()
    await pickServiceAndStaff()
    expect(await screen.findByText('Boş saatler yüklenemedi.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeTruthy()
  })

  it('K-hata: hizmet listesi hata verirse blok içi hata çıkar', async () => {
    request.mockImplementation(async (path: string) => {
      if (path.endsWith('/services')) throw new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
      if (path.endsWith('/staff')) return staff
      throw new Error(path)
    })
    mount()
    expect(await screen.findByText('Hizmetler yüklenemedi.')).toBeTruthy()
  })

  it('K-hata: personel listesi hata verirse blok içi hata çıkar', async () => {
    request.mockImplementation(async (path: string) => {
      if (path.endsWith('/services')) return services
      if (path.endsWith('/staff')) throw new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
      throw new Error(path)
    })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /Fön/ }))
    expect(await screen.findByText('Personel listesi yüklenemedi.')).toBeTruthy()
  })

  it('K-hata: müşteri araması hata verirse hata görünür, boş sonuç gibi davranılmaz', async () => {
    request.mockImplementation(async (path: string) => {
      if (path.endsWith('/customers')) throw new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
      if (path.endsWith('/services')) return services
      if (path.endsWith('/staff')) return staff
      throw new Error(path)
    })
    mount()
    fireEvent.change(screen.getByRole('searchbox', { name: /Müşteri ara/ }), { target: { value: 'Ayşe' } })
    expect(await screen.findByText('Müşteri araması yapılamadı.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /adıyla yeni müşteri ekle/ })).toBeNull()
  })

  it('K-hata: aynı telefonlu müşteri (DUPLICATE_PHONE) anlaşılır metin verir, randevu denenmez', async () => {
    customerError = new ApiError({ status: 409, code: 'DUPLICATE_PHONE' })
    mount()
    await pickNewCustomer()
    await pickServiceAndStaff()
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }))
    fireEvent.click(submit())
    expect((await screen.findByRole('alert')).textContent).toMatch(/telefon/i)
    expect(calls('/appointments', 'POST')).toHaveLength(0)
  })

  it('K-uzman: uzman kendi adına açar; personel seçimi ve fiyat görünmez, personel olarak kendi kimliği gönderilir', async () => {
    mount({ ...makeMe('staff'), staffId: 'p1' })
    await pickExistingCustomer()
    fireEvent.click(await screen.findByRole('button', { name: /Fön/ }))
    expect(screen.queryByRole('group', { name: 'Personel' })).toBeNull()
    expect(screen.queryByText(/₺/)).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }))
    fireEvent.click(submit())
    await waitFor(() => expect(calls('/appointments', 'POST')).toHaveLength(1))
    expect(calls('/appointments', 'POST')[0][1].body).toMatchObject({ staffId: 'p1' })
    expect(calls('/staff', undefined)).toHaveLength(0)
  })

  it('K-ön-seçim: takvimden gelen personel ve saat önceden seçili gelir', async () => {
    mount(makeMe('owner'), { initial: { staffId: 'p1', time: '11:30' } })
    await pickExistingCustomer()
    fireEvent.click(await screen.findByRole('button', { name: /Fön/ }))
    const slot = await screen.findByRole('button', { name: '11:30' })
    await waitFor(() => expect(slot.getAttribute('aria-pressed')).toBe('true'))
  })

  it('K-14-gün: tarih şeridi 14 gün gösterir ve gün değişince o güne saat sorulur', async () => {
    mount()
    await pickExistingCustomer()
    await pickServiceAndStaff()
    const strip = screen.getByRole('group', { name: 'Tarih seçin' })
    expect(within(strip).getAllByRole('button')).toHaveLength(14)
    fireEvent.click(within(strip).getAllByRole('button')[1])
    await waitFor(() => expect(calls('/slots', undefined).some(([, i]) => (i as Init).query?.date === '2026-10-29')).toBe(true))
  })
})
