import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import type { DayAppointment } from '@/features/appointments/day-logic'
import { ApprovalSheet } from './approval-sheet'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient

const pending = (over: Partial<DayAppointment> = {}): DayAppointment => ({
  id: 'r1', staffKey: 'p1', staffName: 'Derya Aksoy', customerId: null, serviceId: 'sv1', customerName: 'Ayşe Demir', customerPhone: '+90 532 111 22 33',
  unverified: true, serviceName: 'Saç boyama', start: new Date('2026-10-28T11:00:00Z'), end: new Date('2026-10-28T12:00:00Z'),
  status: 'pending', price: 900, notes: '', ...over,
})

const onClose = vi.fn()
const onChanged = vi.fn()
const candidates = { data: [{ id: 'c1', fullName: 'Ayşe Demir' }, { id: 'c2', fullName: 'Ayşe Demirci' }] }

function mount(req: DayAppointment | null) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={makeMe('owner')}>
        <ToastProvider>
          <ApprovalSheet request={req} onClose={onClose} onChanged={onChanged} />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}

type Init = { method?: string; body?: unknown }
function route(handlers: Record<string, (init?: Init) => unknown>) {
  request.mockImplementation(async (path: string, init?: Init) => {
    const key = Object.keys(handlers).find((k) => path.endsWith(k))
    if (!key) throw new Error(`beklenmeyen çağrı ${path}`)
    return handlers[key](init)
  })
}
const callTo = (suffix: string) => request.mock.calls.find(([p]) => String(p).endsWith(suffix))

async function readyApprove() {
  const approve = (await screen.findByRole('button', { name: 'Talebi onayla' })) as HTMLButtonElement
  return approve
}

beforeEach(() => {
  request.mockReset()
  onClose.mockReset()
  onChanged.mockReset()
})
afterEach(cleanup)

describe('W10 onay katmanı (S2 uçları)', () => {
  it('K-onay: eşleşen müşteri yokken doğrudan onaylar (gövde boş), listeyi yeniler ve kapanır', async () => {
    route({ '/customer-candidates': () => ({ data: [] }), '/approve': () => ({ id: 'r1', status: 'confirmed' }) })
    mount(pending())
    const approve = await readyApprove()
    await waitFor(() => expect(approve.disabled).toBe(false))
    fireEvent.click(approve)
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    const call = callTo('/approve')!
    expect(call[0]).toBe('/api/v1/tenants/defne/appointments/r1/approve')
    expect(call[1].method).toBe('PATCH')
    expect(call[1].body).toEqual({})
    expect(onClose).toHaveBeenCalled()
  })

  it('K-onay: aday müşteri varsa seçim yapılmadan onaylanamaz; seçilen müşteriye bağlanır', async () => {
    route({ '/customer-candidates': () => candidates, '/approve': () => ({}) })
    mount(pending())
    const approve = await readyApprove()
    await screen.findByText('Ayşe Demirci')
    expect(approve.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: /Ayşe Demirci/ }))
    expect(approve.disabled).toBe(false)
    fireEvent.click(approve)
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(callTo('/approve')![1].body).toEqual({ customerAction: 'link', customerId: 'c2' })
  })

  it('K-onay: "Yeni müşteri olarak ekle" seçilince create gönderilir', async () => {
    route({ '/customer-candidates': () => candidates, '/approve': () => ({}) })
    mount(pending())
    fireEvent.click(await screen.findByRole('radio', { name: /Yeni müşteri olarak ekle/ }))
    fireEvent.click(await readyApprove())
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(callTo('/approve')![1].body).toEqual({ customerAction: 'create' })
  })

  it('K-onay: doğrulanmış (müşterisi bağlı) talep için aday sorgusu yapılmaz', async () => {
    route({ '/approve': () => ({}) })
    mount(pending({ unverified: false, customerId: 'c9' }))
    const approve = await readyApprove()
    expect(approve.disabled).toBe(false)
    expect(callTo('customer-candidates')).toBeUndefined()
  })

  it('K-hata: NOT_PENDING anlaşılır metin gösterir ve listeyi yeniler, katman açık kalır', async () => {
    route({ '/customer-candidates': () => ({ data: [] }), '/approve': () => { throw new ApiError({ status: 409, code: 'NOT_PENDING' }) } })
    mount(pending())
    const approve = await readyApprove()
    await waitFor(() => expect(approve.disabled).toBe(false))
    fireEvent.click(approve)
    expect((await screen.findByRole('alert')).textContent).toContain('Bu talep artık onay beklemiyor.')
    expect(onChanged).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('K-hata: CUSTOMER_PHONE_MISMATCH metni gösterilir, katman açık kalır', async () => {
    route({ '/customer-candidates': () => candidates, '/approve': () => { throw new ApiError({ status: 409, code: 'CUSTOMER_PHONE_MISMATCH' }) } })
    mount(pending())
    fireEvent.click(await screen.findByRole('radio', { name: /Ayşe Demir$/ }))
    fireEvent.click(await readyApprove())
    expect((await screen.findByRole('alert')).textContent).toContain('telefonu talepteki telefonla aynı değil')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('K-ret: Reddet önce onay ister; onaylanınca reject çağrılır', async () => {
    route({ '/customer-candidates': () => ({ data: [] }), '/reject': () => ({}) })
    mount(pending())
    fireEvent.click(await screen.findByRole('button', { name: 'Talebi reddet' }))
    expect(callTo('/reject')).toBeUndefined()
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Talebi reddet' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(callTo('/reject')![1].method).toBe('PATCH')
  })

  it('K-aday-hata: aday listesi yüklenemezse onay kapalı kalır ve yeniden dene sunulur', async () => {
    route({ '/customer-candidates': () => { throw new ApiError({ status: 500, code: 'INTERNAL_ERROR' }) } })
    mount(pending())
    expect(await screen.findByText('Eşleşen müşteriler yüklenemedi.')).toBeTruthy()
    expect((await readyApprove()).disabled).toBe(true)
  })

  it('K-kapalı: talep yoksa katman çizilmez', () => {
    mount(null)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
