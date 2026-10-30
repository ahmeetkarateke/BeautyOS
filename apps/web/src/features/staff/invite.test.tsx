import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import type { Me } from '@/lib/v2/me'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { ToastProvider } from '@/ui/toast'
import { StaffScreen } from './staff-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const client = { request } as unknown as ApiClient
type Init = { method?: string; body?: Record<string, unknown> }
let pending: unknown[]
let writeError: ApiError | null
let sent: { emailSent: boolean }

const invite = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  email: 'ece@ornek.com',
  fullName: 'Ece Kaya',
  role: 'staff',
  title: null,
  expiresAt: '2026-11-10T10:00:00.000Z',
  expired: false,
  ...over,
})
const mount = (me: Me = makeMe('owner')) =>
  render(
    <ApiClientProvider client={client}>
      <MeProvider me={me}>
        <ToastProvider>
          <StaffScreen />
        </ToastProvider>
      </MeProvider>
    </ApiClientProvider>,
  )
const writes = () => request.mock.calls.filter(([, init]) => (init as Init | undefined)?.method)
const LINK = 'https://app.ornek.com/invite#abcdefghijklmnopqrstuvwxyz'

beforeEach(() => {
  request.mockReset()
  pending = [invite()]
  writeError = null
  sent = { emailSent: true }
  request.mockImplementation(async (path: string, init?: Init) => {
    if (init?.method) {
      if (writeError) throw writeError
      if (init.method === 'DELETE') return undefined
      return { id: 'i2', link: LINK, expiresAt: '2026-11-12T10:00:00.000Z', emailSent: sent.emailSent }
    }
    if (path.endsWith('/invitations')) return { data: pending }
    return { data: [] }
  })
})
afterEach(cleanup)

async function openSheet() {
  fireEvent.click(await screen.findByRole('button', { name: 'Personel davet et' }))
  return screen.findByRole('dialog', { name: 'Personel davet et' })
}

describe('W21 personel daveti', () => {
  it('K1: bekleyen davetler listelenir', async () => {
    mount()
    const list = await screen.findByRole('list', { name: 'Bekleyen davetler' })
    expect(list.textContent).toContain('Ece Kaya')
    expect(list.textContent).toContain('ece@ornek.com')
  })
  it('K2: yalnız sahip görür; müdürde davet düğmesi ve davet isteği yok', async () => {
    mount(makeMe('manager'))
    await waitFor(() => expect(request).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Personel davet et' })).toBeNull()
    expect(request.mock.calls.some(([path]) => String(path).endsWith('/invitations'))).toBe(false)
  })
  it('K3: hatalı alanla istek gitmez; geçerliyle POST gider ve bağlantı bir kez gösterilir', async () => {
    mount()
    const dialog = await openSheet()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Daveti gönder' }))
    expect(await within(dialog).findByText('Ad soyadı yazın (en az 2 karakter).')).toBeTruthy()
    expect(writes()).toHaveLength(0)
    fireEvent.change(within(dialog).getByLabelText('Ad soyad'), { target: { value: 'Ece Kaya' } })
    fireEvent.change(within(dialog).getByLabelText('E-posta'), { target: { value: 'Ece@Ornek.com ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Daveti gönder' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][1]).toEqual({ method: 'POST', body: { fullName: 'Ece Kaya', email: 'Ece@Ornek.com', role: 'staff' } })
    expect(((await screen.findByLabelText('Davet bağlantısı')) as HTMLInputElement).value).toBe(LINK)
    expect(screen.getByText(/e-postayla gönderildi/)).toBeTruthy()
  })
  it('K4: e-posta gönderilemediyse bağlantıyı kendiniz iletin uyarısı çıkar', async () => {
    sent = { emailSent: false }
    mount()
    const dialog = await openSheet()
    fireEvent.change(within(dialog).getByLabelText('Ad soyad'), { target: { value: 'Ece Kaya' } })
    fireEvent.change(within(dialog).getByLabelText('E-posta'), { target: { value: 'ece@ornek.com' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Daveti gönder' }))
    expect(await screen.findByText(/E-posta gönderilemedi/)).toBeTruthy()
  })
  it('K5: aynı e-posta (409) davete uygun metinle gösterilir, form açık kalır', async () => {
    writeError = new ApiError({ status: 409, code: 'DUPLICATE_EMAIL' })
    mount()
    const dialog = await openSheet()
    fireEvent.change(within(dialog).getByLabelText('Ad soyad'), { target: { value: 'Ece Kaya' } })
    fireEvent.change(within(dialog).getByLabelText('E-posta'), { target: { value: 'ece@ornek.com' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Daveti gönder' }))
    expect(await within(dialog).findByText('Bu e-posta için kullanıcı ya da bekleyen davet zaten var.')).toBeTruthy()
  })
  it('K6: günlük sınır (429 INVITE_LIMIT) anlaşılır yazılır', async () => {
    writeError = new ApiError({ status: 429, code: 'INVITE_LIMIT' })
    mount()
    const dialog = await openSheet()
    fireEvent.change(within(dialog).getByLabelText('Ad soyad'), { target: { value: 'Ece Kaya' } })
    fireEvent.change(within(dialog).getByLabelText('E-posta'), { target: { value: 'ece@ornek.com' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Daveti gönder' }))
    expect(await within(dialog).findByText('Günlük davet sınırına ulaşıldı. Yarın tekrar deneyin.')).toBeTruthy()
  })
  it('K7: Yeniden gönder uygun uca POST atar ve yeni bağlantıyı gösterir', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Yeniden gönder' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toMatch(/\/invitations\/i1\/resend$/)
    expect(((await screen.findByLabelText('Davet bağlantısı')) as HTMLInputElement).value).toBe(LINK)
  })
  it('K8: İptal et onay ister; onaylanınca DELETE gider, vazgeçince gitmez', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'İptal et' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))
    expect(writes()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'İptal et' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Daveti iptal et' }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0]).toEqual([expect.stringMatching(/\/invitations\/i1$/), { method: 'DELETE' }])
  })
  it('K9: süresi dolan davet işaretlenir; boş liste açıklayıcıdır', async () => {
    pending = [invite({ expired: true })]
    mount()
    expect(await screen.findByText(/Süresi doldu/)).toBeTruthy()
    cleanup()
    pending = []
    mount()
    expect(await screen.findByText('Bekleyen davet yok.')).toBeTruthy()
  })
})
