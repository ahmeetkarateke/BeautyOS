import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { TipsScreen } from './tips-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown> }
let tips: unknown[]
let listError: ApiError | null
let writeError: ApiError | null
let undistributed: number

const tip = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  amount: 100,
  source: 'cash',
  collectedAt: '2026-10-20T10:00:00.000Z',
  isDistributed: false,
  staffId: null,
  staffName: null,
  ...over,
})

function mount(me: Me = makeMe('owner')) {
  return render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <TipsScreen />
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
  undistributed = 100
  tips = [tip('1'), tip('2', { isDistributed: true, staffName: 'Derya Aksoy', source: 'card', amount: 50 })]
  request.mockImplementation(async (path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      return {}
    }
    if (path.endsWith('/summary')) return { totalAmount: 150, totalCount: 2, undistributedTotal: undistributed, undistributedCount: 1 }
    if (path.endsWith('/staff')) return { data: [{ id: 'p1', fullName: 'Derya Aksoy', title: 'Kuaför', skills: [] }, { id: 'p2', fullName: 'Ece Kaya', title: 'Kuaför', skills: [] }] }
    if (listError) throw listError
    return { data: tips }
  })
})
afterEach(cleanup)

describe('W26 Bahşiş', () => {
  it('K1: özet ve kayıtlar; havuz ve dağıtılmış ayrı yazılır', async () => {
    mount()
    const list = await screen.findByRole('list', { name: 'Bahşiş kayıtları' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows[0].textContent).toContain('Salon havuzu')
    expect(rows[0].textContent).toContain('Dağıtılmadı')
    expect(rows[1].textContent).toContain('Derya Aksoy')
    expect(rows[1].textContent).toContain('Kart · Dağıtıldı')
    expect(await screen.findByText('Bu ay toplam')).toBeTruthy()
  })

  it('K2: yetkisiz rol ekranı görür ve istek atılmaz', () => {
    mount(makeMe('receptionist'))
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K3: Bahşiş ekle: tutar yoksa istek yok; geçerliyse POST gövdesi doğru', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Bahşiş ekle' }))
    const dialog = await screen.findByRole('dialog', { name: 'Bahşiş ekle' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bahşişi kaydet' }))
    expect(await within(dialog).findByText('Bahşiş tutarını rakamlarla yazın.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Tutar/ }), { target: { value: '75' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bahşişi kaydet' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({ amount: 75, source: 'cash' })
    expect(await screen.findByText('Bahşiş eklendi.')).toBeTruthy()
  })

  it('K4: Dağıt: personel seçilmeden istek yok; seçilince eşit ağırlıkla gider ve kişi başı payı gösterir', async () => {
    mount()
    await screen.findByText('Bu ay toplam')
    fireEvent.click(await screen.findByRole('button', { name: 'Dağıt' }))
    const dialog = await screen.findByRole('dialog', { name: 'Bahşişi dağıt' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bahşişi dağıt' }))
    expect(await within(dialog).findByText('Dağıtılacak personeli seçin.')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Derya Aksoy' }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Ece Kaya' }))
    expect(within(dialog).getByRole('status').textContent).toContain('₺50')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bahşişi dağıt' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect((writes()[0][1] as Init).body).toEqual({
      tipIds: ['1'],
      distributions: [
        { staffId: 'p1', shareWeight: 1 },
        { staffId: 'p2', shareWeight: 1 },
      ],
    })
  })

  it('K5c: kişiye bırakılan bahşiş havuza girmez; tipIds yalnız havuz kayıtlarını içerir', async () => {
    tips = [tip('1'), tip('kisi', { staffId: 'p1', staffName: 'Derya Aksoy', amount: 300 })]
    mount()
    await screen.findByText('Bu ay toplam')
    fireEvent.click(await screen.findByRole('button', { name: 'Dağıt' }))
    const dialog = await screen.findByRole('dialog', { name: 'Bahşişi dağıt' })
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Ece Kaya' }))
    expect(within(dialog).getByRole('status').textContent).toContain('₺100')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bahşişi dağıt' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(((writes()[0][1] as Init).body as { tipIds: string[] }).tipIds).toEqual(['1'])
  })

  it('K5: dağıtılacak bahşiş yoksa Dağıt kapalıdır; hata ve boş durum açıklayıcıdır', async () => {
    undistributed = 0
    tips = [tip('2', { isDistributed: true })]
    mount()
    await screen.findByText('Bu ay toplam')
    expect((screen.getByRole('button', { name: 'Dağıt' }) as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    tips = []
    mount()
    expect(await screen.findByText('Henüz bahşiş kaydı yok.')).toBeTruthy()
    cleanup()
    listError = new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
    mount()
    expect((await screen.findByRole('alert')).textContent).toContain('Bahşiş kayıtları yüklenemedi.')
  })

  it('K6: sunucu hatası (zaten dağıtılmış) şeritle yazılır', async () => {
    writeError = new ApiError({ status: 409, code: 'CONFLICT' })
    mount()
    await screen.findByText('Bu ay toplam')
    fireEvent.click(await screen.findByRole('button', { name: 'Dağıt' }))
    const dialog = await screen.findByRole('dialog', { name: 'Bahşişi dağıt' })
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Derya Aksoy' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bahşişi dağıt' }))
    expect(await within(dialog).findByText(/çakışıyor/)).toBeTruthy()
  })
})
