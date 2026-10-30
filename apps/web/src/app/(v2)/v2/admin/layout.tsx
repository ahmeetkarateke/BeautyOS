import type { Metadata } from 'next'

// Yönetim yüzeyi dizine alınmaz ve adres başka sitelere sızmaz.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
