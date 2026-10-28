import type { Metadata, Viewport } from 'next'
import '@/styles/app.css'

// Yeni arayüzün kök düzeni (ADR-UI-02). Eski arayüzün kök düzeni app/(legacy)/layout.tsx'tedir; iki düzen CSS'i birbirine karıştırmaz.
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
