// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseSurfaces } from './flags'
import { mapLegacyPanelPath, resolveRoute, SITE_ONLY_PATHS } from './routes'

const ALL = parseSurfaces('site,auth,panel,book,admin')
const NONE = parseSurfaces('')

const NEXT = { kind: 'next' }
const NOT_FOUND = { kind: 'notFound' }

describe('bayrak kapalı (canlı): eski arayüz yolları değişmez', () => {
  const legacyPaths = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/book/defne',
    '/admin/login',
    '/admin/tenants/abc',
    '/onboarding',
    '/tenant/defne/dashboard',
    '/tenant/defne/customers/c1',
  ]
  it.each(legacyPaths)('K1: %s olduğu gibi geçer', (path) => {
    expect(resolveRoute(path, NONE)).toEqual(NEXT)
  })

  it.each(['/panel/defne', '/panel/defne/bugun', '/v2', '/v2/login', '/v2/book/defne', '/v2/admin/x', '/v2/tasarim-sistemi'])(
    'K1: %s 404 olur',
    (path) => {
      expect(resolveRoute(path, NONE)).toEqual(NOT_FOUND)
    },
  )

  it.each(SITE_ONLY_PATHS)('K1: tanıtım alt sayfası %s 404 olur', (path) => {
    expect(resolveRoute(path, NONE)).toEqual(NOT_FOUND)
  })
})

describe('bayrak açık: yüzey yüzey eşleme', () => {
  it('K2: site -> ana sayfa iç yola yeniden yazılır', () => {
    expect(resolveRoute('/', parseSurfaces('site'))).toEqual({ kind: 'rewrite', pathname: '/v2' })
    expect(resolveRoute('/ozellikler', parseSurfaces('site'))).toEqual(NEXT)
  })

  it.each(['/login', '/signup', '/forgot-password', '/reset-password'])('K2: auth -> %s yeniden yazılır', (path) => {
    expect(resolveRoute(path, parseSurfaces('auth'))).toEqual({ kind: 'rewrite', pathname: '/v2' + path })
  })

  it('K2: book ve admin yolları iç yola yeniden yazılır', () => {
    expect(resolveRoute('/book/defne', parseSurfaces('book'))).toEqual({ kind: 'rewrite', pathname: '/v2/book/defne' })
    expect(resolveRoute('/admin/tenants/t1', parseSurfaces('admin'))).toEqual({
      kind: 'rewrite',
      pathname: '/v2/admin/tenants/t1',
    })
  })

  it('K2: bir yüzey açıkken diğerleri eski kalır', () => {
    const onlyAuth = parseSurfaces('auth')
    expect(resolveRoute('/', onlyAuth)).toEqual(NEXT)
    expect(resolveRoute('/book/defne', onlyAuth)).toEqual(NEXT)
    expect(resolveRoute('/tenant/defne/dashboard', onlyAuth)).toEqual(NEXT)
    expect(resolveRoute('/panel/defne', onlyAuth)).toEqual(NOT_FOUND)
    expect(resolveRoute('/v2/book/defne', onlyAuth)).toEqual(NOT_FOUND)
    expect(resolveRoute('/v2/login', onlyAuth)).toEqual(NEXT)
  })

  it('K2: panel açıkken /panel/* geçer, /v2 vitrin yolu herhangi bir yüzeyle açılır', () => {
    expect(resolveRoute('/panel/defne/takvim', parseSurfaces('panel'))).toEqual(NEXT)
    expect(resolveRoute('/v2/tasarim-sistemi', ALL)).toEqual(NEXT)
  })

  it('K2: sonda eğik çizgi eşlemeyi bozmaz', () => {
    expect(resolveRoute('/login/', parseSurfaces('auth'))).toEqual({ kind: 'rewrite', pathname: '/v2/login' })
  })
})

