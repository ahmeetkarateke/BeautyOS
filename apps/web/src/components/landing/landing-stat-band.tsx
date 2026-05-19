'use client'

import { motion } from 'framer-motion'

const STATS = [
  { value: '30', unit: 'gün',  label: 'Ücretsiz deneme' },
  { value: 'AI', unit: '',     label: 'Yapay zeka destekli' },
  { value: '100%', unit: '',   label: 'Kişiselleştirilebilir' },
  { value: '₺499', unit: '/ ay', label: 'Tek fiyat' },
]

export function LandingStatBand() {
  return (
    <section
      className="py-12 sm:py-14 border-y"
      style={{
        backgroundColor: 'rgba(31,62,71,0.025)',
        borderColor: 'rgba(31,62,71,0.06)',
      }}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
              className="text-center sm:text-left"
            >
              <p className="font-bold tracking-tight" style={{ color: '#1F3E47' }}>
                <span style={{ fontSize: 'clamp(28px, 3.6vw, 40px)', letterSpacing: '-0.02em' }}>
                  {s.value}
                </span>
                <span
                  className="ml-1 text-[16px] sm:text-[17px] font-medium"
                  style={{ color: 'rgba(31,62,71,0.55)' }}
                >
                  {s.unit}
                </span>
              </p>
              <p
                className="mt-1 text-[13px] sm:text-[14px] font-medium"
                style={{ color: 'rgba(31,62,71,0.6)' }}
              >
                {s.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
