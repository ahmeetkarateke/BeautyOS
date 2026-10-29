import { notFound } from 'next/navigation'
import { isSurfaceEnabled } from '@/lib/v2/flags'

// Panel yüzeyi bayrağı kapalıyken /panel/* hiçbir koşulda render edilmez (proxy ek olarak 404'ler).
export default function PanelSurfaceLayout({ children }: { children: React.ReactNode }) {
  if (!isSurfaceEnabled('panel')) notFound()
  return children
}
