import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BeautyOS — Salon, Klinik ve Güzellik Merkezi Yönetim Sistemi',
  description:
    'Randevu, müşteri kartı, anamnez, paket, personel komisyonu, kasa ve cari hesap — tek panelde. Türk salonları için ₺499/ay, 30 gün ücretsiz.',
  openGraph: {
    title: 'BeautyOS — Kişiselleştirilebilir, yapay zeka destekli yönetim platformu',
    description: 'Salon, klinik ve güzellik merkezleri için tek panel. Birçok sektör, 30 gün ücretsiz.',
    type: 'website',
    locale: 'tr_TR',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${GeistSans.className} ${GeistMono.variable} antialiased`}
      style={{
        backgroundColor: '#FFF8F3',
        color: '#1F3E47',
        minHeight: '100vh',
      }}
    >
      {/* Global noise overlay — premium SaaS pattern */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.8'/></svg>")`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
