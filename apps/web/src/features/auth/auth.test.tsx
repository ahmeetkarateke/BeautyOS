import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/v2/api-client'
import type { ApiClient } from '@/lib/v2/api-client'
import { ApiClientProvider } from '@/lib/v2/api-context'
import { ForgotScreen } from './forgot-screen'
import { InviteScreen } from './invite-screen'
import { LoginScreen } from './login-screen'
import { ResetScreen } from './reset-screen'
import { SignupScreen } from './signup-screen'
import '@/ui/test-polyfills'

const request = vi.fn()
const setAccessToken = vi.fn()
const navigate = vi.fn()
const client = { request, setAccessToken } as unknown as ApiClient

type Call = { path: string; body: Record<string, unknown> }
const calls = (): Call[] => request.mock.calls.map(([path, init]: [string, { body?: Record<string, unknown> }]) => ({ path, body: init?.body ?? {} }))

function mount(node: React.ReactNode) {
  return render(<ApiClientProvider client={client}>{node}</ApiClientProvider>)
}

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const session = { token: 'jwt', user: { tenantSlug: 'defne' } }
const versions = { termsVersion: 't1', dpaVersion: 'd1', labelVersion: '2026-10-30', marketingTextVersion: '2026-10-30' }
const registerCalls = () => calls().filter((c) => c.path.endsWith('/register'))
const mockSignup = () => request.mockImplementation(async (path: string) => (path.includes('legal-versions') ? versions : session))

beforeEach(() => {
  request.mockReset()
  setAccessToken.mockReset()
  navigate.mockReset()
  window.history.replaceState(null, '', '/')
})
afterEach(cleanup)

