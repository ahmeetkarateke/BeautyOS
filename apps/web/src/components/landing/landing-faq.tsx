'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'

const FAQS = [
  {
    q: 'Deneme için kredi kartı verecek miyim?',
    a: 'Hayır. E-posta ve salon adı yeter. 30 gün sonunda devam etmek isterseniz fatura bilgilerinizi alırız; istemezseniz hesap kendiliğinden kapanır, kimse sizi aramaz.',
  },
  {
    q: 'Verilerim kimde duruyor, güvende mi?',
    a: 'Veriler AWS İstanbul yakın bölgesinde, KVKK uyumlu sunucularda, şifreli olarak duruyor. Sadece siz ve yetki verdiğiniz personel erişebilir. Çıkmak isterseniz tüm veriyi Excel olarak indirip alabilirsiniz.',
  },
  {
    q: 'İnternet kesilirse salonum durur mu?',
    a: 'Mobil veriyle çalışır. İnternet tamamen giderse son açık ekran üzerinden randevuya bakabilir, kapanışta sistem otomatik senkronize olur. Kasanız ve müşteri kayıtlarınız hiçbir koşulda kaybolmaz.',
  },
  {
    q: 'Mevcut sistemimden veri taşıyabilir miyim?',
    a: 'Excel, defter fotoğrafı veya başka programdan dışa aktarımınızı bize gönderin — ilk hafta ücretsiz olarak biz aktarıyoruz. Tek bir randevu bile kaybolmaz.',
  },
  {
    q: 'Personelim müşteri telefonlarını görebilir mi?',
    a: 'Siz karar verirsiniz. Her personel için ayrı yetki: bazıları sadece kendi randevusunu görür, bazıları tüm salonu. Salondan ayrılan personelin erişimini tek tıkla kapatırsınız.',
  },
  {
    q: 'Online rezervasyon sayfam Google\'da görünür mü?',
    a: 'Evet. /book/[salon-adı] linkiniz public ve SEO uyumlu. Instagram bio\'ya, Google profilinize, QR koda koyup paylaşabilirsiniz.',
  },
  {
    q: 'Fiyat ileride artar mı?',
    a: 'Bugün üye olanların fiyatı asla artmaz — kuruluş üyelerine ömür boyu ₺499 sözü veriyoruz. Yeni gelenler için fiyat değişebilir, sizinki kilitli kalır.',
  },
  {
    q: 'Beğenmezsem nasıl çıkarım?',
    a: 'Panelden tek tıkla. Cayma bedeli, taahhüt, "3 ay daha öde" diye bir şey yok. Verilerinizi indirin, hesabı kapatın, biter.',
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
            Sıkça sorulan
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
            Aklınızda hâlâ soru kaldıysa…
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
          Başka sorunuz var mı?{' '}
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
