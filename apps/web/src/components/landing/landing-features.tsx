'use client'

import { motion } from 'framer-motion'
import {
  Calendar, Users, Globe, Package, Wallet, Banknote,
  ClipboardList, Phone, MapPin, Sparkles, Award, AlertTriangle, TrendingDown,
} from 'lucide-react'

const FEATURES = [
  {
    number: '01',
    title: 'Akıllı randevu yönetimi',
    eyebrow: 'Randevu',
    body:
      'Tüm personel takvimi tek ekranda. Yapay zeka çakışma riskini tespit eder, sürükle-bırak ile saniyeler içinde yeniden planlanır.',
    bullets: [
      'Renk kodlu personel takvimi',
      'Yapay zeka destekli çakışma kontrolü',
      'Koltuk, oda ve cihaz takibi',
    ],
    Visual: VisualCalendar,
  },
  {
    number: '02',
    title: 'Kişiselleştirilebilir müşteri kartı',
    eyebrow: 'Müşteri & Anamnez',
    body:
      'Geçmiş işlem, alerji, fotoğraf ve klinik anamnez tek yerde. Sektörünüze göre özelleştirilebilir form şablonları hazır gelir.',
    bullets: [
      'Birçok sektör için hazır anamnez şablonu',
      'Sınırsız özel soru ekleme',
      'Öncesi/sonrası görsel arşivi',
    ],
    Visual: VisualCustomer,
  },
  {
    number: '03',
    title: 'Online rezervasyon sayfası',
    eyebrow: 'Çevrim İçi Rezervasyon',
    body:
      'Markalı rezervasyon linkiniz Instagram bio, Google profil ve QR kodlarda kullanılabilir. Onay ve hatırlatma otomatik.',
    bullets: [
      'İşletmeye özel marka sayfası',
      'Otomatik onay ve hatırlatma',
      'Opsiyonel depozito ile no-show koruması',
    ],
    Visual: VisualBooking,
  },
  {
    number: '04',
    title: 'Akıllı stok yönetimi',
    eyebrow: 'Stok & Tedarik',
    body:
      'Ürün stoğunu gerçek zamanlı izleyin. Eşik altına düşen ürünler anında bildirim olarak gelir; alış faturasıyla stok otomatik güncellenir.',
    bullets: [
      'Düşük stok için otomatik bildirim',
      'Alış faturasıyla otomatik stok girişi',
      'Hizmet bazlı malzeme tüketim takibi',
    ],
    Visual: VisualStock,
  },
  {
    number: '05',
    title: 'Personel ve komisyon',
    eyebrow: 'İnsan Kaynakları',
    body:
      'Komisyon kuralları kişiselleştirilebilir: yüzde, sabit veya hizmet bazlı. Hak ediş ve raporlar otomatik hesaplanır.',
    bullets: [
      'Esnek komisyon kuralları',
      'Personel performans karnesi',
      'İzin ve mesai yönetimi',
    ],
    Visual: VisualStaff,
  },
  {
    number: '06',
    title: 'Entegre finans yönetimi',
    eyebrow: 'Finans',
    body:
      'Kasa, banka, POS ve alış faturaları birbirine bağlı. Fatura kesildiğinde stok ve cari otomatik güncellenir.',
    bullets: [
      'Otomatik stok ve cari entegrasyonu',
      'Banka-kasa virmanı',
      'Mali müşavir uyumlu raporlar',
    ],
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
            Çözümler
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
            İşletmenize özel göre kişiselleştirilebilir, yapay zeka destekli teknolojik çözümler.
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
    { time: '09:00', name: 'A. Yılmaz',  staff: 'Personel 1', color: '#6B48FF' },
    { time: '10:30', name: 'E. Demir',   staff: 'Personel 2', color: '#E89B96' },
    { time: '11:00', name: 'Z. Kaya',    staff: 'Personel 1', color: '#28A745' },
  ]
  return (
    <VisualShell>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: '#6B48FF' }} />
          <span className="text-[13px] font-semibold" style={{ color: '#1F3E47' }}>Günlük randevu listesi</span>
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
    { q: 'Alerji geçmişi',         a: 'Bildirilmedi' },
    { q: 'Düzenli ilaç kullanımı', a: 'Bildirilmedi' },
    { q: 'Cilt tipi',              a: 'Kuru / Hassas' },
    { q: 'Önceki uygulama',        a: '2 hafta önce — peeling' },
  ]
  return (
    <VisualShell>
      <div className="flex items-center gap-3 mb-4 pb-4 border-b" style={{ borderColor: 'rgba(31,62,71,0.06)' }}>
        <span
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[15px] font-bold"
          style={{ background: 'linear-gradient(135deg, #6B48FF, #E89B96)' }}
        >
          MK
        </span>
        <div className="flex-1">
          <p className="text-[14px] font-semibold" style={{ color: '#1F3E47' }}>Müşteri Kaydı</p>
          <p className="text-[11px]" style={{ color: 'rgba(31,62,71,0.5)' }}>14 ziyaret · son ziyaret 3 gün önce</p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'rgba(40,167,69,0.12)', color: '#28A745' }}>
          Sadık Müşteri
        </span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'rgba(31,62,71,0.5)' }}>
        Anamnez Formu — Güzellik Merkezi
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