describe('LoginScreen', () => {
  it('K4: doğru bilgilerle girişte token belleğe konur ve salonun Bugün ekranına gidilir', async () => {
    request.mockResolvedValue(session)
    mount(<LoginScreen navigate={navigate} />)
    type('E-posta', ' defne@ornek.com ')
    type('Şifre', 'sifre1234')
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/panel/defne/bugun'))
    expect(setAccessToken).toHaveBeenCalledWith('jwt')
    expect(calls()[0]).toEqual({ path: '/api/v1/auth/login', body: { email: 'defne@ornek.com', password: 'sifre1234' } })
  })

  it('H1: yanlış şifreden sonra doğru şifreyle ikinci gönderim de gider ve panele yönlenir', async () => {
    request.mockRejectedValueOnce(new ApiError({ status: 401, code: 'INVALID_CREDENTIALS' })).mockResolvedValueOnce(session)
    mount(<LoginScreen navigate={navigate} />)
    type('E-posta', 'defne@ornek.com')
    type('Şifre', 'yanlis123')
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))
    await screen.findByText(/E-posta veya şifre hatalı/)
    type('Şifre', 'dogru1234')
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/panel/defne/bugun'))
    expect(calls()).toHaveLength(2)
    expect(calls()[1].body).toEqual({ email: 'defne@ornek.com', password: 'dogru1234' })
  })

  it('K4: yanlış bilgide "E-posta veya şifre hatalı." gösterilir, yönlenilmez ve düğme yeniden açılır', async () => {
    request.mockRejectedValue(new ApiError({ status: 401, code: 'INVALID_CREDENTIALS' }))
    mount(<LoginScreen navigate={navigate} />)
    type('E-posta', 'defne@ornek.com')
    type('Şifre', 'yanlis123')
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('E-posta veya şifre hatalı.'))
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Giriş yap' }).getAttribute('aria-busy')).toBeNull()
  })

  it('K4: hız sınırı aşılınca giriş bağlamıyla 15 dakika uyarısı verilir', async () => {
    request.mockRejectedValue(new ApiError({ status: 429, code: 'RATE_LIMIT' }))
    mount(<LoginScreen navigate={navigate} />)
    type('E-posta', 'defne@ornek.com')
    type('Şifre', 'x')
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))
    expect((await screen.findByRole('alert')).textContent).toContain('15 dakika')
  })

  it('K4: boş gönderimde istek atılmaz, hata alan altında görünür ve odak ilk hatalı alana gider', async () => {
    mount(<LoginScreen navigate={navigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))
    expect(await screen.findByText('E-posta adresini yazın.')).toBeTruthy()
    expect(screen.getByText('Şifrenizi yazın.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('E-posta')))
  })

  it('K4: şifre göster/gizle düğmesi alan türünü değiştirir', () => {
    mount(<LoginScreen navigate={navigate} />)
    const input = screen.getByLabelText('Şifre') as HTMLInputElement
    expect(input.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi göster' }))
    expect(input.type).toBe('text')
    expect(screen.getByRole('button', { name: 'Şifreyi gizle' }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('SignupScreen', () => {
  function fillStep1(name = 'Defne Güzellik') {
    type('İşletme adı', name)
    fireEvent.change(screen.getByLabelText('İşletme türü'), { target: { value: 'hair_salon' } })
  }
  function fillStep2() {
    type('Ad soyad', 'Defne Kaya')
    type('Telefon', '5321234567')
    type('E-posta', 'defne@ornek.com')
    type('Şifre', 'sifre1234')
  }

  it('K5: işletme adından adres önerilir; adrese elle dokunulunca öneri durur', () => {
    mount(<SignupScreen navigate={navigate} />)
    type('İşletme adı', 'Işıl Güzellik')
    expect((screen.getByLabelText('Online randevu adresi') as HTMLInputElement).value).toBe('isil-guzellik')
    type('Online randevu adresi', 'benim-adresim')
    type('İşletme adı', 'Başka Ad')
    expect((screen.getByLabelText('Online randevu adresi') as HTMLInputElement).value).toBe('benim-adresim')
  })

  it('K5: tür seçilmeden ikinci adıma geçilmez', async () => {
    mount(<SignupScreen navigate={navigate} />)
    type('İşletme adı', 'Defne')
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
    expect(await screen.findByText('İşletme türünü seçin.')).toBeTruthy()
    expect(screen.queryByText('Adım 2/2')).toBeNull()
  })

  it('K5: "Diğer" seçilince alt tür sorulur ve seçilen alt tür API değeri olur', async () => {
    mockSignup()
    mount(<SignupScreen navigate={navigate} />)
    type('İşletme adı', 'Defne Spa')
    fireEvent.change(screen.getByLabelText('İşletme türü'), { target: { value: 'other' } })
    fireEvent.change(screen.getByLabelText('Hangi alanda çalışıyorsunuz?'), { target: { value: 'hair_transplant' } })
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
    fillStep2()
    fireEvent.click(screen.getByLabelText(/okudum, kabul ediyorum/))
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/panel/defne/kurulum'))
    expect(registerCalls()[0].body).toMatchObject({ businessType: 'hair_transplant', slug: 'defne-spa', salonName: 'Defne Spa' })
  })

  it('K6: iki adımda hesap oluşturulur; gövde sunucu şemasına uyar ve rızalar (şart + ticari ileti) consents içinde gider', async () => {
    mockSignup()
    mount(<SignupScreen navigate={navigate} />)
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
    expect(screen.getByText('Adım 2/2')).toBeTruthy()
    fillStep2()
    fireEvent.click(screen.getByLabelText(/okudum, kabul ediyorum/))
    fireEvent.click(screen.getByLabelText(/duyurularını e-postayla/))
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/panel/defne/kurulum'))
    expect(registerCalls()[0]).toEqual({
      path: '/api/v1/auth/register',
      body: {
        salonName: 'Defne Güzellik',
        slug: 'defne-guzellik',
        ownerFullName: 'Defne Kaya',
        phone: '+905321234567',
        email: 'defne@ornek.com',
        password: 'sifre1234',
        businessType: 'hair_salon',
        consents: { terms: true, termsVersion: 't1', dpaVersion: 'd1', labelVersion: '2026-10-30', marketingEmail: true, marketingTextVersion: '2026-10-30' },
      },
    })
  })

  it('K5: adres uygunluğu beklenip sorulur; "kullanımda" ise ikinci adıma geçilmez', async () => {
    request.mockImplementation(async (path: string) => (path.includes('slug-available') ? { available: false, reason: 'taken' } : path.includes('legal-versions') ? versions : session))
    mount(<SignupScreen navigate={navigate} />)
    fillStep1()
    expect(await screen.findByText('Bu adres kullanımda. Başka bir adres deneyin.', undefined, { timeout: 2000 })).toBeTruthy()
    expect(request.mock.calls.find(([p]: [string]) => p.includes('slug-available'))?.[0]).toBe('/api/v1/auth/slug-available')
    expect(request.mock.calls.find(([p]: [string]) => p.includes('slug-available'))?.[1]).toMatchObject({ query: { slug: 'defne-guzellik' } })
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
    expect(screen.queryByText('Adım 2/2')).toBeNull()
  })

  it('K6: sürümler ekran açılınca alınır; gönderimden önce sunucu v2 olsa bile istek gövdesinde kullanıcının gördüğü v1 gider', async () => {
    let current = { ...versions, termsVersion: 'v1' }
    request.mockImplementation(async (path: string) => (path.includes('legal-versions') ? current : session))
    mount(<SignupScreen navigate={navigate} />)
    await waitFor(() => expect(request.mock.calls.some(([p]: [string]) => p.includes('legal-versions'))).toBe(true))
    current = { ...versions, termsVersion: 'v2' }
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
    fillStep2()
    fireEvent.click(screen.getByLabelText(/okudum, kabul ediyorum/))
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(registerCalls()[0].body.consents).toMatchObject({ termsVersion: 'v1' })
    expect(calls().filter((c) => c.path.includes('legal-versions'))).toHaveLength(1)
  })

  it('K6: LEGAL_VERSION_MISMATCH gelince sürümler yenilenir, şart kutusu temizlenir ve yeniden onay istenir', async () => {
    let current = { ...versions, termsVersion: 'v1' }
    request.mockImplementation(async (path: string) => {
      if (path.includes('legal-versions')) return current
      throw new ApiError({ status: 400, code: 'LEGAL_VERSION_MISMATCH' })
    })
    mount(<SignupScreen navigate={navigate} />)
    await waitFor(() => expect(request).toHaveBeenCalled())
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
    fillStep2()
    fireEvent.click(screen.getByLabelText(/okudum, kabul ediyorum/))
    current = { ...versions, termsVersion: 'v2' }
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    expect((await screen.findByText(/Belgeler güncellendi/)).textContent).toContain('yeniden işaretleyin')
    expect((screen.getByLabelText(/okudum, kabul ediyorum/) as HTMLInputElement).checked).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('W30: ikinci LEGAL_VERSION_MISMATCH döngüye girmez; sayfayı yenileme yönergesi verilir', async () => {
    request.mockImplementation(async (path: string) => {
      if (path.includes('legal-versions')) return versions
      throw new ApiError({ status: 400, code: 'LEGAL_VERSION_MISMATCH' })
    })
    mount(<SignupScreen navigate={navigate} />)
    await waitFor(() => expect(request).toHaveBeenCalled())
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
    fillStep2()
    fireEvent.click(screen.getByLabelText(/okudum, kabul ediyorum/))
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    await screen.findByText(/Belgeler güncellendi/)
    fireEvent.click(screen.getByLabelText(/okudum, kabul ediyorum/))
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    expect((await screen.findByText(/Sayfayı yenileyip tekrar deneyin/)).textContent).not.toContain('yeniden işaretleyin')
    expect(registerCalls()).toHaveLength(2)
  })

  it('K6: sürümler alınamadıysa hesap oluşturulmaz; anlaşılır uyarı verilir', async () => {
    request.mockRejectedValue(new ApiError({ status: 0, code: 'NETWORK' }))
    mount(<SignupScreen navigate={navigate} />)
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
    fillStep2()
    fireEvent.click(screen.getByLabelText(/okudum, kabul ediyorum/))
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Belge sürümleri alınamadı')
    expect(registerCalls()).toHaveLength(0)
  })

  it('K6: kullanım şartları işaretlenmeden hesap oluşturulmaz (kutu başta işaretsizdir)', async () => {
    mount(<SignupScreen navigate={navigate} />)
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
    fillStep2()
    expect((screen.getByLabelText(/okudum, kabul ediyorum/) as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    expect(await screen.findByText(/kullanım şartları ve gizlilik belgelerini kabul etmelisiniz/)).toBeTruthy()
    expect(registerCalls()).toHaveLength(0)
  })

  it('K6: adres çakışmasında birinci adıma dönülür ve hata adres alanında görünür', async () => {
    request.mockImplementation(async (path: string) => {
      if (path.includes('legal-versions')) return versions
      throw new ApiError({ status: 409, code: 'DUPLICATE_SLUG' })
    })
    mount(<SignupScreen navigate={navigate} />)
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
    fillStep2()
    fireEvent.click(screen.getByLabelText(/okudum, kabul ediyorum/))
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    expect(await screen.findByText('Bu salon adresi kullanımda. Başka bir adres deneyin.')).toBeTruthy()
    expect(screen.getByText('Adım 1/2')).toBeTruthy()
    expect((screen.getByLabelText('İşletme adı') as HTMLInputElement).value).toBe('Defne Güzellik')
  })

  it('K6: e-posta çakışmasında ikinci adımda kalınır ve hata e-posta alanında görünür', async () => {
    request.mockImplementation(async (path: string) => {
      if (path.includes('legal-versions')) return versions
      throw new ApiError({ status: 409, code: 'DUPLICATE_EMAIL' })
    })
    mount(<SignupScreen navigate={navigate} />)
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }))
    fillStep2()
    fireEvent.click(screen.getByLabelText(/okudum, kabul ediyorum/))
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    expect(await screen.findByText(/Bu e-posta adresiyle kayıtlı bir hesap var/)).toBeTruthy()
    expect(screen.getByText('Adım 2/2')).toBeTruthy()
  })
})

describe('ForgotScreen', () => {
  it('K7: hesap var/yok fark etmeden aynı onay metni gösterilir', async () => {
    request.mockResolvedValue({ ok: true })
    mount(<ForgotScreen />)
    type('E-posta', 'kimse@ornek.com')
    fireEvent.click(screen.getByRole('button', { name: 'Bağlantı gönder' }))
    expect(await screen.findByText(/Bu e-posta adresiyle bir hesap varsa/)).toBeTruthy()
    expect(calls()[0]).toEqual({ path: '/api/v1/auth/password-reset/request', body: { email: 'kimse@ornek.com' } })
  })

  it('K7: bozuk e-posta istek atmadan reddedilir', async () => {
    mount(<ForgotScreen />)
    type('E-posta', 'bozuk')
    fireEvent.click(screen.getByRole('button', { name: 'Bağlantı gönder' }))
    expect(await screen.findByText(/geçerli görünmüyor/)).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K7: ağ hatasında form kalır ve bağlantı hatası gösterilir', async () => {
    request.mockRejectedValue(new ApiError({ status: 0, code: 'NETWORK' }))
    mount(<ForgotScreen />)
    type('E-posta', 'a@b.co')
    fireEvent.click(screen.getByRole('button', { name: 'Bağlantı gönder' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Bağlantı kurulamadı')
    expect(screen.getByRole('button', { name: 'Bağlantı gönder' })).toBeTruthy()
  })
})

describe('ResetScreen', () => {
  it('K8: belirteç # parçasından okunur, adresten silinir ve şifre değişince giriş bağlantısı çıkar', async () => {
    window.history.replaceState(null, '', '/reset-password#tok123')
    request.mockResolvedValue({ ok: true })
    mount(<ResetScreen />)
    type('Yeni şifre', 'yeni12345')
    type('Yeni şifre (tekrar)', 'yeni12345')
    fireEvent.click(await screen.findByRole('button', { name: 'Şifreyi değiştir' }))
    expect(await screen.findByText('Şifreniz değişti')).toBeTruthy()
    expect(calls()[0]).toEqual({ path: '/api/v1/auth/password-reset/confirm', body: { token: 'tok123', password: 'yeni12345' } })
    expect(window.location.hash).toBe('')
  })

  it('K8: iki şifre farklıysa istek atılmaz', async () => {
    window.history.replaceState(null, '', '/reset-password#tok123')
    mount(<ResetScreen />)
    await screen.findByLabelText('Yeni şifre')
    type('Yeni şifre', 'yeni12345')
    type('Yeni şifre (tekrar)', 'baska12345')
    fireEvent.click(screen.getByRole('button', { name: 'Şifreyi değiştir' }))
    expect(await screen.findByText('İki şifre aynı olmalı.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K8: sunucu INVALID_TOKEN derse "süresi dolmuş" ekranı ve yeni bağlantı isteme bağlantısı çıkar', async () => {
    window.history.replaceState(null, '', '/reset-password#eskitok')
    request.mockRejectedValue(new ApiError({ status: 400, code: 'INVALID_TOKEN' }))
    mount(<ResetScreen />)
    type('Yeni şifre', 'yeni12345')
    type('Yeni şifre (tekrar)', 'yeni12345')
    fireEvent.click(await screen.findByRole('button', { name: 'Şifreyi değiştir' }))
    expect(await screen.findByText('Bu bağlantının süresi dolmuş. Yeni bir bağlantı isteyin.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Yeni bağlantı iste' }).getAttribute('href')).toBe('/forgot-password')
  })

  it('K8: belirteç yoksa form çizilmez, geçersiz bağlantı ekranı gösterilir', async () => {
    mount(<ResetScreen />)
    expect(await screen.findByText('Bu bağlantının süresi dolmuş. Yeni bir bağlantı isteyin.')).toBeTruthy()
    expect(screen.queryByLabelText('Yeni şifre')).toBeNull()
  })

  it('K8: sunucunun #token=<değer> bağlantısı çalışır; belirteç adresten silinir ve gövdede gider', async () => {
    window.history.replaceState(null, '', '/reset-password#token=abcdef')
    request.mockResolvedValue({ ok: true })
    mount(<ResetScreen />)
    type('Yeni şifre', 'yeni12345')
    type('Yeni şifre (tekrar)', 'yeni12345')
    fireEvent.click(await screen.findByRole('button', { name: 'Şifreyi değiştir' }))
    await screen.findByText('Şifreniz değişti')
    expect(calls()[0].body).toEqual({ token: 'abcdef', password: 'yeni12345' })
    expect(window.location.hash).toBe('')
  })

  it('K9: eski ?token= bağlantısı kabul edilmez: geçersiz bağlantı ekranı', async () => {
    window.history.replaceState(null, '', '/reset-password?token=eskibicim')
    mount(<ResetScreen />)
    expect(await screen.findByText('Bu bağlantının süresi dolmuş. Yeni bir bağlantı isteyin.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })
})

describe('InviteScreen', () => {
  const info = { tenantName: 'Defne Güzellik', role: 'staff', email: 'zeynep@ornek.com', fullName: 'Zeynep Arslan', expiresAt: null }

  it('K9: belirteç gövdede arama ucuna gider, adresten silinir ve davet bilgisi gösterilir', async () => {
    window.history.replaceState(null, '', '/invite#davet-tok')
    request.mockResolvedValue(info)
    mount(<InviteScreen navigate={navigate} />)
    expect(await screen.findByRole('heading', { name: 'Defne Güzellik sizi davet etti' })).toBeTruthy()
    expect(calls()[0]).toEqual({ path: '/api/v1/auth/invitations/lookup', body: { token: 'davet-tok' } })
    expect(window.location.hash).toBe('')
    expect((screen.getByLabelText('E-posta') as HTMLInputElement).readOnly).toBe(true)
    expect((screen.getByLabelText(/Ad soyad/) as HTMLInputElement).value).toBe('Zeynep Arslan')
  })

  it('K9: şifre belirlenip kabul edilince oturum açılır ve panele gidilir', async () => {
    window.history.replaceState(null, '', '/invite#davet-tok')
    request.mockResolvedValueOnce(info).mockResolvedValueOnce(session)
    mount(<InviteScreen navigate={navigate} />)
    await screen.findByLabelText('Şifre')
    type('Şifre', 'sifre1234')
    fireEvent.click(screen.getByRole('button', { name: 'Hesabımı oluştur' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/panel/defne/bugun'))
    expect(calls()[1]).toEqual({ path: '/api/v1/auth/invitations/accept', body: { token: 'davet-tok', password: 'sifre1234', fullName: 'Zeynep Arslan' } })
    expect(setAccessToken).toHaveBeenCalledWith('jwt')
  })

  it('K9: # yoksa sunucuya hiç sorulmaz, "geçersiz ya da süresi dolmuş" ekranı çıkar', async () => {
    mount(<InviteScreen navigate={navigate} />)
    expect(await screen.findByText('Bu bağlantı geçersiz ya da süresi dolmuş.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('K9: sunucu INVITATION_INVALID derse aynı geçersiz bağlantı ekranı çıkar', async () => {
    window.history.replaceState(null, '', '/invite#kotu')
    request.mockRejectedValue(new ApiError({ status: 404, code: 'INVITATION_INVALID' }))
    mount(<InviteScreen navigate={navigate} />)
    expect(await screen.findByText('Bu bağlantı geçersiz ya da süresi dolmuş.')).toBeTruthy()
  })

  it('K9: ağ hatasında "Tekrar dene" aynı belirteçle yeniden sorar (belirteç bellekte kalır)', async () => {
    window.history.replaceState(null, '', '/invite#davet-tok')
    request.mockRejectedValueOnce(new ApiError({ status: 0, code: 'NETWORK' })).mockResolvedValueOnce(info)
    mount(<InviteScreen navigate={navigate} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByRole('heading', { name: 'Defne Güzellik sizi davet etti' })).toBeTruthy()
    expect(calls()[1].body).toEqual({ token: 'davet-tok' })
  })

  it('K9: e-posta başka hesapta kayıtlıysa açıklama gösterilir, form açık kalır', async () => {
    window.history.replaceState(null, '', '/invite#davet-tok')
    request.mockResolvedValueOnce(info).mockRejectedValueOnce(new ApiError({ status: 409, code: 'INVITATION_EMAIL_IN_USE' }))
    mount(<InviteScreen navigate={navigate} />)
    await screen.findByLabelText('Şifre')
    type('Şifre', 'sifre1234')
    fireEvent.click(screen.getByRole('button', { name: 'Hesabımı oluştur' }))
    expect((await screen.findByRole('alert')).textContent).toContain('başka bir hesapta kayıtlı')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('K9: zayıf şifre istek atmadan reddedilir', async () => {
    window.history.replaceState(null, '', '/invite#davet-tok')
    request.mockResolvedValueOnce(info)
    mount(<InviteScreen navigate={navigate} />)
    await screen.findByLabelText('Şifre')
    type('Şifre', '12345678')
    fireEvent.click(screen.getByRole('button', { name: 'Hesabımı oluştur' }))
    expect(await screen.findByText('Şifrede en az bir harf olmalı.')).toBeTruthy()
    expect(request).toHaveBeenCalledTimes(1)
  })
})
