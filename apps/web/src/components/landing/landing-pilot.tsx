'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Crown, Lock, ArrowRight } from 'lucide-react'

export function LandingPilot() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl p-8 sm:p-12 lg:p-16"
          style={{
            background:
              'linear-gradient(135deg, #1F3E47 0%, #2A5562 60%, #1F3E47 100%)',
            boxShadow: '0 24px 80px -24px rgba(31,62,71,0.4)',
          }}
        >
          {/* Decorative orbs */}
          <div
            aria-hidden
            className="absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #E89B96 0%, transparent 70%)' }}
          />
          <div
            aria-hidden
            className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #6B48FF 0%, transparent 70%)' }}
          />

          <div className="relative flex flex-col lg:flex-row gap-8 lg:items-center">
            <div className="flex-1">
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.08em] mb-5"
                style={{
                  backgroundColor: 'rgba(232,155,150,0.18)',
                  color: '#E89B96',
                  border: '1px solid rgba(232,155,150,0.3)',
                }}
              >
                <Crown size={13} strokeWidth={2.2} />
                Kurucu Üye Programı
              </span>
              <h2
                className="font-semibold tracking-tight leading-[1.1]"
                style={{
                  color: 'white',
                  fontSize: 'clamp(28px, 3.4vw, 42px)',
                  letterSpacing: '-0.02em',
                  fontWeight: 560,
                }}
              >
                İlk 50 işletmeye özel{' '}
                <span style={{ color: '#E89B96' }}>ömür boyu</span> sabit fiyat.
              </h2>
              <p
                className="mt-5 text-[16px] sm:text-[17px] leading-[1.6] max-w-xl"
                style={{ color: 'rgba(255,255,255,0.72)' }}
              >
                İlk 50 işletme için ₺499 ömür boyu sabit. Fiyatlar yükselse bile siz aynı tarifedesiniz.
              </p>

              <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
                <Link
                  href="/signup"
                  className="group inline-flex items-center justify-center gap-2 px-6 h-12 rounded-lg text-[15px] font-semibold transition-all"
                  style={{
                    backgroundColor: 'white',
                    color: '#1F3E47',
                    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    transitionDuration: '180ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 8px 24px -8px rgba(255,255,255,0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  Kurucu Üye Olun
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <span className="flex items-center gap-1.5 text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <Lock size={12} />
                  Kontenjan tamamlandığında program kapatılacaktır
                </span>
              </div>
            </div>

            {/* Counter card */}
            <div
              className="flex-shrink-0 rounded-2xl p-6 lg:p-7 min-w-[240px]"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: 'rgba(232,155,150,0.8)' }}>
                Kalan Kontenjan
              </p>
              <p className="text-[64px] font-bold leading-none tracking-tight" style={{ color: 'white', letterSpacing: '-0.03em' }}>
                42
                <span className="text-[24px]" style={{ color: 'rgba(255,255,255,0.4)' }}>/ 50</span>
              </p>
              <div className="mt-4 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '16%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #E89B96, #6B48FF)' }}
                />
              </div>
              <p className="mt-4 text-[12px] leading-[1.5]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Kontenjan tamamlandığında program kapanır.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
