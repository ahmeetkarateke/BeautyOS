import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { useMe } from '@/lib/v2/session'
import { makeMe } from '@/lib/v2/test-me'
import { PanelSession } from './panel-session'
import type { SessionHooks } from './panel-session'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ usePathname: () => '/panel/defne/bugun', useRouter: () => ({ replace }) }))

function Probe() {
  return <p>içerik: {useMe().tenant.name}</p>
}

type Setup = { restore?: boolean; me?: unknown; error?: unknown }

function setup({ restore = true, me = makeMe('owner'), error }: Setup = {}) {
  let hooks!: SessionHooks
  const request = vi.fn(async () => {
    if (error) throw error
    return me
  })
  const client = {
    restoreSession: vi.fn(async () => restore),
    request,
    setAccessToken: vi.fn(),
    getAccessToken: vi.fn(),
  } as unknown as ApiClient
  const createClient = (h: SessionHooks) => {
    hooks = h
    return client
  }
  return { createClient, client, request, hooks: () => hooks }
}

function mount(slug: string, s: ReturnType<typeof setup>) {
  return render(
    <PanelSession slug={slug} createClient={s.createClient}>
      <Probe />
    </PanelSession>,
  )
}

beforeEach(() => replace.mockClear())
afterEach(cleanup)

describe('W6 K4: kiracı bilgisi istemciden güvenilir değildir', () => {
  it('K4: başka salonun adresi kendi paneline yönlendirir ve o salonun içeriği hiç çizilmez', async () => {
    mount('baska-salon', setup())
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/defne/bugun'))
    expect(screen.queryByText(/içerik:/)).toBeNull()
  })

  it('K4: adres büyük harfle yazılsa da kendi salonudur, yönlendirme olmaz (Türk I testi: ISIK = isik)', async () => {
    mount('ISIK', setup({ me: makeMe('owner', { slug: 'isik', name: 'Işık Güzellik' }) }))
    await screen.findByText('içerik: Işık Güzellik')
    expect(replace).not.toHaveBeenCalled()
  })

  it('K4: kendi salonunun adresinde kabuk ve içerik çizilir', async () => {
    mount('defne', setup())
    await screen.findByText('içerik: Defne Güzellik')
    expect(screen.getByRole('navigation', { name: 'Ana menü' })).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('W6 K5: oturum açılışı durumları', () => {
  it('yüklenirken iskelet ve "Yükleniyor…" duyurusu görünür, içerik görünmez', () => {
    const s = setup()
    s.client.restoreSession = vi.fn(() => new Promise<boolean>(() => {}))
    mount('defne', s)
    expect(screen.getByRole('status').textContent).toBe('Yükleniyor…')
    expect(screen.queryByText(/içerik:/)).toBeNull()
  })

  it('K5: çerez yenilemesi başarısızsa "Oturumunuzun süresi doldu." ve /auth/me hiç çağrılmaz', async () => {
    const s = setup({ restore: false })
    mount('defne', s)
    await screen.findByRole('heading', { name: 'Oturumunuzun süresi doldu.' })
    expect(s.request).not.toHaveBeenCalled()
  })

  it('K5: oturum sonradan düşerse (onSessionExpired) içerik kaybolur, oturum doldu ekranı çıkar', async () => {
    const s = setup()
    mount('defne', s)
    await screen.findByText(/içerik:/)
    act(() => s.hooks().onSessionExpired())
    await screen.findByRole('heading', { name: 'Oturumunuzun süresi doldu.' })
    expect(screen.queryByText(/içerik:/)).toBeNull()
  })

  it('K5: silinmiş/pasif hesap "Hesabınız şu an aktif değil." gösterir', async () => {
    mount('defne', setup({ error: new ApiError({ status: 401, code: 'TENANT_DELETED' }) }))
    await screen.findByRole('heading', { name: 'Hesabınız şu an aktif değil.' })
  })

  it('K5: abonelik bitince (402) abonelik ekranına yönlendirir', async () => {
    const s = setup()
    mount('defne', s)
    await screen.findByText(/içerik:/)
    act(() => s.hooks().onSubscriptionRequired())
    expect(replace).toHaveBeenCalledWith('/panel/defne/abonelik-bitti')
  })

  it('K5: ağ yoksa "Sunucuya ulaşılamadı." ve bağlantı gelince kendiliğinden yeniden dener', async () => {
    const s = setup({ error: new ApiError({ status: 0, code: 'NETWORK' }) })
    mount('defne', s)
    await screen.findByRole('heading', { name: 'Sunucuya ulaşılamadı.' })

    s.request.mockImplementation(async () => makeMe('owner'))
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await screen.findByText(/içerik:/)
  })

  it('K5: /auth/me beklenmeyen biçimde dönerse genel hata ekranı; içerik çizilmez', async () => {
    mount('defne', setup({ me: { role: 'owner' } }))
    await screen.findByRole('heading', { name: 'Beklenmeyen bir sorun oluştu.' })
    expect(screen.queryByText(/içerik:/)).toBeNull()
  })

  it('K5: oturum açıkken bağlantı koparsa çevrimdışı şeridi çıkar, gelince kalkar; içerik yerinde kalır', async () => {
    mount('defne', setup())
    await screen.findByText(/içerik:/)
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText('İnternet bağlantınız yok.')).toBeTruthy()
    expect(screen.getByText(/içerik:/)).toBeTruthy()
    onLine.mockReturnValue(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText('İnternet bağlantınız yok.')).toBeNull()
    onLine.mockRestore()
  })
})
