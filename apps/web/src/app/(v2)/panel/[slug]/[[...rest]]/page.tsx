import { notFound, redirect } from 'next/navigation'
import { NotReadyScreen } from '@/features/shell/not-ready-screen'
import { isKnownPanelScreen } from '@/lib/v2/routes'

// Hazır olmayan ekranlar: bilinen bir ekran adıysa "hazırlanıyor" + eski ekran bağlantısı, değilse markalı 404.
// Her ekran hazır olunca kendi klasörüyle bu yakalayıcıdan önce eşleşir.
export default async function PanelFallbackPage({ params }: { params: Promise<{ slug: string; rest?: string[] }> }) {
  const { slug, rest = [] } = await params
  if (rest.length === 0) redirect(`/panel/${slug}/bugun`)
  if (!isKnownPanelScreen(rest)) notFound()
  return <NotReadyScreen rest={rest} />
}
