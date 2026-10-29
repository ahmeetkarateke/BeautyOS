import { useSyncExternalStore } from 'react'
import { capitalizeTr, resolveTerm } from '@/content/terms'
import type { Me } from '@/lib/v2/me'
import type { NavItem } from '@/lib/v2/nav-config'

/** Menü bağlantısı bu adresteyse etkindir: tam eşleşme ya da alt yol (/musteriler/yeni). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Rolün ekranda görünen adı. Sahip ve uzman adı terim setinden gelir (Salon sahibi / Klinik sahibi, Uzman / Hekim). */
export function roleLabel(me: Me): string {
  const term = (key: 'owner' | 'expert') => capitalizeTr(resolveTerm(me.tenant.termSet, me.tenant.terms, key))
  switch (me.role) {
    case 'owner':
      return term('owner')
    case 'manager':
      return 'Müdür'
    case 'staff':
      return term('expert')
    case 'superadmin':
      return 'Sistem yönetimi'
  }
}

/** Alt ekranın başlığı: menüdeki öğe adı; menüde yoksa (hesabım gibi) verilen yedek. */
export function screenTitle(items: readonly NavItem[], pathname: string, fallback = 'BeautyOS'): string {
  return items.find((item) => isActivePath(pathname, item.href))?.label ?? fallback
}

const MANAGEMENT_KEY = 'bos.yonetim-acik'

// Depolama kapalıysa durum bu oturumda bellekte tutulur. Dış durum olduğu için useSyncExternalStore ile okunur:
// sunucu çizimi her zaman "açık"tır, tarayıcıda kayıtlı değer hidrasyondan sonra uygulanır.
let memoryOpen = true
const listeners = new Set<() => void>()

function readManagementOpen(): boolean {
  try {
    const stored = localStorage.getItem(MANAGEMENT_KEY)
    return stored === null ? memoryOpen : stored !== '0'
  } catch {
    return memoryOpen
  }
}

function writeManagementOpen(open: boolean) {
  try {
    localStorage.setItem(MANAGEMENT_KEY, open ? '1' : '0')
  } catch {
    // Hatırlanamaz ama bu oturumda çalışır.
    memoryOpen = open
  }
  listeners.forEach((listener) => listener())
}

const subscribeManagementOpen = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Yönetim grubunun açık/kapalı durumu bu tarayıcıda hatırlanır (tasarim.md §5). Varsayılan açık. */
export function useManagementOpen(): [boolean, () => void] {
  const open = useSyncExternalStore(subscribeManagementOpen, readManagementOpen, () => true)
  return [open, () => writeManagementOpen(!open)]
}
