import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BeautyOS — Salon Yönetim Platformu',
  description: 'Güzellik salonu yönetim platformu',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.className}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const t=JSON.parse(localStorage.getItem('beautyos-theme-v2')||'{}');document.documentElement.classList.toggle('dark',!!t?.state?.dark)}catch{document.documentElement.classList.remove('dark')}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
