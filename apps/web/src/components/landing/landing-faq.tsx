'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'

const FAQS = [
  {
    q: 'Kredi kartı gerekiyor mu?',
    a: 'Hayır. E-posta ve işletme adı yeterli. 30 günün sonunda devam etmek istemezseniz hesap kendiliğinden kapanır.',
  },
  {
    q: 'Veriler nerede saklanıyor?',
    a: 'AWS Avrupa bölgesinde, KVKK uyumlu sunucularda şifreli olarak saklanır. İstediğiniz zaman Excel/CSV olarak dışa aktarabilirsiniz.',
  },
  {
    q: 'Yapay zeka neyi yapıyor?',
    a: 'Randevu çakışmalarını öngörür, müşteri segmentasyonunu otomatikleştirir ve operasyon önerileri sunar. Tüm özellikler arttırılarak geliştirilmektedir.',
  },
  {
    q: 'Sektörüme göre kişiselleştirme nasıl?',
    a: 'Onboarding\'de sektörünüzü seçin — anamnez soruları, hizmet kategorileri ve raporlar otomatik gelir. Her şey sonradan özelleştirilebilir.',
  },
  {
    q: 'İnternet kesilirse ne olur?',
    a: 'Mobil veriyle çalışır. Tamamen kesilse bile son ekran görünür, bağlantı geldiğinde otomatik senkronize olur.',
  },
  {
    q: 'Mevcut verilerimi taşıyabilir miyim?',
    a: 'Evet. Excel, defter fotoğrafı veya başka sistemden dışa aktarımı gönderin — ilk hafta ücretsiz biz aktarıyoruz.',
  },
  {
    q: 'Fiyat ileride artar mı?',
    a: 'Kurucu üyelerde asla. İlk 50 işletmeye ömür boyu ₺499 sözü veriyoruz.',
  },
  {
    q: 'Aboneliği nasıl iptal ederim?',
    a: 'Panelden tek tıkla. Cayma bedeli, taahhüt yok. Verilerinizi indirip hesabı kapatırsınız.',
  },
]

export function LandingFAQ() {
  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12 sm:mb-16"
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#D67D78' }}>
            Sıkça Sorulan Sorular
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
            Karar sürecinize destek olacak temel bilgiler.
          </h2>
        </motion.div>

        <div className="space-y-2.5">
          {FAQS.map((faq, i) => (
            <FaqItem key={faq.q} faq={faq} index={i} />
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 text-center text-[14px]"
          style={{ color: 'rgba(31,62,71,0.6)' }}
        >
          Yanıt bulamadığınız sorularınız için lütfen iletişime geçiniz:{' '}
          <a href="mailto:destek@beautyossapp.com" className="font-semibold" style={{ color: '#6B48FF' }}>
            destek@beautyossapp.com
          </a>
        </motion.p>
      </div>
    </section>
  )
}

function FaqItem({ faq, index }: { faq: { q: string; a: string }; index: number }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 }}
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'white',
        border: '1px solid rgba(31,62,71,0.06)',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4 text-left transition-colors"
        style={{ transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <span className="text-[15px] sm:text-[16px] font-semibold pr-4" style={{ color: '#1F3E47' }}>
          {faq.q}
        </span>
        <span
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
          style={{
            backgroundColor: open ? '#6B48FF' : 'rgba(31,62,71,0.06)',
            color: open ? 'white' : '#1F3E47',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          {open ? <Minus size={14} /> : <Plus size={14} />}
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden"
      >
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-[14.5px] leading-[1.65]" style={{ color: 'rgba(31,62,71,0.7)' }}>
          {faq.a}
        </div>
      </motion.div>
    </motion.div>
  )
}
