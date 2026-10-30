import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test'

// Yeni panel (v2) görsel kabul testlerinin ortak yardımcıları (W6, W10, W11).
// Yenileme çerezi SameSite=Lax'tır: web ve API aynı kayıtlı alanda olmalıdır (E2E_ALAN=bostest.test, bkz. tests/sunucu/e2e-test.sh).

export const PANEL_ACIK = (process.env.E2E_UI_V2 ?? '')
  .toLowerCase()
  .split(',')
  .map((p) => p.trim())
  .includes('panel')

/** Web adresi tek etiketli ana bilgisayarsa (web) çerez çapraz-site sayılır ve panel oturumu açılamaz. */
export function ayniSiteHazir(): boolean {
  const adres = process.env.E2E_BASE_URL
  return Boolean(adres) && new URL(adres as string).hostname.includes('.')
}

export const ATLAMA_NEDENI = 'panel yüzeyi açık (E2E_UI_V2=panel) ve aynı-site adları (E2E_ALAN=bostest.test) gerekir'

export interface Oturum {
  context: BrowserContext
  page: Page
  konsol: string[]
  /** Tarayıcının attığı istek adresleri (kiracı sızıntısı denetimi için). */
  istekler: string[]
}

// Bir testin birden çok adımı tek tarayıcı bağlamını paylaşır: yenileme çerezi dönen (rotating) olduğundan
// bağlam yeniden kullanılırken eski çerez tekrar gönderilmez; ayrıca /auth hız sınırı (15 dk'da 10) bütçesini korur.
export async function yeniOturum(browser: Browser, baseURL: string): Promise<Oturum> {
  const context = await browser.newContext({
    baseURL,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    viewport: { width: 390, height: 844 },
  })
  const page = await context.newPage()
  const konsol: string[] = []
  const istekler: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') konsol.push(m.text())
  })
  page.on('pageerror', (e) => konsol.push(`pageerror: ${e.message}`))
  page.on('request', (r) => istekler.push(r.url()))
  return { context, page, konsol, istekler }
}

export async function girisYap(page: Page, email: string, password: string, hedef: RegExp): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('ornek@salon.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: /Giriş Yap/ }).click()
  await page.waitForURL(hedef)
}

/**
 * Ekrandaki hata bandı (role=alert). Next'in görünmez yol duyurucusu (#__next-route-announcer__) da role=alert taşır;
 * `getByRole('alert').first()` onu yakalar ve bekleme gerçek bant gelmeden geçer (H1). Bu yüzden duyurucu hariç tutulur.
 */
export function hataBandi(page: Page): Locator {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)').first()
}

/** Belge genişliği pencereyi aşıyorsa pozitif (px). */
export async function yatayTasma(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
}

export async function ekranGoruntusu(page: Page, ad: string): Promise<string> {
  const dizin = process.env.E2E_SHOT_DIR ?? 'e2e/.ekran'
  mkdirSync(dizin, { recursive: true })
  const yol = path.join(dizin, `${ad}.png`)
  await page.screenshot({ path: yol, fullPage: true })
  return yol
}

export interface OdakOlcumu {
  /** Odaktaki öğenin kısa tanımı (etiket + metin). */
  oge: string
  /** Menü ekranındaki bir satır (main içindeki liste bağlantısı) mı? */
  menuSatiri: boolean
  /** Çıkış düğmesi mi (menü listesinin sonu)? */
  cikis: boolean
  /** Halka çizilir mi: outline stili var, genişlik > 0, renk saydam değil (ya da gölge halkası var). */
  gorunur: boolean
  /** Halkanın dış kenarı bir kırpan atanın (overflow != visible) dışına taşıyorsa o atanın tanımı. */
  kirpilan: string | null
}

// Tab ile odaklanan öğenin odak halkasının gerçekten görünür olduğunu ölçer: yalnız `outline` tanımlı olması yetmez,
// kırpan bir ata (overflow: hidden) halkayı kesiyorsa kullanıcı onu görmez (W6-1 Kritik 1).
export async function odakHalkasiOlc(page: Page): Promise<OdakOlcumu> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return { oge: '(gövde)', menuSatiri: false, cikis: false, gorunur: false, kirpilan: null }
    const cs = getComputedStyle(el)
    const genislik = parseFloat(cs.outlineWidth) || 0
    const kayma = parseFloat(cs.outlineOffset) || 0
    const saydam = /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(cs.outlineColor)
    const gorunur = (cs.outlineStyle !== 'none' && genislik > 0 && !saydam) || (cs.boxShadow !== 'none' && cs.boxShadow !== '')
    const dis = Math.max(kayma + genislik, 0)
    const r = el.getBoundingClientRect()
    const kutu = { sol: r.left - dis, ust: r.top - dis, sag: r.right + dis, alt: r.bottom + dis }
    let kirpilan: string | null = null
    for (let ata = el.parentElement; ata && !kirpilan; ata = ata.parentElement) {
      const s = getComputedStyle(ata)
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
      const ar = ata.getBoundingClientRect()
      const sol = ar.left + ata.clientLeft
      const ust = ar.top + ata.clientTop
      const sag = sol + ata.clientWidth
      const alt = ust + ata.clientHeight
      if (kutu.sol < sol - 0.5 || kutu.ust < ust - 0.5 || kutu.sag > sag + 0.5 || kutu.alt > alt + 0.5) {
        kirpilan = `${ata.tagName.toLowerCase()} overflow=${s.overflowX}/${s.overflowY}`
      }
    }
    const metin = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
    return {
      oge: `${el.tagName.toLowerCase()} "${metin}"`,
      menuSatiri: el.tagName === 'A' && Boolean(el.closest('main ul')),
      cikis: el.tagName === 'BUTTON' && Boolean(el.closest('main')) && /Çıkış yap/.test(el.textContent ?? ''),
      gorunur,
      kirpilan,
    }
  })
}

export async function genislikAyarla(page: Page, genislik: number, yukseklik: number): Promise<void> {
  await page.setViewportSize({ width: genislik, height: yukseklik })
  // Düzen değişimini (lg: eşiği) sabit bekleme yerine ölçüm kararlı olana dek bekle.
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(genislik)
}
