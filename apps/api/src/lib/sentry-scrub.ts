import type { Breadcrumb, Event } from '@sentry/node'

// KVKK: istek gövdesi anamnez (sağlık/alerji), telefon gibi özel nitelikli veri taşıyabilir
// ve Sentry yurt dışındadır. Bu yüzden istekten yalnız yöntem ve sorgusuz yol, geri kalan
// her şey (gövde, sorgu dizgisi, çerezler, başlıklar, kullanıcı alanları) silinir.
// Telegram Bot API adresinin yolunda bot belirteci bulunur (/bot<id>:<anahtar>/yontem); bu belirteç
// URL'in geçtiği her yerden (istek, breadcrumb, span, hata iletisi) maskelenir.

const BOT_TOKEN_IN_PATH = /\/bot[0-9]+:[A-Za-z0-9_-]+(?=\/|$)/g

function maskSecrets(text: string): string {
  return text.replace(BOT_TOKEN_IN_PATH, '/bot[redacted]')
}

function stripQuery(url: string): string {
  const cut = url.search(/[?#]/)
  return maskSecrets(cut === -1 ? url : url.slice(0, cut))
}

function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  const scrubbed: Breadcrumb = { ...crumb }
  if (typeof scrubbed.message === 'string') scrubbed.message = maskSecrets(scrubbed.message)
  const data = crumb.data
  if (data) {
    const safe: Record<string, unknown> = {}
    if (typeof data.url === 'string') safe.url = stripQuery(data.url)
    if (typeof data.method === 'string') safe.method = data.method
    if (typeof data.status_code === 'number') safe.status_code = data.status_code
    scrubbed.data = safe
  }
  return scrubbed
}

type Span = NonNullable<Event['spans']>[number]

function scrubSpan(span: Span): Span {
  const scrubbed: Span = { ...span }
  if (typeof scrubbed.description === 'string') {
    // "GET https://api.telegram.org/bot…/sendMessage?chat_id=…" biçimindeki açıklamalarda sorgu da düşer
    scrubbed.description = scrubbed.description.split(/[?#]/)[0]
    scrubbed.description = maskSecrets(scrubbed.description)
  }
  if (span.data) scrubbed.data = scrubSpanData(span.data)
  return scrubbed
}

// Yalnız URL (sorgusuz, belirteç maskeli), yöntem ve durum anahtarları kalır; http.target, url.full,
// http.query gibi sorgu taşıyabilen alanlar da URL benzeri anahtarlar olarak aynı temizlikten geçer.
function scrubSpanData(data: Record<string, unknown>): Record<string, string | number> {
  const safe: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(data)) {
    if (/query/i.test(key)) continue
    if (/url|target|route|path/i.test(key) && typeof value === 'string') safe[key] = stripQuery(value)
    else if (/method|status/i.test(key) && (typeof value === 'string' || typeof value === 'number')) safe[key] = value
  }
  return safe
}

export function scrubEvent<T extends Event>(event: T): T {
  if (event.request) {
    const { method, url } = event.request
    event.request = { method, url: url === undefined ? undefined : stripQuery(url) }
  }
  delete event.user
  delete event.extra
  if (typeof event.message === 'string') event.message = maskSecrets(event.message)
  for (const exception of event.exception?.values ?? []) {
    if (typeof exception.value === 'string') exception.value = maskSecrets(exception.value)
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb)
  }
  // Kök span verisi (contexts.trace.data) http.target / url.full ile sorgu dizesi taşıyabilir.
  const trace = event.contexts?.trace
  if (trace?.data) trace.data = scrubSpanData(trace.data)
  if (event.spans) {
    event.spans = event.spans.map(scrubSpan)
  }
  return event
}
