import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DayAppointment } from '@/features/appointments/day-logic'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { CompleteSheet } from './complete-sheet'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
const onClose = vi.fn()
const onDone = vi.fn()
const onStale = vi.fn()
type Init = { method?: string; body?: Record<string, unknown> }
let failure: ApiError | null

const appt = (over: Partial<DayAppointment> = {}): DayAppointment => ({
  id: 'a1',
  staffKey: 'p1',
  staffName: 'Derya Aksoy',
  customerId: 'c1',
  serviceId: 'sv1',
  customerName: 'Ayşe Demir',
  customerPhone: '0532 000 00 00',
  unverified: false,
  serviceName: 'Fön',
  start: new Date('2026-10-29T07:00:00Z'),
  end: new Date('2026-10-29T07:45:00Z'),
  status: 'in_progress',
  price: 850,
  notes: '',
  ...over,
})

function mount(me: Me = makeMe('owner'), a: DayAppointment = appt()) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <CompleteSheet appointment={a} onClose={onClose} onDone={onDone} onStale={onStale} />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const patches = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method === 'PATCH')
const payButton = (name: RegExp | string) => screen.getByRole('button', { name })

beforeEach(() => {
  request.mockReset()
  onClose.mockReset()
  onDone.mockReset()
  onStale.mockReset()
  failure = null
  request.mockImplementation(async () => {
    if (failure) throw failure
    return {
      id: 'a1',
      status: 'completed',
      payment: { transactionId: 't1', grossAmount: 850, paymentMethod: 'cash', cashAmount: 850, cardAmount: 0, completedAt: '2026-10-29T08:00:00Z' },
    }
  })
})
afterEach(cleanup)

describe('W16 Tamamla ve ödeme al', () => {
  it('K1: sahip varsayılan nakit ve hizmet fiyatıyla tek istek atar; priceCharged gönderilmez; bildirim ve kapanış', async () => {
    mount()
    fireEvent.click(payButton('Ödeme al · ₺850'))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(patches()).toHaveLength(1)
    expect(patches()[0][0]).toMatch(/appointments\/a1\/status$/)
    expect((patches()[0][1] as Init).body).toEqual({ status: 'completed', paymentMethod: 'cash' })
    expect(await screen.findByText('Ödeme alındı.')).toBeTruthy()
  })

  it('K2: kart seçilir ve indirimli tutar priceCharged olarak gider; düğme yeni tutarı yazar', async () => {
    mount()
    fireEvent.click(screen.getByRole('radio', { name: 'Kart' }))
    fireEvent.change(screen.getByRole('textbox', { name: /Tutar/ }), { target: { value: '700,50' } })
    fireEvent.click(payButton('Ödeme al · ₺700,50'))
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect((patches()[0][1] as Init).body).toEqual({ status: 'completed', paymentMethod: 'card', priceCharged: 700.5 })
  })

  it('K3 (R3): uzmanda tutar salt okunur ve açıklamalı; tutar değiştirilemez, priceCharged gitmez', async () => {
    mount({ ...makeMe('staff'), staffId: 'p1' })
    const amount = screen.getByRole('textbox', { name: 'Tutar' }) as HTMLInputElement
    expect(amount.readOnly).toBe(true)
    expect(amount.value).toBe('₺850')
    expect(screen.getByText('Tutarı yalnız salon yönetimi değiştirebilir.')).toBeTruthy()
    fireEvent.click(payButton('Ödeme al · ₺850'))
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect((patches()[0][1] as Init).body).not.toHaveProperty('priceCharged')
  })

  it('K4: geçersiz tutar istek atmaz ve nedenini söyler', () => {
    mount()
    fireEvent.change(screen.getByRole('textbox', { name: /Tutar/ }), { target: { value: '85a' } })
    fireEvent.click(payButton(/Ödeme al/))
    expect(screen.getByText('Tutarı yalnız rakamlarla yazın. Örnek: 850 ya da 850,50')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K5: çift basışta tek istek gider (ikinci ödeme oluşmaz)', async () => {
    mount()
    const button = payButton('Ödeme al · ₺850')
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(patches()).toHaveLength(1)
  })

  it('K6: STATUS_LOCKED (başkası tamamlamış): anlaşılır şerit, ekran verisi yenilenir, kapanmaz', async () => {
    failure = new ApiError({ status: 409, code: 'STATUS_LOCKED' })
    mount()
    fireEvent.click(payButton('Ödeme al · ₺850'))
    expect((await screen.findByRole('alert')).textContent).toContain('artık işlem kabul etmiyor')
    expect(onStale).toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('K7: DAY_CLOSED (kapalı gün): nedeni ve çıkış yolu yazılır, ödeme alındı bildirimi çıkmaz', async () => {
    failure = new ApiError({ status: 409, code: 'DAY_CLOSED' })
    mount()
    fireEvent.click(payButton('Ödeme al · ₺850'))
    expect((await screen.findByRole('alert')).textContent).toContain('Bu günün kasası kapatılmış')
    expect(screen.queryByText('Ödeme alındı.')).toBeNull()
  })

  it('K8: ağ hatasında anlaşılır şerit çıkar, girilen tutar korunur', async () => {
    failure = new ApiError({ status: 0, code: 'NETWORK' })
    mount()
    fireEvent.change(screen.getByRole('textbox', { name: /Tutar/ }), { target: { value: '900' } })
    fireEvent.click(payButton('Ödeme al · ₺900'))
    expect((await screen.findByRole('alert')).textContent).toBeTruthy()
    expect((screen.getByRole('textbox', { name: /Tutar/ }) as HTMLInputElement).value).toBe('900')
  })

  it('K9: paketten düşme ve karma ödeme "Yakında" olarak açıklanır', () => {
    mount()
    expect(screen.getByText('Paketten düşme ve karma ödeme yakında.')).toBeTruthy()
  })
})
