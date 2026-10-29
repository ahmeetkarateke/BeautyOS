import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { PrimimScreen } from './primim-screen'
import { ReportsScreen } from './reports-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { query?: Record<string, unknown> }
let cashReport: Record<string, unknown>
let commissions: unknown[]
let payouts: unknown[]
let cashError: ApiError | null
let payoutError: ApiError | null

function mount(node: React.ReactNode, me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>{node}</ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const openTab = (tab: HTMLElement) => fireEvent.mouseDown(tab, { button: 0, ctrlKey: false })
const cashCalls = () => request.mock.calls.filter(([p]) => String(p).endsWith('/reports/daily'))

beforeEach(() => {
  request.mockReset()
  cashError = null
  payoutError = null
  cashReport = {
    from: '2026-10-23',
    to: '2026-10-29',
    totalRevenue: 5000,
    cashRevenue: 3000,
    cardRevenue: 2000,
    completedCount: 8,
    netRevenue: 4200,
    daily: [
      { date: '2026-10-28', revenue: 2000, cashRevenue: 1000, cardRevenue: 1000, completedCount: 3, expenses: 300, netRevenue: 1700 },
      { date: '2026-10-29', revenue: 3000, cashRevenue: 2000, cardRevenue: 1000, completedCount: 5, expenses: 500, netRevenue: 2500 },
    ],
  }
  commissions = [
    { staffId: 's1', staffName: 'Derya Aksoy', completedAppointments: 4, revenue: 2400, commission: 240 },
    { staffId: 's2', staffName: 'Elif Tan', completedAppointments: 2, revenue: 1800, commission: 360 },
  ]
  payouts = [
    {
      id: 'p1',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      grossEarned: 4000,
      bonus: 0,
      deductions: 0,
      netAmount: 4000,
      status: 'paid',
      paidAt: '2026-10-02T10:00:00.000Z',
    },
    {
      id: 'p2',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      grossEarned: 1000,
      bonus: 0,
      deductions: 0,
      netAmount: 1000,
      status: 'pending',
      paidAt: null,
    },
  ]
  request.mockImplementation(async (path: string) => {
    if (path.endsWith('/reports/daily')) {
      if (cashError) throw cashError
      return cashReport
    }
    if (path.endsWith('/reports/staff-commissions')) return { data: commissions }
    if (path.endsWith('/staff-payouts')) {
      if (payoutError) throw payoutError
      return { data: payouts }
    }
    throw new Error(`beklenmeyen çağrı ${path}`)
  })
})
afterEach(cleanup)

describe('W23 Raporlar', () => {
  it('K1: Kasa raporu son 7 günle açılır; özet ve günlük döküm tablosu yazılır; groupBy=day istenir', async () => {
    mount(<ReportsScreen />)
    expect(await screen.findByText('₺5.000')).toBeTruthy()
    const query = (cashCalls()[0][1] as Init).query!
    expect(query.groupBy).toBe('day')
    expect(String(query.from)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const table = screen.getByRole('table', { name: 'Günlük döküm' })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(table.textContent).toContain('₺1.700')
  })

  it('K2: Bugün seçilince from=to olur ve yeni istek atılır', async () => {
    mount(<ReportsScreen />)
    await screen.findByText('₺5.000')
    fireEvent.click(screen.getByRole('radio', { name: 'Bugün' }))
    await waitFor(() => expect(cashCalls()).toHaveLength(2))
    const q = (cashCalls()[1][1] as Init).query!
    expect(q.from).toBe(q.to)
  })

  it('K3: Tarih seç: geçersiz aralık (başlangıç > bitiş) istek atmaz ve nedenini yazar', async () => {
    mount(<ReportsScreen />)
    await screen.findByText('₺5.000')
    fireEvent.click(screen.getByRole('radio', { name: 'Tarih seç' }))
    fireEvent.change(screen.getByLabelText('Başlangıç'), { target: { value: '2026-10-20' } })
    fireEvent.change(screen.getByLabelText('Bitiş'), { target: { value: '2026-10-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Raporu göster' }))
    expect(await screen.findByText('Başlangıç tarihi bitişten sonra olamaz.')).toBeTruthy()
    expect(cashCalls()).toHaveLength(1)
  })

  it('K4: dönemde tahsilat yoksa açıklayıcı boş durum; hata Yeniden dene', async () => {
    cashReport = { ...cashReport, daily: [], totalRevenue: 0 }
    mount(<ReportsScreen />)
    expect(await screen.findByText('Bu dönemde tahsilat yok.')).toBeTruthy()
    cleanup()
    cashError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount(<ReportsScreen />)
    expect((await screen.findByRole('alert')).textContent).toContain('Kasa raporu yüklenemedi.')
  })

  it('K5: Prim raporu prim büyükten küçüğe sıralıdır', async () => {
    mount(<ReportsScreen />)
    openTab(await screen.findByRole('tab', { name: 'Prim raporu' }))
    const table = await screen.findByRole('table', { name: 'Personel primleri' })
    const names = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.textContent ?? '')
    expect(names[0]).toContain('Elif Tan')
    expect(names[1]).toContain('Derya Aksoy')
  })

  it('K6: yetkisiz rol (resepsiyon) raporları görmez ve istek atılmaz; Yazdır düğmesi yazdırmayı çağırır', async () => {
    mount(<ReportsScreen />, makeMe('receptionist'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
    cleanup()
    const print = vi.fn()
    window.print = print
    mount(<ReportsScreen />)
    await screen.findByText('₺5.000')
    fireEvent.click(screen.getByRole('button', { name: 'Yazdır' }))
    expect(print).toHaveBeenCalled()
  })
})

describe('W23 Primim', () => {
  const staff = (): Me => ({ ...makeMe('staff'), staffId: 's1' })

  it('K7: uzman kendi ödemelerini dönem, tutar ve durumla görür; ay özeti Yakında', async () => {
    mount(<PrimimScreen />, staff())
    const list = await screen.findByRole('list', { name: 'Ödemelerim' })
    expect(list.textContent).toContain('₺4.000')
    expect(list.textContent).toContain('Ödendi')
    expect(list.textContent).toContain('Bekliyor')
    expect(screen.getByText('Yakında')).toBeTruthy()
  })

  it('K8: uzman dışındaki rol Primim ekranını görmez (yetkisiz) ve istek atılmaz', () => {
    mount(<PrimimScreen />)
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K9: boş liste açıklayıcı; hata Yeniden dene', async () => {
    payouts = []
    mount(<PrimimScreen />, staff())
    expect(await screen.findByText('Henüz ödeme kaydı yok.')).toBeTruthy()
    cleanup()
    payoutError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount(<PrimimScreen />, staff())
    expect((await screen.findByRole('alert')).textContent).toContain('Ödemeleriniz yüklenemedi.')
  })
})
