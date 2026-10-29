import type { Metadata, Viewport } from 'next'

// Yeni arayüzün kök düzeni (ADR-UI-02). Eski arayüzün kök düzeni app/(legacy)/layout.tsx'tedir; iki düzen CSS'i birbirine karıştırmaz.
// Tokenlar, yazı tipi ve temel CSS W2'de eklenir.
export const metadata: Metadata = {
  title: 'BeautyOS',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function V2RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
