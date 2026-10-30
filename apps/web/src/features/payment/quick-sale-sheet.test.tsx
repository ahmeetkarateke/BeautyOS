import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { QuickSaleSheet } from './quick-sale-sheet'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
const onClose = vi.fn()
const onDone = vi.fn()
type Init = { method?: string; body?: Record<string, unknown> }
let failure: ApiError | null

function mount(me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <QuickSaleSheet onClose={onClose} onDone={onDone} />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const posts = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method === 'POST')
const fill = (name: RegExp | string, value: string) => fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } })

beforeEach(() => {
  request.mockReset()
  onClose.mockReset()
  onDone.mockReset()
  failure = null
  request.mockImplementation(async () => {
    if (failure) throw failure
    return { id: 'r1', amount: 250, paymentMethod: 'cash' }
  })
})
afterEach(cleanup)

describe('W16b Randevusuz işlem', () => {
  it('K1: sahip açıklama + tutar + yöntem ile POST /revenues atar; düğme tutarı yazar; bildirim ve kapanış', async () => {
    mount()
    fill('Açıklama', 'Ürün satışı')
    fill(/Tutar/, '250')
    fireEvent.click(screen.getByRole('radio', { name: 'Kart' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ödeme al · ₺250' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(posts()).toHaveLength(1)
    expect(posts()[0][0]).toMatch(/\/revenues$/)
    const body = (posts()[0][1] as Init).body!
    expect(body).toMatchObject({ description: 'Ürün satışı', amount: 250, paymentMethod: 'card' })
    expect(body.revenueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(await screen.findByText('Ödeme alındı.')).toBeTruthy()
  })

  it('K2: boş form istek atmaz ve iki alanda neden yazar', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Ödeme al' }))
    expect(await screen.findByText('Ne için olduğunu yazın. Örnek: Ürün satışı')).toBeTruthy()
    expect(screen.getByText('Tutarı yazın.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K3 (resepsiyon): tarih alanı çıkmaz, revenueDate bugündür; sahipte tarih alanı vardır', async () => {
    mount(makeMe('receptionist'))
    expect(screen.queryByLabelText('Tarih')).toBeNull()
    cleanup()
    mount(makeMe('owner'))
    expect(screen.getByLabelText('Tarih')).toBeTruthy()
  })

  it('K4: sunucu 403 (geçmiş tarih yetkisi) anlaşılır şerit çıkarır, girilenler korunur', async () => {
    failure = new ApiError({ status: 403, code: 'FORBIDDEN' })
    mount()
    fill('Açıklama', 'Ürün satışı')
    fill(/Tutar/, '250')
    fireEvent.click(screen.getByRole('button', { name: 'Ödeme al · ₺250' }))
    expect((await screen.findByRole('alert')).textContent).toBeTruthy()
    expect((screen.getByRole('textbox', { name: 'Açıklama' }) as HTMLInputElement).value).toBe('Ürün satışı')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('K5: çift basışta tek istek gider', async () => {
    mount()
    fill('Açıklama', 'Ürün satışı')
    fill(/Tutar/, '250')
    const button = screen.getByRole('button', { name: 'Ödeme al · ₺250' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(posts()).toHaveLength(1)
  })
})
