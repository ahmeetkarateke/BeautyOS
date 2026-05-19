'use client'

import { motion } from 'framer-motion'
import {
  Calendar, Users, Globe, Package, Wallet, Banknote,
  ClipboardList, Phone, MapPin, Sparkles, Award,
} from 'lucide-react'

const FEATURES = [
  {
    number: '01',
    title: 'Bir daha asla boş koltuk',
    eyebrow: 'Randevu Yönetimi',
    body:
      'Çakışan saat, unutulan müşteri, kayıp randevu yok. Personel takvimi tek ekranda, dolu saatler renk renk. Sürükle-bırak ile dakikalar içinde yeniden planlayın.',
    bullets: ['Personel renk kodlu takvim', 'Sürükle-bırak ile yeniden planla', 'Kaynak (koltuk/oda) çakışma engeli'],
    Visual: VisualCalendar,
  },
  {
    number: '02',
    title: 'Her müşteriyi adıyla tanıyın',
    eyebrow: 'Müşteri Kartı + Anamnez',
    body:
      'Geçmiş işlemler, alerji, tercih notları, fotoğraflar ve klinik anamnez formu — kapıdan girer girmez ekranda. Diş hekimi, estetik, masaj sektörleri için hazır soru setleriyle.',
    bullets: ['11 sektör için hazır anamnez', 'Fotoğraf galerisi (öncesi/sonrası)', 'Alerji ve tercih notları'],
    Visual: VisualCustomer,
  },
  {
    number: '03',
    title: 'Müşteri uyurken randevu alır',
    eyebrow: 'Online Rezervasyon Sayfası',
    body:
      'Markalı booking linkiniz Instagram bio\'da, Google profilinizde, QR kodda. Müşteri saat seçer, sistem onaylar, hatırlatır. Telefonu kapatın, salona bakın.',
    bullets: ['Markalı /book sayfası', 'Otomatik onay + hatırlatma', 'Depozito desteği (no-show önler)'],
    Visual: VisualBooking,
  },
  {
    number: '04',
    title: 'Kim ne kadar borçlu, anında',
    eyebrow: 'Paket, Bahşiş, Cari Hesap',
    body:
      'Kalan seans, ödenmemiş bakiye, bahşiş dağılımı, müşteri ve tedarikçi cari ekstresi — kafadan değil tek tıkla. Ay sonu "kim kime ne kaldı" kavgası yok.',
    bullets: ['Çoklu seans paketleri', 'Bahşiş kasası ve dağıtım', 'Müşteri + tedarikçi cari hesap'],
    Visual: VisualPackage,
  },
  {
    number: '05',
    title: 'Komisyonu sistem hesaplasın',
    eyebrow: 'Personel ve Komisyon',
    body:
      'Her personelin cirosu, hak edişi, izni otomatik. Esnek komisyon kuralları (yüzde, sabit, hizmet bazlı). Ay sonu 2 saat Excel yerine 2 dakika onaylama.',
    bullets: ['Hizmet bazlı esnek komisyon', 'Personel performans karnesi', 'İzin ve mesai takibi'],
    Visual: VisualStaff,
  },
  {
    number: '06',
    title: 'Kasa, banka, alış faturası — tek defterde',
    eyebrow: 'Finans Modülü',
    body:
      'Banka hesabı, kasa, POS, alış faturası, tedarikçi cari — birbirine bağlı çalışır. Bir faturayı kestiniz, stok düştü, tedarikçiye borç yazıldı, kasanız güncellendi.',
    bullets: ['Otomatik stok girişi', 'Banka-kasa virmanı', 'Mali müşavir raporu hazır'],
    Visual: VisualFinance,
  },
]

