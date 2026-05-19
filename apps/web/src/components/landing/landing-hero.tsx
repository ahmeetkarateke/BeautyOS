'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Play, Check } from 'lucide-react'

const EASE_REVEAL = [0.16, 1, 0.3, 1] as const
const EASE_HOVER = [0.4, 0, 0.2, 1] as const

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-32 md:pt-36 pb-16 sm:pb-20 md:pb-28">
      {/* Soft radial accent — sıcak butik dokunuş, çok subtle */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 50% at 25% 30%, rgba(232,155,150,0.10) 0%, rgba(232,155,150,0) 60%), radial-gradient(60% 40% at 80% 60%, rgba(107,72,255,0.06) 0%, rgba(107,72,255,0) 50%)',
        }}
      />

      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center relative">
        {/* SOL: Metin */}
        <div className="relative z-10 max-w-[640px]">
          {/* Üst rozet */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_REVEAL }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-7 text-[12px] font-medium"
            style={{
              backgroundColor: 'rgba(232,155,150,0.14)',
              color: '#A45F5A',
              border: '1px solid rgba(232,155,150,0.28)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: '#D67D78' }}
            />
            Türkiye merkezli, KVKK uyumlu yönetim platformu
          </motion.div>

          {/* H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_REVEAL, delay: 0.08 }}
            className="font-semibold tracking-tight leading-[1.05]"
            style={{
              color: '#1F3E47',
              fontSize: 'clamp(40px, 5.4vw, 72px)',
              letterSpacing: '-0.025em',
              fontWeight: 560,
            }}
          >
            Salon ve klinikler için{' '}
            <span className="relative inline-block" style={{ color: '#D67D78' }}>
              kişiselleştirilebilir
              <svg
                aria-hidden
                viewBox="0 0 640 14"
                preserveAspectRatio="none"
                className="absolute left-0 -bottom-2 w-full"
                style={{ height: '0.5em' }}
              >
                <motion.path
                  d="M 4 9 Q 160 2 320 7 T 636 6"
                  fill="none"
                  stroke="#E89B96"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.0, ease: EASE_REVEAL, delay: 0.55 }}
                />
              </svg>
            </span>{' '}
            yönetim platformu.
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE_REVEAL, delay: 0.18 }}
            className="mt-7 text-[17px] sm:text-[19px] leading-[1.55]"
            style={{ color: 'rgba(31,62,71,0.68)', maxWidth: '54ch' }}
          >
            Randevu yönetimi, müşteri kayıt sistemi, klinik anamnezi, paket
            satışı, kasa ve cari hesap takibi tek bir platformda. Türkiye'deki
            işletmelerin operasyonel ihtiyaçlarına özel olarak geliştirilmiştir.
          </motion.p>

          {/* CTA Row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_REVEAL, delay: 0.28 }}
            className="mt-9 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center"
          >
            <PrimaryCTA href="/signup">
              Ücretsiz Deneyin
              <ArrowRight size={16} className="ml-0.5" />
            </PrimaryCTA>
            <SecondaryCTA href="#demo">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(31,62,71,0.08)' }}
              >
                <Play size={11} fill="#1F3E47" stroke="#1F3E47" className="ml-0.5" />
              </span>
              Tanıtım Videosu
              <span className="text-[12px] font-normal" style={{ color: 'rgba(31,62,71,0.5)' }}>
                2 dakika
              </span>
            </SecondaryCTA>
          </motion.div>

          {/* Trust microbar */}
          <motion.ul
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_REVEAL, delay: 0.4 }}
            className="mt-7 flex flex-wrap gap-x-6 gap-y-2.5 text-[13px]"
            style={{ color: 'rgba(31,62,71,0.6)' }}
          >
            {[
              'Kredi kartı bilgisi talep edilmez',
              '30 gün ücretsiz deneme',
              'KVKK uyumludur',
              'İstediğiniz zaman iptal edebilirsiniz',
            ].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check size={14} style={{ color: '#28A745' }} strokeWidth={2.5} />
                <span>{t}</span>
              </li>
            ))}
          </motion.ul>
        </div>

        {/* SAĞ: Dashboard Mockup */}
        <div className="relative hidden lg:block lg:-mr-24 xl:-mr-32">
          <DashboardMockup />
        </div>
      </div>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────
