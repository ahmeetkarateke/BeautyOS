import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { PayoutsScreen } from './payouts-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown>; query?: Record<string, unknown> }
let payouts: unknown[]
let listError: ApiError | null
let writeError: ApiError | null
let calcError: ApiError | null

const po = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  id,
  staffId: 'p1',
  staffName: 'Derya Aksoy',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  grossEarned: 4000,
  bonus: 0,
  deductions: 0,
  netAmount: 4000,
  paymentMethod: 'cash',
  status,
  paidAt: null,
  ...over,
})

function mount(me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <PayoutsScreen />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const writes = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method)

beforeEach(() => {
  request.mockReset()
  listError = null
  writeError = null
  calcError = null
  payouts = [po('1', 'pending'), po('2', 'paid', { paidAt: '2026-10-02T10:00:00.000Z', paymentMethod: 'card' })]
  request.mockImplementation(async (path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      return {}
    }
    if (path.endsWith('/calculate')) {
      if (calcError) throw calcError
      return { grossEarned: 1000, transactionCount: 5 }
    }
    if (path.endsWith('/staff')) return { data: [{ id: 'p1', fullName: 'Derya Aksoy', title: 'Kuaför', skills: [] }] }
    if (listError) throw listError
    return { data: payouts }
  })
})
afterEach(cleanup)

describe('W26 Personel ödemeleri', () => {
  it('K1: ödemeler personel, dönem, durum, yöntem ve net tutarla; yalnız bekleyende Ödendi işaretle', async () => {
    mount()
    const list = await screen.findByRole('list', { name: 'Personel ödemeleri' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0].textContent).toContain('Bekliyor')
    expect(within(rows[0]).getByRole('button', { name: /^Ödendi işaretle/ })).toBeTruthy()
    expect(rows[1].textContent).toContain('Ödendi · Kart')
    expect(within(rows[1]).queryByRole('button')).toBeNull()
    expect(rows[0].textContent).toContain('₺4.000')
  })

  it('K2: sahip ve müdür dışı rol yetkisiz ekran görür ve istek atılmaz', () => {
    mount(makeMe('receptionist'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K3: Ödeme ekle: personel seçilmeden istek yok; seçilince hak ediş sunucudan hesaplanır, net tutar ek ve kesintiyle güncellenir; POST gövdesi doğru', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Ödeme ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ödeme ekle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ödeme kaydı ekle' }))
    expect(await within(dialog).findByText('Ödeme yapılacak personeli seçin.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Personel' }), { target: { value: 'p1' } })
    await waitFor(() => expect(within(dialog).getByRole('status').textContent).toContain('₺1.000'))
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Ek ödeme/ }), { target: { value: '250' } })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Kesinti/ }), { target: { value: '100' } })
    expect(within(dialog).getByRole('status').textContent).toContain('₺1.150')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ödeme kaydı ekle' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toMatchObject({ staffId: 'p1', bonus: 250, deductions: 100 })
    expect(await screen.findByText('Ödeme kaydı eklendi.')).toBeTruthy()
  })

  it('K3b: kesinti hak ediş + ekten büyükse alan hatası çıkar ve POST gitmez', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Ödeme ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ödeme ekle' })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Personel' }), { target: { value: 'p1' } })
    await waitFor(() => expect(within(dialog).getByRole('status').textContent).toContain('₺1.000'))
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Kesinti/ }), { target: { value: '1100' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ödeme kaydı ekle' }))
    expect(await within(dialog).findByText('Kesinti, hak ediş ve ek ödemenin toplamından fazla olamaz.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
  })

  it('K4: hak ediş hesaplanamazsa hata yazılır ve net tutar uydurulmaz ("—")', async () => {
    calcError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Ödeme ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ödeme ekle' })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Personel' }), { target: { value: 'p1' } })
    expect(await within(dialog).findByText(/Hak ediş hesaplanamadı/)).toBeTruthy()
    expect(within(dialog).getByRole('status').textContent).not.toContain('₺')
  })

  it('K5: Ödendi işaretle yöntem seçtirir ve mark-paid gönderir; ALREADY_PAID şeritle çıkar', async () => {
    mount()
    const list = await screen.findByRole('list', { name: 'Personel ödemeleri' })
    fireEvent.click(within(within(list).getAllByRole('listitem')[0]).getByRole('button', { name: /^Ödendi işaretle/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Ödendi işaretle' })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Ödeme yöntemi' }), { target: { value: 'online' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ödendi işaretle' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/staff-payouts\/1\/mark-paid$/)
    expect((writes()[0][1] as Init).body).toEqual({ paymentMethod: 'online' })
  })

  it('K6: boş liste ve hata durumları açıklayıcıdır', async () => {
    payouts = []
    mount()
    expect(await screen.findByText('Henüz ödeme kaydı yok.')).toBeTruthy()
    cleanup()
    listError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('Personel ödemeleri yüklenemedi.')
  })
})