describe('/tenant/[slug]/* -> /panel/[slug]/<karşılığı> (307)', () => {
  const cases: Array<[string, string]> = [
    ['/tenant/defne', '/panel/defne/bugun'],
    ['/tenant/defne/dashboard', '/panel/defne/bugun'],
    ['/tenant/defne/appointments', '/panel/defne/takvim'],
    ['/tenant/defne/customers', '/panel/defne/musteriler'],
    ['/tenant/defne/customers/new', '/panel/defne/musteri-yeni'],
    ['/tenant/defne/customers/c1', '/panel/defne/musteri/c1'],
    ['/tenant/defne/services', '/panel/defne/hizmetler'],
    ['/tenant/defne/staff', '/panel/defne/personel'],
    ['/tenant/defne/staff/s1', '/panel/defne/personel-detay/s1'],
    ['/tenant/defne/finance', '/panel/defne/kasa'],
    ['/tenant/defne/waitlist', '/panel/defne/bekleme'],
    ['/tenant/defne/accounts', '/panel/defne/hesaplar'],
    ['/tenant/defne/accounts/a1', '/panel/defne/hesaplar/a1'],
    ['/tenant/defne/current-accounts', '/panel/defne/cari'],
    ['/tenant/defne/current-accounts/supplier/p1', '/panel/defne/cari/supplier/p1'],
    ['/tenant/defne/purchase-invoices', '/panel/defne/faturalar'],
    ['/tenant/defne/purchase-invoices/new', '/panel/defne/fatura-yeni'],
    ['/tenant/defne/purchase-invoices/i1', '/panel/defne/faturalar/i1'],
    ['/tenant/defne/suppliers', '/panel/defne/tedarikciler'],
    ['/tenant/defne/inventory', '/panel/defne/stok'],
    ['/tenant/defne/packages', '/panel/defne/paketler'],
    ['/tenant/defne/staff-payouts', '/panel/defne/odemeler'],
    ['/tenant/defne/tips', '/panel/defne/bahsis'],
    ['/tenant/defne/bot-conversations', '/panel/defne/asistan'],
    ['/tenant/defne/settings', '/panel/defne/ayarlar'],
    ['/tenant/defne/settings/modules', '/panel/defne/ayarlar/moduller'],
    ['/tenant/defne/subscription-required', '/panel/defne/abonelik-bitti'],
    ['/tenant/defne/bilinmeyen-ekran', '/panel/defne/bugun'],
  ]
  it.each(cases)('K2: %s -> %s', (from, to) => {
    expect(resolveRoute(from, parseSurfaces('panel'))).toEqual({ kind: 'redirect', pathname: to, status: 307 })
  })

  it('K2: slug olmadan /tenant eski haliyle geçer', () => {
    expect(resolveRoute('/tenant', parseSurfaces('panel'))).toEqual(NEXT)
  })

  it('K2: eşleme tablosu yeni panel adlarını yalnız bilinen ekranlara verir', () => {
    expect(mapLegacyPanelPath([])).toBe('bugun')
    expect(mapLegacyPanelPath(['customers', 'c9', 'extra'])).toBe('musteri/c9/extra')
  })
})

describe('denetim W0-1: sınır ve kodlama vakaları', () => {
  it('segment sınırı: /books, book açıkken bile /book yolu sayılmaz', () => {
    expect(resolveRoute('/books', parseSurfaces('book'))).toEqual(NEXT)
    expect(resolveRoute('/booking/x', parseSurfaces('book'))).toEqual(NEXT)
    expect(resolveRoute('/administrator', parseSurfaces('admin'))).toEqual(NEXT)
  })

  it('/v2/admin: admin kapalıyken (site açık olsa bile) 404', () => {
    expect(resolveRoute('/v2/admin', parseSurfaces('site'))).toEqual(NOT_FOUND)
    expect(resolveRoute('/v2/admin/tenants', parseSurfaces('site,auth,panel,book'))).toEqual(NOT_FOUND)
  })

  it('bayrak kapalıyken noktalı ve yüzde-kodlu iç yollar 404', () => {
    expect(resolveRoute('/v2/a.b', NONE)).toEqual(NOT_FOUND)
    expect(resolveRoute('/panel/x/y.z', NONE)).toEqual(NOT_FOUND)
    expect(resolveRoute('/%76%32', NONE)).toEqual(NOT_FOUND)
    expect(resolveRoute('/%70anel/defne', NONE)).toEqual(NOT_FOUND)
    expect(resolveRoute('/%76%32/login', parseSurfaces('site'))).toEqual(NOT_FOUND)
  })

  it('bozuk yüzde kodlaması çökmez, olduğu gibi geçer', () => {
    expect(resolveRoute('/%E0%A4%A', NONE)).toEqual(NEXT)
  })
})