export function LandingFeatures() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mb-16 sm:mb-24"
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#6B48FF' }}>
            Tek panel, altı modül
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
            Defter, Excel ve sohbetlerin yerine bir şey koymak için tasarlandı.
          </h2>
        </motion.div>

        {/* Zig-zag feature rows */}
        <div className="space-y-24 sm:space-y-32">
          {FEATURES.map((f, i) => (
            <FeatureRow key={f.number} feature={f} reverse={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureRow({
  feature, reverse,
}: { feature: typeof FEATURES[number]; reverse: boolean }) {
  const Visual = feature.Visual
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${reverse ? 'lg:[direction:rtl]' : ''}`}
    >
      <div className="lg:[direction:ltr]">
        <p
          className="font-mono text-[12px] font-semibold tracking-[0.08em] mb-4"
          style={{ color: 'rgba(31,62,71,0.4)' }}
        >
          {feature.number} — {feature.eyebrow}
        </p>
        <h3
          className="font-semibold tracking-tight leading-[1.12]"
          style={{
            color: '#1F3E47',
            fontSize: 'clamp(24px, 2.6vw, 34px)',
            letterSpacing: '-0.02em',
            fontWeight: 560,
          }}
        >
          {feature.title}
        </h3>
        <p
          className="mt-4 text-[16px] sm:text-[17px] leading-[1.6]"
          style={{ color: 'rgba(31,62,71,0.65)' }}
        >
          {feature.body}
        </p>
        <ul className="mt-6 space-y-2.5">
          {feature.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-[15px]" style={{ color: 'rgba(31,62,71,0.78)' }}>
              <span
                className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: '#6B48FF' }}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:[direction:ltr] relative">
        <Visual />
      </div>
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Visual mini mockuplar
// ────────────────────────────────────────────────────────────────────

function VisualShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-4 rounded-3xl"
        style={{
          background: 'radial-gradient(60% 50% at 50% 50%, rgba(232,155,150,0.10) 0%, transparent 70%)',
        }}
      />
      <div
        className="relative rounded-2xl p-5 sm:p-6"
        style={{
          backgroundColor: 'white',
          border: '1px solid rgba(31,62,71,0.06)',
          boxShadow: '0 12px 40px -12px rgba(31,62,71,0.14), 0 4px 8px -4px rgba(31,62,71,0.06)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function VisualCalendar() {
  const slots = [
    { time: '09:00', name: 'Ayşe Y.', staff: 'Yağmur', color: '#6B48FF' },
    { time: '10:30', name: 'Esra D.', staff: 'Selin', color: '#E89B96' },
    { time: '11:00', name: 'Zeynep K.', staff: 'Yağmur', color: '#28A745' },
  ]
  return (
    <VisualShell>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: '#6B48FF' }} />
          <span className="text-[13px] font-semibold" style={{ color: '#1F3E47' }}>Bugün — 19 Mayıs</span>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(107,72,255,0.10)', color: '#6B48FF', fontWeight: 600 }}>
          3 randevu
        </span>
      </div>
      <div className="space-y-2">
        {slots.map((s) => (
          <div
            key={s.time}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            style={{ backgroundColor: '#FAFAFA', border: '1px solid rgba(31,62,71,0.04)' }}
          >
            <span className="w-1 h-8 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[12px] font-semibold w-12" style={{ color: '#1F3E47' }}>{s.time}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium" style={{ color: '#1F3E47' }}>{s.name}</p>
              <p className="text-[11px]" style={{ color: 'rgba(31,62,71,0.5)' }}>Personel: {s.staff}</p>
            </div>
          </div>
        ))}
      </div>
    </VisualShell>
  )
}

function VisualCustomer() {
  const questions = [
    { q: 'Alerji geçmişi', a: 'Yok' },
    { q: 'Düzenli ilaç kullanımı', a: 'Yok' },
    { q: 'Cilt tipi', a: 'Kuru / Hassas' },
    { q: 'Önceki bakım', a: '2 hafta önce — peeling' },
  ]
  return (
    <VisualShell>
      <div className="flex items-center gap-3 mb-4 pb-4 border-b" style={{ borderColor: 'rgba(31,62,71,0.06)' }}>
        <span
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[15px] font-bold"
          style={{ background: 'linear-gradient(135deg, #6B48FF, #E89B96)' }}
        >
          ZK
        </span>
        <div className="flex-1">
          <p className="text-[14px] font-semibold" style={{ color: '#1F3E47' }}>Zeynep Kara</p>
          <p className="text-[11px]" style={{ color: 'rgba(31,62,71,0.5)' }}>14 ziyaret · son 3 gün önce</p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'rgba(40,167,69,0.12)', color: '#28A745' }}>
          VIP
        </span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'rgba(31,62,71,0.5)' }}>
        Anamnez — Güzellik Merkezi
      </p>
      <div className="space-y-2">
        {questions.map((qa) => (
          <div key={qa.q} className="flex items-center justify-between gap-3 text-[12px]">
            <span style={{ color: 'rgba(31,62,71,0.65)' }}>{qa.q}</span>
            <span className="font-medium" style={{ color: '#1F3E47' }}>{qa.a}</span>
          </div>
        ))}
      </div>
    </VisualShell>
  )
}

function VisualBooking() {
  return (
    <VisualShell>
      <div className="flex items-center gap-2 mb-4">
        <Globe size={16} style={{ color: '#6B48FF' }} />
        <span
          className="text-[12px] font-mono"
          style={{ color: 'rgba(31,62,71,0.6)' }}
        >
          beautyos.com/book/<strong style={{ color: '#1F3E47' }}>guzellik-salonu</strong>
        </span>
      </div>
      <p className="text-[15px] font-semibold mb-1" style={{ color: '#1F3E47' }}>Müsait saatler</p>
      <p className="text-[11px] mb-4" style={{ color: 'rgba(31,62,71,0.5)' }}>Pazartesi, 25 Mayıs</p>
      <div className="grid grid-cols-4 gap-1.5">
        {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30'].map((t, i) => {
          const selected = t === '10:30'
          const disabled = i < 2
          return (
            <span
              key={t}
              className="text-center text-[12px] font-medium py-2 rounded-md"
              style={
                selected
                  ? { backgroundColor: '#6B48FF', color: 'white' }
                  : disabled
                  ? { backgroundColor: 'rgba(31,62,71,0.04)', color: 'rgba(31,62,71,0.3)', textDecoration: 'line-through' }
                  : { backgroundColor: 'rgba(31,62,71,0.04)', color: '#1F3E47' }
              }
            >
              {t}
            </span>
          )
        })}
      </div>
      <button
        className="mt-4 w-full py-2.5 rounded-lg text-[13px] font-medium text-white"
        style={{ backgroundColor: '#6B48FF' }}
      >
        Randevuyu Onayla
      </button>
    </VisualShell>
  )
}

function VisualPackage() {
  return (
    <VisualShell>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'rgba(31,62,71,0.5)' }}>
        Aktif Paketler — 3 müşteri
      </p>
      <div className="space-y-3">
        {[
          { name: 'Ayşe Y.', pack: '10 Seans Cilt Bakımı', used: 7, total: 10, color: '#28A745' },
          { name: 'Esra D.', pack: '6 Seans Lazer', used: 5, total: 6, color: '#E89B96' },
          { name: 'Zeynep K.', pack: '5 Seans Manikür', used: 2, total: 5, color: '#6B48FF' },
        ].map((p) => (
          <div key={p.name}>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <p className="text-[13px] font-medium" style={{ color: '#1F3E47' }}>{p.name}</p>
                <p className="text-[10px]" style={{ color: 'rgba(31,62,71,0.5)' }}>{p.pack}</p>
              </div>
              <span className="text-[12px] font-bold" style={{ color: '#1F3E47' }}>
                {p.used}/{p.total}
              </span>
            </div>
            <div className="h-1.5 rounded-full" style={{ backgroundColor: 'rgba(31,62,71,0.06)' }}>
              <div
                className="h-full rounded-full"
                style={{ backgroundColor: p.color, width: `${(p.used / p.total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </VisualShell>
  )
}

function VisualStaff() {
  return (
    <VisualShell>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'rgba(31,62,71,0.5)' }}>
        Bu Ay — Personel Performans
      </p>
      <div className="space-y-2.5">
        {[
          { name: 'Yağmur Demir', revenue: '₺18.420', commission: '₺3.684', percent: '20%', barColor: '#6B48FF' },
          { name: 'Selin Aksoy', revenue: '₺14.180', commission: '₺2.836', percent: '20%', barColor: '#E89B96' },
          { name: 'Berra Yılmaz', revenue: '₺9.860', commission: '₺1.972', percent: '20%', barColor: '#28A745' },
        ].map((s, i) => (
          <div key={s.name} className="flex items-center gap-3">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ backgroundColor: s.barColor }}
            >
              {s.name.split(' ').map((w) => w[0]).join('')}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-medium" style={{ color: '#1F3E47' }}>{s.name}</span>
                <span className="text-[12px] font-bold" style={{ color: '#1F3E47' }}>{s.revenue}</span>
              </div>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-[10px]" style={{ color: 'rgba(31,62,71,0.5)' }}>Komisyon ({s.percent})</span>
                <span className="text-[10px] font-medium" style={{ color: '#28A745' }}>+{s.commission}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </VisualShell>
  )
}

function VisualFinance() {
  return (
    <VisualShell>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold" style={{ color: '#1F3E47' }}>Mayıs Kasa Özeti</p>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(40,167,69,0.12)', color: '#28A745' }}>
          Pozitif
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <FinanceMini label="Gelir" value="₺48.6K" color="#28A745" />
        <FinanceMini label="Gider" value="₺12.4K" color="#D67D78" />
        <FinanceMini label="Net" value="₺36.2K" color="#1F3E47" />
      </div>
      <div className="space-y-1.5">
        {[
          { label: '🏦  Garanti İşletme', value: '₺28.4K' },
          { label: '💳  POS Hesabı', value: '₺18.6K' },
          { label: '💵  Ana Kasa', value: '₺4.2K' },
          { label: '⚠️  Tedarikçi Borç', value: '−₺2.8K', warn: true },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px]"
            style={{
              backgroundColor: row.warn ? 'rgba(214,125,120,0.06)' : 'rgba(31,62,71,0.03)',
            }}
          >
            <span style={{ color: 'rgba(31,62,71,0.7)' }}>{row.label}</span>
            <span className="font-semibold" style={{ color: row.warn ? '#D67D78' : '#1F3E47' }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </VisualShell>
  )
}

function FinanceMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(31,62,71,0.03)' }}>
      <p className="text-[9px] font-medium uppercase tracking-wide" style={{ color: 'rgba(31,62,71,0.5)' }}>{label}</p>
      <p className="text-[15px] font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  )
}
