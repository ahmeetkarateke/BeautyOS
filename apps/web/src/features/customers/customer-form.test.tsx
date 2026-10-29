import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { EditCustomerScreen, NewCustomerScreen } from './customer-form'
import '@/ui/test-polyfills'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => '/panel/defne/musteri-yeni' }))

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown> }
let respond: (path: string, init?: Init) => unknown

function mount(node: React.ReactNode, me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>{node}</ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const writes = () => request.mock.calls.filter(([, init]) => init?.method === 'POST' || init?.method === 'PATCH')
const name = () => screen.getByRole('textbox', { name: /Ad soyad/ }) as HTMLInputElement
const phone = () => screen.getByRole('textbox', { name: /Telefon/ }) as HTMLInputElement
const fill = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })
const submit = (label: RegExp | string) => fireEvent.click(screen.getByRole('button', { name: label }))

beforeEach(() => {
  request.mockReset()
  push.mockReset()
  respond = (_path, init) => (init?.method === 'POST' ? { id: 'c9' } : {})
  request.mockImplementation(async (path: string, init?: Init) => {
    const result = respond(path, init)
    if (result instanceof Error) throw result
    return result
  })
})
afterEach(cleanup)

describe('W17 Yeni müşteri', () => {
  it('K1: boş gönderimde alan hataları çıkar, ilk hatalı alana odaklanır, istek atılmaz', async () => {
    mount(<NewCustomerScreen />)
    submit('Müşteri ekle')
    expect(await screen.findByText('Adı yazın. En az 2 harf gerekir.')).toBeTruthy()
    expect(screen.getByText('Telefonu 5xx xxx xx xx biçiminde yazın.')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(name()))
    expect(request).not.toHaveBeenCalled()
  })

  it('K2: geçerli form POST eder (0 önekli telefon), bildirim verir ve listeye döner', async () => {
    mount(<NewCustomerScreen />)
    fill(name(), 'Ayşe Demir')
    fill(phone(), '532 123 45 67')
    submit('Müşteri ekle')
    await waitFor(() => expect(push).toHaveBeenCalledWith('/panel/defne/musteriler'))
    expect(writes()).toHaveLength(1)
    expect(writes()[0][1].body).toEqual({ fullName: 'Ayşe Demir', phone: '05321234567' })
    expect(await screen.findByText('Müşteri eklendi.')).toBeTruthy()
  })

  it('K3: ad alanı 100 karakterle sınırlıdır (maxLength)', () => {
    mount(<NewCustomerScreen />)
    expect(name().maxLength).toBe(100)
  })

  it('K4: DUPLICATE_PHONE: iki seçenek çıkar; Yine de ekle allowSharedPhone: true ile yeniden gönderir', async () => {
    let first = true
    respond = (_p, init) => {
      if (init?.method !== 'POST') return {}
      if (first) {
        first = false
        return new ApiError({ status: 409, code: 'DUPLICATE_PHONE' })
      }
      return { id: 'c9' }
    }
    mount(<NewCustomerScreen />)
    fill(name(), 'Zeynep Demir')
    fill(phone(), '5321234567')
    submit('Müşteri ekle')
    expect(await screen.findByText(/Bu telefonla kayıtlı bir müşteri zaten var/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Kayıtlı müşteri ara' }).getAttribute('href')).toBe('/panel/defne/musteriler')
    expect(push).not.toHaveBeenCalled()
    submit('Yine de ekle')
    await waitFor(() => expect(push).toHaveBeenCalledWith('/panel/defne/musteriler'))
    expect(writes()).toHaveLength(2)
    expect(writes()[0][1].body).not.toHaveProperty('allowSharedPhone')
    expect(writes()[1][1].body).toEqual({ fullName: 'Zeynep Demir', phone: '05321234567', allowSharedPhone: true })
  })

  it('K5: telefon değişince Yine de ekle kalkar, normal Ekle düğmesi döner (bilinçli onay yalnız o numara için)', async () => {
    respond = (_p, init) => (init?.method === 'POST' ? new ApiError({ status: 409, code: 'DUPLICATE_PHONE' }) : {})
    mount(<NewCustomerScreen />)
    fill(name(), 'Zeynep Demir')
    fill(phone(), '5321234567')
    submit('Müşteri ekle')
    await screen.findByRole('button', { name: 'Yine de ekle' })
    fill(phone(), '5329876543')
    expect(screen.queryByRole('button', { name: 'Yine de ekle' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Müşteri ekle' })).toBeTruthy()
  })

  it('K6: sunucu hatasında anlaşılır şerit çıkar, girilenler korunur, yönlendirme olmaz', async () => {
    respond = (_p, init) => (init?.method === 'POST' ? new ApiError({ status: 500, code: 'INTERNAL_ERROR' }) : {})
    mount(<NewCustomerScreen />)
    fill(name(), 'Ayşe Demir')
    fill(phone(), '5321234567')
    submit('Müşteri ekle')
    expect((await screen.findByRole('alert')).textContent).toBeTruthy()
    expect(name().value).toBe('Ayşe Demir')
    expect(push).not.toHaveBeenCalled()
  })

  it('K7: kayıt izni olmayan rol (uzman) formu göremez', () => {
    mount(<NewCustomerScreen />, makeMe('staff'))
    expect(screen.queryByRole('textbox', { name: /Ad soyad/ })).toBeNull()
  })
})

describe('W17 Müşteri düzenle', () => {
  const detail = {
    id: 'c1',
    fullName: 'Ayşe Demir',
    phone: '+905321234567',
    email: 'ayse@ornek.com',
    birthDate: '1990-05-17T00:00:00.000Z',
    preferenceNotes: null,
  }

  it('K8: kayıt forma dolar (telefon ulusal biçimde); yalnız değişen alan PATCH edilir', async () => {
    respond = (_p, init) => (init?.method === 'PATCH' ? {} : detail)
    mount(<EditCustomerScreen customerId="c1" />)
    await waitFor(() => expect(name().value).toBe('Ayşe Demir'))
    expect(phone().value).toBe('532 123 45 67')
    fill(name(), 'Ayşe Demir Kaya')
    submit('Değişiklikleri kaydet')
    await waitFor(() => expect(push).toHaveBeenCalledWith('/panel/defne/musteriler'))
    expect(writes()).toHaveLength(1)
    expect(writes()[0][0]).toMatch(/customers\/c1$/)
    expect(writes()[0][1].body).toEqual({ fullName: 'Ayşe Demir Kaya' })
  })

  it('K9: değişiklik yoksa istek atılmaz ve bunu söyler', async () => {
    respond = () => detail
    mount(<EditCustomerScreen customerId="c1" />)
    await waitFor(() => expect(name().value).toBe('Ayşe Demir'))
    submit('Değişiklikleri kaydet')
    expect(await screen.findByText('Değişiklik yapmadınız.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })

  it('K10: telefonu olmayan kayıt (Telegram) telefon boş bırakılarak kaydedilebilir', async () => {
    respond = (_p, init) => (init?.method === 'PATCH' ? {} : { ...detail, phone: null })
    mount(<EditCustomerScreen customerId="c1" />)
    await waitFor(() => expect(name().value).toBe('Ayşe Demir'))
    expect(phone().value).toBe('')
    fill(name(), 'Ayşe K.')
    submit('Değişiklikleri kaydet')
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][1].body).toEqual({ fullName: 'Ayşe K.' })
  })

  it('K11: kayıt bulunamazsa (404) açıklayıcı boş durum; yüklenemezse Yeniden dene', async () => {
    respond = () => new ApiError({ status: 404, code: 'NOT_FOUND' })
    mount(<EditCustomerScreen customerId="x" />)
    expect(await screen.findByText('Müşteri bulunamadı.')).toBeTruthy()
    cleanup()
    respond = () => new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount(<EditCustomerScreen customerId="x" />)
    expect((await screen.findByRole('alert')).textContent).toContain('Müşteri bilgileri yüklenemedi.')
    expect(screen.getByRole('button', { name: 'Yeniden dene' })).toBeTruthy()
  })

  it('K12: telefon değiştiğinde DUPLICATE_PHONE ile Yine de ekle PATCH gövdesine allowSharedPhone ekler', async () => {
    let first = true
    respond = (_p, init) => {
      if (init?.method !== 'PATCH') return detail
      if (first) {
        first = false
        return new ApiError({ status: 409, code: 'DUPLICATE_PHONE' })
      }
      return {}
    }
    mount(<EditCustomerScreen customerId="c1" />)
    await waitFor(() => expect(name().value).toBe('Ayşe Demir'))
    fill(phone(), '5329876543')
    submit('Değişiklikleri kaydet')
    await screen.findByRole('button', { name: 'Yine de ekle' })
    submit('Yine de ekle')
    await waitFor(() => expect(writes()).toHaveLength(2))
    expect(writes()[1][1].body).toEqual({ phone: '05329876543', allowSharedPhone: true })
  })
})