// CTAs
// ────────────────────────────────────────────────────────────────────

function PrimaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center justify-center gap-1.5 px-5 sm:px-6 h-12 sm:h-[52px] rounded-lg font-medium text-[15px] sm:text-[16px] text-white transition-all"
      style={{
        backgroundColor: '#6B48FF',
        boxShadow: '0 1px 2px rgba(31,62,71,0.06), inset 0 1px 0 rgba(255,255,255,0.15)',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        transitionDuration: '180ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#5A3CFB'
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow =
          '0 8px 24px -8px rgba(107,72,255,0.45), inset 0 1px 0 rgba(255,255,255,0.18)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#6B48FF'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow =
          '0 1px 2px rgba(31,62,71,0.06), inset 0 1px 0 rgba(255,255,255,0.15)'
      }}
    >
      {children}
    </Link>
  )
}

function SecondaryCTA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2.5 px-3 sm:px-4 h-12 sm:h-[52px] rounded-lg font-medium text-[15px] sm:text-[16px] transition-colors"
      style={{
        color: '#1F3E47',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        transitionDuration: '180ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(31,62,71,0.04)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      {children}
    </Link>
  )
}

// ────────────────────────────────────────────────────────────────────
// Dashboard Mockup — gerçek BeautyOS UI'ı temsil ediyor
// ────────────────────────────────────────────────────────────────────

