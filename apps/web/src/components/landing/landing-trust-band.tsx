'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, FileText, CreditCard, Server } from 'lucide-react'

const ITEMS = [
  { icon: ShieldCheck, label: 'KVKK Uyumluluğu',          sub: 'Veriler uçtan uca şifreli olarak saklanır' },
  { icon: FileText,    label: 'e-Fatura Entegrasyonu',    sub: 'Mali müşavir uyumlu raporlama' },
  { icon: CreditCard,  label: 'iyzico Ödeme Altyapısı',   sub: 'PCI-DSS sertifikalı, yerel ödeme' },
  { icon: Server,      label: 'Yerel Sunucu Altyapısı',   sub: 'AWS Avrupa bölgesi, düşük gecikme' },
]

export function LandingTrustBand() {
  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center text-[12px] font-semibold uppercase tracking-[0.16em] mb-8"
          style={{ color: 'rgba(31,62,71,0.5)' }}
        >
          Türkiye'nin yasal ve teknik standartlarına tam uyumlu altyapı
        </motion.p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {ITEMS.map((item, i) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid rgba(31,62,71,0.06)',
                }}
              >
                <span
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(107,72,255,0.08)',
                    color: '#6B48FF',
                  }}
                >
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight" style={{ color: '#1F3E47' }}>{item.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(31,62,71,0.55)' }}>{item.sub}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
