import type { Breadcrumb, Event } from '@sentry/node'

// KVKK: istek gövdesi anamnez (sağlık/alerji), telefon gibi özel nitelikli veri taşıyabilir
// ve Sentry yurt dışındadır. Bu yüzden istekten yalnız yöntem ve sorgusuz yol, geri kalan
// her şey (gövde, sorgu dizgisi, çerezler, başlıklar, kullanıcı alanları) silinir.

function stripQuery(url: string): string {
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  const data = crumb.data
  if (!data) return crumb
  const safe: Record<string, unknown> = {}
  if (typeof data.url === 'string') safe.url = stripQuery(data.url)
  if (typeof data.method === 'string') safe.method = data.method
  if (typeof data.status_code === 'number') safe.status_code = data.status_code
  return { ...crumb, data: safe }
}

export function scrubEvent<T extends Event>(event: T): T {
  if (event.request) {
    const { method, url } = event.request
    event.request = { method, url: url === undefined ? undefined : stripQuery(url) }
  }
  delete event.user
  delete event.extra
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb)
  }
  return event
}
