import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BeautyOS',
  description: 'Güzellik salonu yönetim platformu',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
