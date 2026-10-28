import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'

// UI-DoD genişlikleri: telefon, tablet, masaüstü.
export const GENISLIKLER = [
  { ad: '390', width: 390, height: 844 },
  { ad: '768', width: 768, height: 1024 },
  { ad: '1440', width: 1440, height: 900 },
] as const

// Bir sayfanın üç genişlikteki ekran görüntüsünü <E2E_SHOT_DIR>/<ad>-<genişlik>.png yazar.
// Görsel eşdeğerlik karşılaştırması (W1-K4) bu çıktılarla elle/ayrı araçla yapılır.
export async function ucGenislikteCek(page: Page, ad: string) {
  const dizin = process.env.E2E_SHOT_DIR ?? 'e2e/.ekran'
  mkdirSync(dizin, { recursive: true })
  for (const g of GENISLIKLER) {
    await page.setViewportSize({ width: g.width, height: g.height })
    await page.screenshot({ path: path.join(dizin, `${ad}-${g.ad}.png`), fullPage: true })
  }
}
