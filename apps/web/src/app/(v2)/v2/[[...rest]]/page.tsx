import Link from 'next/link'
import { notFound } from 'next/navigation'
import { enabledSurfaces } from '@/lib/v2/flags'
import { resolveRoute } from '@/lib/v2/routes'

// Geçici yer tutucu: yeni yüzeyler (W30, W32, W33, W40) gelene kadar iç /v2 yolları bu bilgiyi gösterir.
// Proxy'ye ek olarak sunucu tarafında da bayrak denetlenir (savunma derinliği: matcher kaçırsa bile 404).
export default async function V2PlaceholderPage({ params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest = [] } = await params
  if (resolveRoute(['/v2', ...rest].join('/'), enabledSurfaces).kind === 'notFound') notFound()

  return (
    <main>
      <h1>Bu ekran yeni arayüzde hazırlanıyor</h1>
      <p>
        <Link href="/">Ana sayfaya dön</Link>
      </p>
    </main>
  )
}
