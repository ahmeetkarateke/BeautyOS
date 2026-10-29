import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button, buttonClassName } from '@/ui/button'
import { BrandMark } from './brand-mark'

// Sistem ekranları (tasarim.md §8.6, metin-rehberi §4.6, §4.7, §4.10). Markalı, Türkçe, tek çıkış eylemi.
// HTTP numarası ve teknik terim görünmez. Referans numarası, API istek numarası üretimde dönene kadar gösterilmez.
// [DESTEK_E-POSTASI] yer tutucudur: kurucu destek adresini belirleyince tek yerden değişir.
export const SUPPORT_PLACEHOLDER = '[DESTEK_E-POSTASI]'

function SystemScreen({ label, title, text, children }: { label: string; title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-page px-5 py-6 md:px-12 md:py-8">
      <Link href="/" aria-label="BeautyOS ana sayfa" className="inline-flex w-fit items-center gap-2.5 text-text no-underline">
        <BrandMark />
        <span className="text-base font-semibold tracking-tight">BeautyOS</span>
      </Link>
      <main className="my-auto w-full max-w-[520px] py-12 md:mx-auto">
        <p className="text-sm font-medium text-accent-text">{label}</p>
        <h1 className="mt-2 text-balance text-2xl font-medium leading-tight tracking-tight md:text-[2.75rem]">{title}</h1>
        <p className="mt-3 max-w-[44ch] text-lg text-text-secondary">{text}</p>
        <div className="mt-7 flex flex-wrap gap-3">{children}</div>
      </main>
    </div>
  )
}

export function NotFoundScreen() {
  return (
    <SystemScreen label="Sayfa" title="Sayfa bulunamadı." text="Adres yanlış yazılmış ya da sayfa kaldırılmış olabilir.">
      <Link href="/" className={buttonClassName()}>
        Ana sayfaya dön
      </Link>
    </SystemScreen>
  )
}

export function ErrorScreen({ reset }: { reset: () => void }) {
  return (
    <SystemScreen
      label="Beklenmeyen sorun"
      title="Beklenmeyen bir sorun oluştu."
      text={`Sayfayı yenileyin. Sürerse destek ekibine yazın: ${SUPPORT_PLACEHOLDER}.`}
    >
      <Button onClick={reset}>Yeniden dene</Button>
    </SystemScreen>
  )
}

export function SessionExpiredScreen() {
  return (
    <SystemScreen label="Oturum" title="Oturumunuzun süresi doldu." text="Devam etmek için yeniden giriş yapın.">
      <Link href="/login" className={buttonClassName()}>
        Giriş yap
      </Link>
    </SystemScreen>
  )
}

export function AccountInactiveScreen() {
  return (
    <SystemScreen label="Hesap" title="Hesabınız şu an aktif değil." text="Giriş yapmak için işletme sahibiyle iletişime geçin.">
      <Link href="/login" className={buttonClassName({ variant: 'secondary' })}>
        Giriş ekranına dön
      </Link>
    </SystemScreen>
  )
}

/** Sunucuya ulaşılamadığında oturum açılışında gösterilir (bağlantı gelince kendiliğinden yeniden denenir). */
export function ConnectionLostScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <SystemScreen
      label="Bağlantı"
      title="Sunucuya ulaşılamadı."
      text="İnternet bağlantınızı kontrol edip yeniden deneyin. Bağlantı yokken yeni kayıt açılamaz."
    >
      <Button onClick={onRetry}>Yeniden dene</Button>
    </SystemScreen>
  )
}

/** Sayfa genel şerit (metin-rehberi §4.7). Çevrimdışı çalışma desteklenmez; metin bunu iddia etmez. */
export function OfflineBar() {
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(var(--size-bottombar)+12px+env(safe-area-inset-bottom))] z-(--z-toast) mx-auto grid max-w-[520px] gap-0.5 rounded-card border border-warning-border bg-warning-bg px-3.5 py-3 text-sm text-warning-text lg:bottom-3"
    >
      <strong>İnternet bağlantınız yok.</strong>
      <span>Bağlantı gelince yeniden denenir.</span>
    </div>
  )
}
