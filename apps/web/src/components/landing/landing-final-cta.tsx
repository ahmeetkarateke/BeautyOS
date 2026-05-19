'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'

export function LandingFinalCTA() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative text-center"
        >
          {/* Decorative background */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-3xl"
            style={{
              background:
                'radial-gradient(60% 60% at 50% 40%, rgba(232,155,150,0.18) 0%, transparent 70%), radial-gradient(50% 50% at 50% 80%, rgba(107,72,255,0.08) 0%, transparent 70%)',
            }}
          />

          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-4" style={{ color: '#D67D78' }}>
            Ücretsiz denemeye başlayın
          </p>

          <h2
            className="font-semibold tracking-tight leading-[1.05] max-w-3xl mx-auto"
            style={{
              color: '#1F3E47',
              fontSize: 'clamp(32px, 5vw, 60px)',
              letterSpacing: '-0.025em',
              fontWeight: 560,
            }}
          >
            Platformumuzu{' '}
            <span style={{ color: '#D67D78' }}>30 gün boyunca</span>{' '}
            ücretsiz deneyimleyin.
          </h2>

          <p
            className="mt-6 text-[17px] sm:text-[18px] leading-[1.55] max-w-xl mx-auto"
            style={{ color: 'rgba(31,62,71,0.65)' }}
          >
            Hesap oluşturmak için yalnızca e-posta adresi ve işletme bilgileri yeterlidir.
            Kredi kartı bilgisi talep edilmez, cayma bedeli ve uzun vadeli taahhüt bulunmaz.
            Verilerinizi istediğiniz zaman dışa aktarabilirsiniz.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/signup"
              className="group inline-flex items-center justify-center gap-2 px-7 h-14 rounded-lg text-[16px] font-semibold text-white transition-all"
              style={{
                backgroundColor: '#6B48FF',
                boxShadow: '0 1px 2px rgba(31,62,71,0.06), inset 0 1px 0 rgba(255,255,255,0.15)',
                transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                transitionDuration: '180ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#5A3CFB'
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(107,72,255,0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#6B48FF'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(31,62,71,0.06), inset 0 1px 0 rgba(255,255,255,0.15)'
              }}
            >
              Ücretsiz Hesap Oluşturun
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/iletisim"
              className="inline-flex items-center px-4 h-12 rounded-lg text-[15px] font-medium"
              style={{ color: '#1F3E47' }}
            >
              Demo Talep Edin →
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]" style={{ color: 'rgba(31,62,71,0.6)' }}>
            {['Kredi kartı gerekmez', 'Cayma bedeli yoktur', 'Ücretsiz veri taşıma', 'Türkçe müşteri desteği'].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check size={14} style={{ color: '#28A745' }} strokeWidth={2.5} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}
