'use client'

import { motion } from 'framer-motion'
import {
  Stethoscope, Sparkles, Heart, Scissors,
  Bath, Hand, Activity, Anchor, Droplets, FlaskConical, Grid3X3,
} from 'lucide-react'

const SECTORS = [
  { icon: Stethoscope,   label: 'Diş Hekimliği',       hint: 'Anamnez ve hasta dosyası' },
  { icon: Sparkles,      label: 'Estetik Klinik',      hint: 'Görsel arşiv ve paket' },
  { icon: Heart,         label: 'Güzellik Merkezi',    hint: 'Cilt geçmişi ve seans' },
  { icon: Scissors,      label: 'Kuaför',              hint: 'Hızlı randevu ve sadakat' },
  { icon: Activity,      label: 'Berber',              hint: 'Sıra ve günlük kasa' },
  { icon: Bath,          label: 'Spa & Wellness',      hint: 'Oda ve uygulayıcı takvimi' },
  { icon: Hand,          label: 'Nail Stüdyo',         hint: 'Tasarım arşivi ve tercih' },
  { icon: Droplets,      label: 'Masaj Salonu',        hint: 'Uygulayıcı ve paket' },
  { icon: Anchor,        label: 'Dövme & Piercing',    hint: 'Tasarım onayı ve depozito' },
  { icon: FlaskConical,  label: 'Saç Ekim Merkezi',    hint: 'Operasyon ve kontrol' },
  { icon: Grid3X3,       label: 'Diğer Sektörler',     hint: 'Hizmet bazlı her işletme' },
]

export function LandingSectors() {
  return (
    <section id="sectors" className="py-20 sm:py-28" style={{ backgroundColor: 'rgba(31,62,71,0.025)' }}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mb-12 sm:mb-16"
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#6B48FF' }}>
            Sektörler
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
            Birçok sektör için kişiselleştirilebilir.
          </h2>
          <p className="mt-4 text-[16px] leading-[1.6]" style={{ color: 'rgba(31,62,71,0.65)', maxWidth: '54ch' }}>
            Sektörünüzü seçin — anamnez, hizmetler ve raporlar otomatik gelir.
            Sonra istediğiniz gibi özelleştirin.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {SECTORS.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.03 }}
                className="group p-5 rounded-xl transition-all cursor-default"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid rgba(31,62,71,0.06)',
                  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                  transitionDuration: '200ms',
                }}
                whileHover={{ y: -2, boxShadow: '0 12px 32px -12px rgba(31,62,71,0.14)' }}
              >
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3"
                  style={{
                    backgroundColor: 'rgba(107,72,255,0.08)',
                    color: '#6B48FF',
                  }}
                >
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <p className="text-[15px] font-semibold mb-1" style={{ color: '#1F3E47' }}>{s.label}</p>
                <p className="text-[12.5px] leading-[1.45]" style={{ color: 'rgba(31,62,71,0.55)' }}>
                  {s.hint}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
