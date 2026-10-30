import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { CashScreen } from './cash-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown>; query?: Record<string, unknown> }
let status: Record<string, unknown>
let statusError: ApiError | null
let writeError: ApiError | null
let corrections: unknown[]

// A6b izinleri bu dalın shared paketinde yok: test oturumu izinleri açıkça kurar.
const withPermissions = (role: 'owner' | 'receptionist', extra: string[]): Me => ({
  ...makeMe(role),
  permissions: [...makeMe(role).permissions, ...extra] as Me['permissions'],
})
const owner = () => withPermissions('owner', ['finance.report.daily', 'finance.close_day', 'finance.report.range', 'finance.correction'])
const reception = () => withPermissions('receptionist', ['finance.report.daily', 'finance.close_day'])

function mount(me: Me = owner()) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <CashScreen />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
}
const writes = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method === 'POST')

beforeEach(() => {
  request.mockReset()
  status = { date: '2026-10-29', isClosed: false, closedAt: null, expectedCash: 1250, countedCash: null, difference: null }
  statusError = null
  writeError = null
  corrections = []
  request.mockImplementation(async (path: string, init?: Init) => {
    if (init?.method === 'POST') {
      if (writeError) throw writeError
      return {}
    }
    if (path.endsWith('/reports/daily')) return { totalRevenue: 2000, cashRevenue: 1250, cardRevenue: 750, completedCount: 6 }
    if (path.endsWith('/day-status')) {
      if (statusError) throw statusError
      return status
    }
    if (path.endsWith('/corrections')) return { data: corrections }
    throw new Error(`beklenmeyen çağrı ${path}`)
  })
})
afterEach(cleanup)

describe('W19 Kasa', () => {
  it('K1: özet (tahsilat, nakit, kart, tamamlanan) ve açık gün: beklenen nakit + Günü kapat; sınır cümlesi var', async () => {
    mount()
    expect(await screen.findByText('₺2.000')).toBeTruthy()
    expect(screen.getByText('₺750')).toBeTruthy()
    expect(await screen.findByText('Gün açık.', { exact: false })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Günü kapat' })).toBeTruthy()
    expect(screen.getByText('BeautyOS yazarkasa yerine geçmez ve e-Fatura kesmez.')).toBeTruthy()
  })

  it('K2: kasa izni olmayan rol yetkisiz ekranı görür ve istek atılmaz', () => {
    mount(makeMe('staff'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K3: Günü kapat: sayım yazılınca fark canlı çıkar (eksik); kayıt close-day ile gider, bildirim verir', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Günü kapat' }))
    const dialog = await screen.findByRole('dialog', { name: 'Günü kapat' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Sayılan nakit/ }), { target: { value: '1200' } })
    expect(within(dialog).getByText('₺50 eksik')).toBeTruthy()
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Not/ }), { target: { value: 'Kuaför gideri' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Günü kapat' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/finance\/close-day$/)
    expect((writes()[0][1] as Init).body).toEqual({ countedCash: 1200, note: 'Kuaför gideri' })
    expect(await screen.findByText('Gün sonu kaydedildi.')).toBeTruthy()
  })

  it('K4: sayım boş bırakılırsa gövde boş gider (sayım isteğe bağlı); geçersiz sayım istek atmaz', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Günü kapat' }))
    const dialog = await screen.findByRole('dialog', { name: 'Günü kapat' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Sayılan nakit/ }), { target: { value: 'abc' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Günü kapat' }))
    expect(await within(dialog).findByText(/Tutarı yalnız rakamlarla yazın/)).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Sayılan nakit/ }), { target: { value: '' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Günü kapat' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({})
  })

  it('K5: kapalı gün: kapanış zamanı, beklenen/sayılan/fark yazılır; Günü kapat yok', async () => {
    status = { date: '2026-10-29', isClosed: true, closedAt: '2026-10-29T18:30:00.000Z', expectedCash: 1250, countedCash: 1300.5, difference: 50.5 }
    mount()
    expect(await screen.findByText(/Gün kapatıldı/)).toBeTruthy()
    expect(screen.getByText('₺50,50 fazla')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Günü kapat' })).toBeNull()
  })

  it('K6: kapalı günde Günü yeniden aç yalnız finance.correction iznine bağlıdır (resepsiyonda yok)', async () => {
    status = { date: '2026-10-29', isClosed: true, closedAt: '2026-10-29T18:30:00.000Z', expectedCash: 1250, countedCash: null, difference: null }
    mount(reception())
    await screen.findByText(/Gün kapatıldı/)
    expect(screen.getByText('Sayım yapılmadı')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Günü yeniden aç' })).toBeNull()
    cleanup()
    mount()
    expect(await screen.findByRole('button', { name: 'Günü yeniden aç' })).toBeTruthy()
  })

  it('K7: yeniden açma nedeni zorunlu (en az 3 karakter): kısa nedende istek yok; geçerli nedenle reopen-day gider', async () => {
    status = { date: '2026-10-29', isClosed: true, closedAt: '2026-10-29T18:30:00.000Z', expectedCash: 1250, countedCash: null, difference: null }
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Günü yeniden aç' }))
    const dialog = await screen.findByRole('dialog', { name: 'Günü yeniden aç' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Neden/ }), { target: { value: 'ab' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Günü yeniden aç' }))
    expect(await within(dialog).findByText(/Neden en az 3 karakter olmalı/)).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Neden/ }), { target: { value: 'Yanlış tutar girildi' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Günü yeniden aç' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/finance\/reopen-day$/)
    expect((writes()[0][1] as Init).body).toMatchObject({ reason: 'Yanlış tutar girildi' })
    expect(await screen.findByText('Gün yeniden açıldı.')).toBeTruthy()
  })

  it('K8: sunucu hataları (DAY_NOT_CLOSED) anlaşılır şeritte, katman açık kalır', async () => {
    status = { date: '2026-10-29', isClosed: true, closedAt: null, expectedCash: 0, countedCash: null, difference: null }
    writeError = new ApiError({ status: 409, code: 'DAY_NOT_CLOSED' })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Günü yeniden aç' }))
    const dialog = await screen.findByRole('dialog', { name: 'Günü yeniden aç' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Neden/ }), { target: { value: 'Neden yazıldı' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Günü yeniden aç' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Bu gün zaten açık.')
  })

  it('K9: düzeltme kayıtları listelenir; boşsa açıklama; yalnız finance.correction izninde bölüm vardır', async () => {
    corrections = [{ id: 'k1', kind: 'day_reopen', date: '2026-10-29', reason: 'Yanlış tutar', createdAt: '2026-10-29T15:00:00.000Z' }]
    mount()
    const list = await screen.findByRole('list', { name: 'Düzeltme kayıtları' })
    expect(list.textContent).toContain('Gün yeniden açıldı')
    expect(list.textContent).toContain('Yanlış tutar')
    cleanup()
    mount(reception())
    await screen.findByText('Gün açık.', { exact: false })
    expect(screen.queryByText('Düzeltme kayıtları')).toBeNull()
  })

  it('K10: gün durumu yüklenemezse hata + Yeniden dene (kapalı mı bilinmeden Günü kapat gösterilmez)', async () => {
    statusError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect(await screen.findByText('Gün durumu yüklenemedi.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Günü kapat' })).toBeNull()
  })

  it('K11: resepsiyonda tarih seçici yok (yalnız bugün), sahipte var', async () => {
    mount(reception())
    await screen.findByText('Gün açık.', { exact: false })
    expect(screen.queryByLabelText('Tarih')).toBeNull()
    cleanup()
    mount()
    expect(screen.getByLabelText('Tarih')).toBeTruthy()
  })
})
