'use client'

import { motion } from 'framer-motion'
import { BookOpenText, FileSpreadsheet, MessageSquareText } from 'lucide-react'

const PROBLEMS = [
  {
    icon: BookOpenText,
    title: 'Defter dolup taşıyor.',
    body:
      'Geçen haftanın randevusunu bulmak için 3 sayfa geri çeviriyorsunuz. Müşteri "bende ne kalmıştı" diye soruyor, paket bakiyesini kafadan hesaplıyorsunuz. Bir gün defteri kaybederseniz salonun 6 ayı uçuyor.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel her gün biraz daha karışıyor.',
    body:
      'Cironun formülü bozuluyor, personel kendi sayfasını saklı tutuyor, ay sonu komisyon hesabı 2 saat sürüyor. Tablo büyüdükçe hata çoğalıyor — siz salona değil dosyaya bakıyorsunuz.',
  },
  {
    icon: MessageSquareText,
    title: 'Sohbetlerde 80 randevu kayboluyor.',
    body:
      '"Salı 3\'e yazdım" yazıyorsunuz, müşteri okumuyor, gelmiyor, koltuk boş kalıyor. Hangi müşteri ne istemişti — sohbeti yukarı kaydırıp arıyorsunuz. Bu telefon trafiği size salon işletmek için kalan zamanı yiyor.',
  },
]

export function LandingProblem() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mb-12 sm:mb-16"
        >
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-3"
            style={{ color: '#D67D78' }}
          >
            Tanıdık geliyor mu?
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
            Salonun ardındaki gerçek iş, salonun kendisinden ağır olmaya başladı.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
          {PROBLEMS.map((p, i) => {
            const Icon = p.icon
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
                className="relative p-7 rounded-2xl transition-all"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid rgba(31,62,71,0.06)',
                  boxShadow: '0 1px 2px rgba(31,62,71,0.04)',
                }}
              >
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-5"
                  style={{
                    backgroundColor: 'rgba(232,155,150,0.14)',
                    color: '#D67D78',
                  }}
                >
                  <Icon size={18} strokeWidth={2} />
                </span>
                <h3
                  className="text-[19px] font-semibold mb-2.5 leading-tight"
                  style={{ color: '#1F3E47', letterSpacing: '-0.01em' }}
                >
                  {p.title}
                </h3>
                <p
                  className="text-[15px] leading-[1.6]"
                  style={{ color: 'rgba(31,62,71,0.65)' }}
                >
                  {p.body}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
