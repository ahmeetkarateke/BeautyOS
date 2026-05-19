'use client'

import { motion } from 'framer-motion'
import { BookOpenText, FileSpreadsheet, MessageSquareText } from 'lucide-react'

const PROBLEMS = [
  {
    icon: BookOpenText,
    title: 'Kâğıt tabanlı kayıt sistemlerinin yetersizliği',
    body:
      'Randevu defterleri ve manuel müşteri kayıtları, işletme büyüdükçe yetersiz kalmaktadır. Geçmiş işlem bilgilerine hızlı erişim sağlanamaz; paket bakiyeleri, müşteri tercihleri ve tedavi geçmişi sistematik olarak takip edilemez. Fiziksel kayıtların kaybolması durumunda veri kurtarma mümkün değildir.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Elektronik tablolarla yönetimin sürdürülemezliği',
    body:
      'Excel ve benzeri elektronik tablo çözümleri, işletme operasyonları büyüdükçe karmaşıklaşmaktadır. Personel komisyon hesaplamaları, ciro takibi ve raporlama uzun süre almakta; formül hataları finansal kayıplara yol açabilmektedir. Çoklu kullanıcı senaryolarında veri tutarlılığı sağlamak güçleşir.',
  },
  {
    icon: MessageSquareText,
    title: 'Mesajlaşma kanalları üzerinden randevu yönetimi',
    body:
      'Anlık mesajlaşma uygulamaları üzerinden alınan randevular sistematik biçimde takip edilemediğinde çakışmalar ve atlamalar meydana gelmektedir. Müşteri geçmişine erişim sohbet kayıtlarının manuel taranmasını gerektirir. Bu durum personelin operasyonel verimliliğini ve hizmet kalitesini doğrudan etkilemektedir.',
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
            Sektörel zorluklar
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
            Geleneksel yöntemlerle yönetilen işletmelerin karşılaştığı temel sorunlar.
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