function VisualStock() {
  const items = [
    { name: 'Saç Boyası 6.0',     unit: 'tüp',  current: 24, threshold: 10, color: '#28A745' },
    { name: 'Şampuan 1L',         unit: 'şişe', current: 4,  threshold: 8,  color: '#D67D78', low: true },
    { name: 'Tek Kullanımlık Eldiven', unit: 'kutu', current: 12, threshold: 5,  color: '#28A745' },
    { name: 'Oje 015',            unit: 'şişe', current: 2,  threshold: 6,  color: '#D67D78', low: true },
    { name: 'Aseton 500ml',       unit: 'şişe', current: 9,  threshold: 4,  color: '#6B48FF' },
  ]
  const lowCount = items.filter((i) => i.low).length
  return (
    <VisualShell>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package size={16} style={{ color: '#6B48FF' }} />
          <span className="text-[13px] font-semibold" style={{ color: '#1F3E47' }}>Stok Durumu</span>
        </div>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(214,125,120,0.14)', color: '#D67D78' }}
        >
          <AlertTriangle size={11} strokeWidth={2.4} />
          {lowCount} düşük stok
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const percent = Math.min(100, Math.round((item.current / Math.max(item.threshold * 2, 1)) * 100))
          return (
            <div
              key={item.name}
              className="rounded-lg px-3 py-2"
              style={{
                backgroundColor: item.low ? 'rgba(214,125,120,0.06)' : 'rgba(31,62,71,0.025)',
                border: item.low ? '1px solid rgba(214,125,120,0.18)' : '1px solid rgba(31,62,71,0.04)',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {item.low && <TrendingDown size={11} style={{ color: '#D67D78' }} strokeWidth={2.4} />}
                  <p className="text-[12px] font-medium truncate" style={{ color: '#1F3E47' }}>{item.name}</p>
                </div>
                <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: item.low ? '#D67D78' : '#1F3E47' }}>
                  {item.current} {item.unit}
                </span>
              </div>
              <div className="h-1 rounded-full" style={{ backgroundColor: 'rgba(31,62,71,0.06)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ backgroundColor: item.color, width: `${percent}%` }}
                />
              </div>
              {item.low && (
                <p className="text-[10px] mt-1" style={{ color: '#D67D78' }}>
                  Eşik altı ({item.threshold} {item.unit}) — sipariş önerilir
                </p>
              )}
            </div>
          )
        })}
      </div>
    </VisualShell>
  )
}

function VisualStaff() {
  return (
    <VisualShell>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'rgba(31,62,71,0.5)' }}>
        Aylık Personel Performans Raporu
      </p>
      <div className="space-y-2.5">
        {[
          { name: 'Personel 1', revenue: '₺18.420', commission: '₺3.684', percent: '20%', barColor: '#6B48FF' },
          { name: 'Personel 2', revenue: '₺14.180', commission: '₺2.836', percent: '20%', barColor: '#E89B96' },
          { name: 'Personel 3', revenue: '₺9.860',  commission: '₺1.972', percent: '20%', barColor: '#28A745' },
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
        <p className="text-[13px] font-semibold" style={{ color: '#1F3E47' }}>Aylık Finansal Özet</p>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(40,167,69,0.12)', color: '#28A745' }}>
          Pozitif bakiye
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <FinanceMini label="Toplam Gelir" value="₺48.6K" color="#28A745" />
        <FinanceMini label="Toplam Gider" value="₺12.4K" color="#D67D78" />
        <FinanceMini label="Net Sonuç"    value="₺36.2K" color="#1F3E47" />
      </div>
      <div className="space-y-1.5">
        {[
          { label: 'Banka Hesabı',      value: '₺28.4K' },
          { label: 'POS Hesabı',         value: '₺18.6K' },
          { label: 'Kasa',               value: '₺4.2K' },
          { label: 'Tedarikçi Bakiyesi', value: '−₺2.8K', warn: true },
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
