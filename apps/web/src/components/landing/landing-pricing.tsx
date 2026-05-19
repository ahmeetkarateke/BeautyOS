'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, Sparkles, ArrowRight } from 'lucide-react'

const INCLUDED = [
  'Sınırsız randevu ve müşteri',
  'Tüm modüller (paket, anamnez, fotoğraf, finans)',
  'Online rezervasyon sayfası + depozito',
  'Tüm personel, sınırsız kullanıcı',
  'Cari hesap, banka, alış faturası',
  '7/24 Türkçe destek + uygulama içi yardım',
  'KVKK uyumlu altyapı, otomatik yedek',
  'Veri taşıma ücretsiz (ilk hafta)',
]

export function LandingPricing() {
  return (
    <section id="pricing" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12 sm:mb-14"
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#6B48FF' }}>
            Tek plan, gizli ücret yok
          </p>
          <h2
            className="font-semibold tracking-tight leading-[1.1]"
            style={{
              color: '#1F3E47',
              fontSize: 'clamp(28px, 3.6vw, 44px)',
              letterSpacing: '-0.02em',
              fontWeight: 560,
            }}
          >
            Salonunuzun hak ettiği fiyat.
          </h2>
          <p className="mt-4 text-[16px]" style={{ color: 'rgba(31,62,71,0.6)' }}>
            Ay sonu sürpriz yok, taahhüt yok, kredi kartı sormuyoruz.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mx-auto"
        >
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{
              backgroundColor: 'white',
              border: '1px solid rgba(31,62,71,0.08)',
              boxShadow: '0 24px 80px -24px rgba(31,62,71,0.18), 0 1px 2px rgba(31,62,71,0.04)',
            }}
          >
            {/* Top accent stripe */}
            <div
              aria-hidden
              className="h-1.5"
              style={{ background: 'linear-gradient(90deg, #E89B96 0%, #6B48FF 50%, #1F3E47 100%)' }}
            />

            <div className="p-8 sm:p-10 lg:p-12">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{ background: 'linear-gradient(135deg, #6B48FF, #E89B96)' }}
                    >
                      <Sparkles size={14} className="text-white" strokeWidth={2.2} />
                    </span>
                    <h3 className="text-[24px] font-bold tracking-tight" style={{ color: '#1F3E47', letterSpacing: '-0.01em' }}>
                      Salon Pro
                    </h3>
                  </div>
                  <p className="mt-2 text-[14px]" style={{ color: 'rgba(31,62,71,0.6)' }}>
                    Salonunuzu çalıştırmak için ihtiyacınız olan her şey.
                  </p>
                </div>
                <span
                  className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: 'rgba(232,155,150,0.16)', color: '#A45F5A' }}
                >
                  En popüler
                </span>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-2 mb-2">
                <span
                  className="font-bold tracking-tight"
                  style={{
                    color: '#1F3E47',
                    fontSize: 'clamp(48px, 6vw, 72px)',
                    letterSpacing: '-0.03em',
                  }}
                >
                  ₺499
                </span>
                <span className="text-[18px] font-medium" style={{ color: 'rgba(31,62,71,0.55)' }}>
                  / ay
                </span>
              </div>
              <p className="text-[13px] mb-7" style={{ color: 'rgba(31,62,71,0.5)' }}>
                + KDV · Aylık ödeme · Cayma bedeli yok · İlk 30 gün ücretsiz
              </p>

              {/* CTA */}
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 w-full h-12 rounded-lg font-semibold text-[15px] text-white transition-all"
                style={{
                  backgroundColor: '#6B48FF',
                  boxShadow: '0 1px 2px rgba(31,62,71,0.06), inset 0 1px 0 rgba(255,255,255,0.15)',
                  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  transitionDuration: '180ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#5A3CFB'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px -8px rgba(107,72,255,0.45)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#6B48FF'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(31,62,71,0.06), inset 0 1px 0 rgba(255,255,255,0.15)'
                }}
              >
                30 gün ücretsiz başla
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <p className="mt-3 text-center text-[12px]" style={{ color: 'rgba(31,62,71,0.5)' }}>
                Kredi kartı istemiyoruz · İlk 50 üye fiyat kilidi
              </p>

              {/* Divider */}
              <div className="my-8 h-px" style={{ backgroundColor: 'rgba(31,62,71,0.08)' }} />

              {/* Features */}
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: 'rgba(31,62,71,0.5)' }}>
                Neler dahil
              </p>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px]" style={{ color: 'rgba(31,62,71,0.78)' }}>
                    <span
                      className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(40,167,69,0.14)' }}
                    >
                      <Check size={11} style={{ color: '#28A745' }} strokeWidth={3} />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sub-band */}
          <p className="mt-6 text-center text-[13px]" style={{ color: 'rgba(31,62,71,0.55)' }}>
            Birden fazla şube? <Link href="/iletisim" style={{ color: '#6B48FF', fontWeight: 600 }}>İletişime geçin →</Link>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
