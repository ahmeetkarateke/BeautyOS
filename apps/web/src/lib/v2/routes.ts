import type { Surface } from './flags'

// Yol eşlemesi: saf fonksiyon, proxy.ts yalnız sonucu uygular (birim testi bu dosyayı sınar).

export type RouteDecision =
  | { kind: 'next' }
  | { kind: 'notFound' }
  | { kind: 'rewrite'; pathname: string }
  | { kind: 'redirect'; pathname: string; status: 307 | 308 }

const NEXT: RouteDecision = { kind: 'next' }
const NOT_FOUND: RouteDecision = { kind: 'notFound' }

// Eski panel yolu (/tenant/[slug]/<eski>) -> yeni panel yolu (/panel/[slug]/<yeni>); tasarim.md §8.1 ekran adları.
const LEGACY_PANEL_MAP: Record<string, string> = {
  dashboard: 'bugun',
  appointments: 'takvim',
  customers: 'musteriler',
  'customers/new': 'musteri-yeni',
  services: 'hizmetler',
  staff: 'personel',
  finance: 'kasa',
  waitlist: 'bekleme',
  accounts: 'hesaplar',
  'current-accounts': 'cari',
  'purchase-invoices': 'faturalar',
  'purchase-invoices/new': 'fatura-yeni',
  suppliers: 'tedarikciler',
  inventory: 'stok',
  packages: 'paketler',
  'staff-payouts': 'odemeler',
  tips: 'bahsis',
  'bot-conversations': 'asistan',
  settings: 'ayarlar',
  'settings/modules': 'ayarlar/moduller',
  'subscription-required': 'abonelik-bitti',
}

// Ayrıntı yolları: ilk parça adı eşlenir, kimlikler olduğu gibi taşınır.
const LEGACY_DETAIL_MAP: Record<string, string> = {
  customers: 'musteri',
  staff: 'personel-detay',
  accounts: 'hesaplar',
  'current-accounts': 'cari',
  'purchase-invoices': 'faturalar',
}

export function mapLegacyPanelPath(rest: readonly string[]): string {
  if (rest.length === 0) return 'bugun'
  const exact = LEGACY_PANEL_MAP[rest.join('/')]
  if (exact) return exact
  const detail = LEGACY_DETAIL_MAP[rest[0]]
  if (detail && rest.length > 1) return [detail, ...rest.slice(1)].join('/')
  return 'bugun'
}

// Yalnız `site` bayrağıyla görünen tanıtım alt sayfaları (plan §1.3). Yeni sayfa eklenince buraya yazılır.
export const SITE_ONLY_PATHS: readonly string[] = [
  '/ozellikler',
  '/fiyat',
  '/sss',
  '/iletisim',
  '/kvkk',
  '/gizlilik',
  '/sartlar',
  '/cerez',
  '/kuafor',
  '/berber',
  '/guzellik-merkezi',
  '/estetik-klinigi',
  '/dis-hekimi',
]

const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password']

// Yüzde-kodlu yollar (/%76%32 = /v2) Next tarafından çözülerek eşleştirilir; burada da aynı biçime çevrilir. Bozuk kodlama olduğu gibi kalır.
function normalize(pathname: string): string {
  let decoded = pathname
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    decoded = pathname
  }
  return decoded.length > 1 && decoded.endsWith('/') ? decoded.slice(0, -1) : decoded
}

function startsWithSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

// Bir /v2/... iç yolunun hangi yüzeye ait olduğu (bayrağı kapalıysa 404).
function surfaceOfInternalPath(pathname: string): Surface | 'any' {
  const rest = pathname.slice('/v2'.length)
  if (rest === '' || rest === '/') return 'site'
  if (AUTH_PATHS.some((p) => startsWithSegment(rest, p))) return 'auth'
  if (startsWithSegment(rest, '/book')) return 'book'
  if (startsWithSegment(rest, '/admin')) return 'admin'
  // /v2/tasarim-sistemi gibi vitrin sayfaları: herhangi bir yüzey açıksa (yalnız staging).
  return 'any'
}

export function resolveRoute(rawPathname: string, enabled: ReadonlySet<Surface>): RouteDecision {
  const pathname = normalize(rawPathname)
  const isOn = (s: Surface) => enabled.has(s)

  if (startsWithSegment(pathname, '/v2')) {
    const surface = surfaceOfInternalPath(pathname)
    const open = surface === 'any' ? enabled.size > 0 : isOn(surface)
    return open ? NEXT : NOT_FOUND
  }

  if (startsWithSegment(pathname, '/panel')) {
    return isOn('panel') ? NEXT : NOT_FOUND
  }

  if (startsWithSegment(pathname, '/tenant')) {
    if (!isOn('panel')) return NEXT
    const [, slug, ...rest] = pathname.split('/').filter(Boolean)
    if (!slug) return NEXT
    return { kind: 'redirect', pathname: `/panel/${slug}/${mapLegacyPanelPath(rest)}`, status: 307 }
  }

  if (SITE_ONLY_PATHS.some((p) => startsWithSegment(pathname, p))) {
    return isOn('site') ? NEXT : NOT_FOUND
  }

  if (pathname === '/') {
    return isOn('site') ? { kind: 'rewrite', pathname: '/v2' } : NEXT
  }

  if (isOn('auth') && AUTH_PATHS.some((p) => startsWithSegment(pathname, p))) {
    return { kind: 'rewrite', pathname: '/v2' + pathname }
  }
  if (isOn('book') && startsWithSegment(pathname, '/book')) {
    return { kind: 'rewrite', pathname: '/v2' + pathname }
  }
  if (isOn('admin') && startsWithSegment(pathname, '/admin')) {
    return { kind: 'rewrite', pathname: '/v2' + pathname }
  }

  return NEXT
}
