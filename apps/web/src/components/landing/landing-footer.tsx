'use client'

import Link from 'next/link'
import { Mail } from 'lucide-react'

// Lucide brand logoları kaldırmış (trademark). Inline SVG kullanıyoruz.
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
function TwitterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

const COLUMNS = [
  {
    title: 'Ürün',
    links: [
      { label: 'Özellikler', href: '#features' },
      { label: 'Sektörler', href: '#sectors' },
      { label: 'Fiyat', href: '#pricing' },
      { label: 'Online Rezervasyon', href: '/iletisim' },
    ],
  },
  {
    title: 'Kaynaklar',
    links: [
      { label: 'Sıkça Sorulanlar', href: '#faq' },
      { label: 'Yardım Merkezi', href: '/yardim' },
      { label: 'İletişim', href: '/iletisim' },
      { label: 'Demo İste', href: '/iletisim' },
    ],
  },
  {
    title: 'Yasal',
    links: [
      { label: 'KVKK & Aydınlatma Metni', href: '/kvkk' },
      { label: 'Gizlilik Politikası', href: '/gizlilik' },
      { label: 'Kullanım Şartları', href: '/sartlar' },
      { label: 'Çerez Politikası', href: '/cerez' },
    ],
  },
]

export function LandingFooter() {
  return (
    <footer
      className="relative border-t"
      style={{
        backgroundColor: 'rgba(31,62,71,0.025)',
        borderColor: 'rgba(31,62,71,0.08)',
      }}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 sm:gap-10">
          {/* Brand col */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[14px]"
                style={{
                  background: 'linear-gradient(135deg, #6B48FF 0%, #E89B96 100%)',
                  boxShadow: '0 2px 8px -2px rgba(107,72,255,0.4)',
                }}
              >
                B
              </span>
              <span className="font-semibold text-[18px] tracking-tight" style={{ color: '#1F3E47' }}>
                BeautyOS
              </span>
            </Link>
            <p className="text-[14px] leading-[1.55] max-w-xs" style={{ color: 'rgba(31,62,71,0.6)' }}>
              Türkiye salonları, klinikleri ve güzellik merkezleri için modern yönetim sistemi.
              Defter, Excel ve sohbetlerin yerine.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <SocialButton href="mailto:hello@beautyossapp.com" label="E-posta" Icon={Mail} />
              <SocialButton href="https://instagram.com/beautyossapp" label="Instagram" Icon={InstagramIcon} />
              <SocialButton href="https://twitter.com/beautyossapp" label="X / Twitter" Icon={TwitterIcon} />
              <SocialButton href="https://linkedin.com/company/beautyossapp" label="LinkedIn" Icon={LinkedinIcon} />
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4
                className="text-[12px] font-semibold uppercase tracking-[0.1em] mb-4"
                style={{ color: 'rgba(31,62,71,0.5)' }}
              >
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[14px] transition-colors hover:underline underline-offset-4"
                      style={{ color: 'rgba(31,62,71,0.75)' }}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div
          className="mt-12 pt-7 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ borderColor: 'rgba(31,62,71,0.06)' }}
        >
          <p className="text-[13px]" style={{ color: 'rgba(31,62,71,0.5)' }}>
            © 2026 BeautyOS. Tüm hakları saklıdır. Made in Türkiye.
          </p>
          <p className="text-[13px]" style={{ color: 'rgba(31,62,71,0.5)' }}>
            KVKK uyumlu · AWS İstanbul yakın bölge
          </p>
        </div>
      </div>
    </footer>
  )
}

function SocialButton({ href, label, Icon }: { href: string; label: string; Icon: React.ElementType }) {
  return (
    <a
      href={href}
      aria-label={label}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all"
      style={{
        backgroundColor: 'white',
        border: '1px solid rgba(31,62,71,0.08)',
        color: 'rgba(31,62,71,0.7)',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        transitionDuration: '180ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#6B48FF'
        e.currentTarget.style.color = 'white'
        e.currentTarget.style.borderColor = '#6B48FF'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'white'
        e.currentTarget.style.color = 'rgba(31,62,71,0.7)'
        e.currentTarget.style.borderColor = 'rgba(31,62,71,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <Icon size={15} strokeWidth={1.8} />
    </a>
  )
}
