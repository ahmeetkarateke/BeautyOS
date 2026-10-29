import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Showcase } from '@/features/showcase/showcase'
import { showcaseEnabled } from '@/lib/v2/showcase'

export const metadata: Metadata = { title: 'Tasarım sistemi', robots: { index: false, follow: false } }

// Yalnız staging: bayrak kapalıyken (üretim dahil) sayfa yoktur. Proxy'ye ek savunma derinliği.
export default function DesignSystemPage() {
  if (!showcaseEnabled) notFound()
  return <Showcase />
}