function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: -2 }}
      transition={{ duration: 0.9, ease: EASE_REVEAL, delay: 0.3 }}
      className="relative"
      style={{ perspective: '1000px' }}
    >
      {/* Arka plan dekoratif kart */}
      <div
        aria-hidden
        className="absolute -right-8 -top-6 w-72 h-56 rounded-2xl"
        style={{
          backgroundColor: 'rgba(232,155,150,0.18)',
          transform: 'rotate(6deg)',
        }}
      />

      {/* Ana dashboard kart */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'white',
          boxShadow:
            '0 24px 80px -24px rgba(31,62,71,0.25), 0 8px 16px -8px rgba(31,62,71,0.08)',
          border: '1px solid rgba(31,62,71,0.06)',
          width: '560px',
          maxWidth: 'calc(100vw - 100px)',
        }}
      >
        {/* Browser chrome */}
        <div
          className="px-4 py-3 flex items-center gap-2 border-b"
          style={{ borderColor: 'rgba(31,62,71,0.06)', backgroundColor: '#FAFAFA' }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FF5F57' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FFBD2E' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#28C940' }} />
          <div
            className="ml-3 px-3 py-1 rounded-md text-[11px] flex-1"
            style={{
              backgroundColor: 'white',
              color: 'rgba(31,62,71,0.5)',
              border: '1px solid rgba(31,62,71,0.06)',
            }}
          >
            app.beautyos.com/dashboard
          </div>
        </div>

        {/* Dashboard içeriği */}
        <div className="p-5 grid grid-cols-2 gap-3">
          {/* KPI cards */}
          <KPICard
            label="Bugünün Geliri"
            value="₺4.280"
            trend="+%18"
            color="#6B48FF"
            bgColor="rgba(107,72,255,0.08)"
            delay={0.7}
          />
          <KPICard
            label="Randevu"
            value="12"
            sub="bugün"
            color="#1F3E47"
            bgColor="rgba(31,62,71,0.06)"
            delay={0.8}
          />

          {/* Takvim mini */}
          <div
            className="col-span-2 rounded-xl p-3.5"
            style={{
              backgroundColor: '#FAFAFA',
              border: '1px solid rgba(31,62,71,0.05)',
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(31,62,71,0.5)' }}>
                Günlük Randevular
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: 'rgba(40,167,69,0.12)', color: '#28A745' }}
              >
                3 aktif
              </span>
            </div>
            <div className="space-y-1.5">
              <AppointmentRow time="10:30" name="Ayşe Yılmaz" service="Saç Kesim + Boya" color="#6B48FF" delay={0.9} />
              <AppointmentRow time="12:00" name="Zeynep K." service="Manikür" color="#E89B96" delay={1.0} />
              <AppointmentRow time="14:15" name="Esra D." service="Cilt Bakımı" color="#28A745" delay={1.1} />
            </div>
          </div>

          {/* Mini sektör chip */}
          <div
            className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              backgroundColor: 'rgba(107,72,255,0.05)',
              border: '1px solid rgba(107,72,255,0.12)',
            }}
          >
            <span className="text-[11px] font-medium" style={{ color: '#6B48FF' }}>
              ●
            </span>
            <span className="text-[11px]" style={{ color: 'rgba(31,62,71,0.7)' }}>
              <strong style={{ color: '#1F3E47' }}>Aktif seans:</strong> Personel ve müşteri eşleştirmesi · <strong>Kalan süre: 12 dk</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Yan floating card — paket bakiye */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_REVEAL, delay: 1.2 }}
        className="absolute -left-12 top-1/2 -translate-y-1/2 hidden xl:block"
      >
        <div
          className="rounded-xl p-3.5"
          style={{
            backgroundColor: 'white',
            border: '1px solid rgba(31,62,71,0.06)',
            boxShadow: '0 12px 32px -12px rgba(31,62,71,0.18)',
            width: '220px',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold text-white"
              style={{ backgroundColor: '#E89B96' }}
            >
              MP
            </span>
            <div>
              <p className="text-[12px] font-semibold leading-tight" style={{ color: '#1F3E47' }}>
                Müşteri Paketi
              </p>
              <p className="text-[10px]" style={{ color: 'rgba(31,62,71,0.5)' }}>
                10 seanslık abonelik
              </p>
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'rgba(31,62,71,0.5)' }}>
                Kalan
              </p>
              <p className="text-[18px] font-bold" style={{ color: '#1F3E47' }}>
                7 / 10
              </p>
            </div>
            <div
              className="px-2 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: 'rgba(40,167,69,0.12)', color: '#28A745' }}
            >
              Aktif
            </div>
          </div>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(31,62,71,0.06)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '70%' }}
              transition={{ duration: 1.2, ease: EASE_REVEAL, delay: 1.4 }}
              className="h-full rounded-full"
              style={{ backgroundColor: '#28A745' }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function KPICard({
  label, value, sub, trend, color, bgColor, delay,
}: {
  label: string; value: string; sub?: string; trend?: string; color: string; bgColor: string; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_HOVER, delay }}
      className="rounded-xl p-3.5"
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${color}1A`,
      }}
    >
      <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'rgba(31,62,71,0.55)' }}>
        {label}
      </p>
      <p className="mt-1 text-[20px] font-bold tracking-tight" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(31,62,71,0.55)' }}>
        {trend ? <span style={{ color: '#28A745', fontWeight: 600 }}>{trend}</span> : sub}
        {trend && ' dün'}
      </p>
    </motion.div>
  )
}

function AppointmentRow({
  time, name, service, color, delay,
}: { time: string; name: string; service: string; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: EASE_HOVER, delay }}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
      style={{ backgroundColor: 'white' }}
    >
      <span className="w-1 h-7 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] font-semibold w-10" style={{ color: '#1F3E47' }}>
        {time}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium truncate" style={{ color: '#1F3E47' }}>
          {name}
        </p>
        <p className="text-[10px] truncate" style={{ color: 'rgba(31,62,71,0.5)' }}>
          {service}
        </p>
      </div>
    </motion.div>
  )
}
