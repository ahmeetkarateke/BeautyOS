'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Çözümler', href: '#features' },
  { label: 'Sektörler', href: '#sectors' },
  { label: 'Fiyatlandırma', href: '#pricing' },
  { label: 'Sıkça Sorulanlar', href: '#faq' },
]

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? 'rgba(255, 248, 243, 0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px) saturate(180%)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(31,62,71,0.06)' : '1px solid transparent',
      }}
    >
      <nav className="mx-auto max-w-7xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <BrandMark />
          <span className="font-semibold text-[17px] tracking-tight" style={{ color: '#1F3E47' }}>
            BeautyOS
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-md text-[14px] font-medium transition-colors"
              style={{ color: 'rgba(31,62,71,0.7)' }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center px-3.5 py-2 rounded-md text-[14px] font-medium transition-colors"
            style={{ color: 'rgba(31,62,71,0.85)' }}
          >
            Oturum Aç
          </Link>
          <Link
            href="/signup"
            className="hidden sm:inline-flex items-center px-4 py-2 rounded-md text-[14px] font-medium text-white transition-all"
            style={{
              backgroundColor: '#6B48FF',
              boxShadow: '0 1px 2px rgba(31,62,71,0.08)',
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#5A3CFB'
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 8px 24px -8px rgba(107,72,255,0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#6B48FF'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(31,62,71,0.08)'
            }}
          >
            Ücretsiz Deneyin
          </Link>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded-md"
            aria-label="Menü"
            style={{ color: '#1F3E47' }}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div
          className="md:hidden border-t"
          style={{
            backgroundColor: '#FFF8F3',
            borderColor: 'rgba(31,62,71,0.06)',
          }}
        >
          <div className="px-5 py-4 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-md text-[15px] font-medium"
                style={{ color: 'rgba(31,62,71,0.85)' }}
              >
                {item.label}
              </Link>
            ))}
            <div className="h-px my-2" style={{ backgroundColor: 'rgba(31,62,71,0.06)' }} />
            <Link
              href="/login"
              className="px-3 py-2.5 rounded-md text-[15px] font-medium"
              style={{ color: 'rgba(31,62,71,0.85)' }}
            >
              Oturum Aç
            </Link>
            <Link
              href="/signup"
              className="mt-1 px-3 py-2.5 rounded-md text-[15px] font-medium text-white text-center"
              style={{ backgroundColor: '#6B48FF' }}
            >
              Ücretsiz Deneyin
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

function BrandMark() {
  return (
    <span
      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[14px]"
      style={{
        background: 'linear-gradient(135deg, #6B48FF 0%, #E89B96 100%)',
        boxShadow: '0 2px 8px -2px rgba(107,72,255,0.4)',
      }}
      aria-hidden
    >
      B
    </span>
  )
}
