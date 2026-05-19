'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'

const FAQS = [
  {
    q: 'Ücretsiz deneme için kredi kartı bilgisi gerekli midir?',
    a: 'Hayır. Hesap oluşturmak için yalnızca e-posta adresi ve işletme adı yeterlidir. 30 günlük deneme süresinin sonunda abone olmak isterseniz fatura bilgilerinizi tarafımıza iletmeniz gerekmektedir. Abonelik tercih edilmediği takdirde hesap otomatik olarak askıya alınır; herhangi bir ödeme tahsil edilmez.',
  },
  {
    q: 'Veriler nerede saklanır ve veri güvenliği nasıl sağlanır?',
    a: 'Tüm veriler AWS Avrupa bölgesinde, KVKK uyumlu sunucularda uçtan uca şifreli olarak saklanmaktadır. Verilere yalnızca yetkilendirilen kullanıcılar erişebilir. Sözleşmenizin sonlanması durumunda tüm verilerinizi standart formatlarda (Excel, CSV) dışa aktarabilirsiniz.',
  },
  {
    q: 'İnternet bağlantısı kesildiğinde sistem nasıl davranır?',
    a: 'Platform mobil veri bağlantısı üzerinden çalışmaya devam eder. İnternet bağlantısı tamamen kesilse dahi son görüntülenen randevu bilgilerine erişim mümkündür. Bağlantı yeniden sağlandığında veriler otomatik olarak senkronize edilir. Müşteri kayıtları ve finansal veriler hiçbir koşulda kaybolmaz.',
  },
  {
    q: 'Mevcut yönetim sistemimden veri aktarımı mümkün müdür?',
    a: 'Excel dosyalarınızı, fiziksel defter görüntülerinizi veya diğer yazılımlardan dışa aktarılmış verileri tarafımıza iletebilirsiniz. İlk hafta içinde veri taşıma hizmeti ücretsiz olarak sağlanmaktadır. Mevcut tüm randevu ve müşteri kayıtlarınız sisteme aktarılır.',
  },
  {
    q: 'Personel yetkileri nasıl yapılandırılır?',
    a: 'Her personel için ayrı yetki seviyeleri tanımlanabilir. Bazı personeller yalnızca kendi randevu takvimini, diğerleri ise tüm işletme bilgilerini görüntüleyebilir. Personel ayrılması durumunda erişim hakları yönetim panelinden anında iptal edilebilir.',
  },
  {
    q: 'Online rezervasyon sayfası arama motorlarında görünür mü?',
    a: 'Evet. Her işletmeye özel oluşturulan rezervasyon sayfası (/book/[işletme-adı] formatında) arama motoru optimizasyonuna uygun yapılandırılmıştır. Bu bağlantıyı sosyal medya profillerinizde, Google İşletme sayfanızda veya QR kodlar aracılığıyla müşterilerinizle paylaşabilirsiniz.',
  },
  {
    q: 'Abonelik ücreti ileride değişecek midir?',
    a: 'Kurucu üye programı kapsamında abone olan ilk 50 işletme için aylık ₺499 tarifesi sözleşme süresince sabit kalmaktadır. Standart fiyatlandırma güncellense dahi kurucu üyelerin aboneliği aynı ücret üzerinden devam eder.',
  },
  {
    q: 'Aboneliği iptal etmek isterseniz süreç nasıl işler?',
    a: 'Abonelik iptali yönetim paneli üzerinden tek bir işlemle gerçekleştirilebilir. Cayma bedeli, uzun vadeli taahhüt veya cezai şart uygulanmamaktadır. İptal işleminden önce tüm verilerinizi dışa aktarabilir, ardından hesabınızı kapatabilirsiniz.',
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
