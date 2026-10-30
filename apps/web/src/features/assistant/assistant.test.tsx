import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import { MeProvider } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import type { Role } from '@beautyos/shared'
import '@/ui/test-polyfills'
import { AssistantScreen } from './assistant-screen'
import { channelLabel, outcomeLabel } from './logic'

const request = vi.fn()
const client = { request } as unknown as ApiClient
const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  channel: 'telegram',
  customerRef: 'gizli-123',
  outcome: 'booked',
  referenceCode: 'ABC123',
  turnCount: 6,
  startedAt: '2026-10-20T09:00:00.000Z',
  endedAt: '2026-10-20T09:05:00.000Z',
  ...over,
})
const mount = (role: Role = 'owner') =>
  render(
    <ApiClientProvider client={client}>
      <MeProvider me={makeMe(role)}>
        <AssistantScreen />
      </MeProvider>
    </ApiClientProvider>,
  )

beforeEach(() => {
  request.mockReset()
  vi.stubEnv('NEXT_PUBLIC_BOT_FEATURES_ENABLED', 'true')
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('W28 Mesaj asistanı', () => {
  it('K1: bayrak kapalıyken dürüst bilgi çıkar ve istek atılmaz', () => {
    vi.stubEnv('NEXT_PUBLIC_BOT_FEATURES_ENABLED', 'false')
    mount()
    expect(screen.getByText('Mesaj asistanı şu an kapalı.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })
  it('K2: sahip dışı rol erişemez ve istek atılmaz', () => {
    mount('manager')
    expect(screen.getByText('Bu sayfayı görme yetkiniz yok.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })
  it('K3: konuşmalar listelenir; müşteri tanımlayıcısı ekrana basılmaz', async () => {
    request.mockResolvedValue({ data: [row('1')], meta: { total: 1, page: 1, totalPages: 1 } })
    mount()
    expect(await screen.findByText('Randevu alındı')).toBeTruthy()
    expect(screen.getByText(/Telegram · 6 mesaj · Kod ABC123/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('gizli-123')
  })
  it('K4: sonraki sayfa yüklenir, sayfa 2 varken "Daha fazla" çıkar', async () => {
    request.mockImplementation(async (_p: string, init: { query: { page: number } }) =>
      init.query.page === 1
        ? { data: [row('1')], meta: { total: 2, page: 1, totalPages: 2 } }
        : { data: [row('2', { outcome: 'cancelled' })], meta: { total: 2, page: 2, totalPages: 2 } },
    )
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Daha fazla göster' }))
    expect(await screen.findByText('Randevu iptal edildi')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Daha fazla göster' })).toBeNull()
  })
  it('K5: boş liste ve hata durumu açıklayıcıdır', async () => {
    request.mockResolvedValue({ data: [], meta: { total: 0, page: 1, totalPages: 0 } })
    mount()
    expect(await screen.findByText('Henüz konuşma yok.')).toBeTruthy()
    cleanup()
    request.mockReset()
    request.mockRejectedValue(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }))
    mount()
    await waitFor(() => expect(screen.getByRole('button', { name: /Yeniden dene/ })).toBeTruthy())
  })
  it('K6: bilinmeyen kanal ve sonuç düşmeden etiketlenir', () => {
    expect(channelLabel('x')).toBe('Diğer kanal')
    expect(outcomeLabel('x')).toBe('Diğer')
    expect(outcomeLabel(null)).toBe('Sonuçlanmadı')
  })
})
