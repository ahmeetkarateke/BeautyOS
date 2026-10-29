import { expect, test } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../yardimcilar/axe'
import { GENISLIKLER, ucGenislikteCek } from '../yardimcilar/ekran-goruntusu'

// W3/W4 kabul testi: /v2/tasarim-sistemi vitrini (yalnız staging; NEXT_PUBLIC_UI_V2_SHOWCASE=1 ile derlenir).
//   E2E_UI_V2_SHOWCASE=1 olmayan derlemede vitrin 404 olmalıdır (canlı güvencesi).
const VITRIN_ACIK = (process.env.E2E_UI_V2_SHOWCASE ?? '').trim() === '1'
const YOL = '/v2/tasarim-sistemi'

test.describe('vitrin kapalı derleme', () => {
  test.skip(VITRIN_ACIK, 'yalnız vitrin bayrağı kapalı derlemede')

  test('W4: vitrin bayrağı yokken sayfa 404 verir', async ({ request }) => {
    const yanit = await request.get(YOL, { maxRedirects: 0, failOnStatusCode: false })
    expect(yanit.status()).toBe(404)
  })
})

test.describe('vitrin açık derleme', () => {
  test.skip(!VITRIN_ACIK, 'yalnız vitrin bayrağı açık derlemede')

  let konsolHatalari: string[]

  test.beforeEach(async ({ page }) => {
    konsolHatalari = []
    page.on('console', (m) => {
      if (m.type() === 'error') konsolHatalari.push(m.text())
    })
    page.on('pageerror', (e) => konsolHatalari.push(`pageerror: ${e.message}`))
    await page.goto(YOL)
    await expect(page.getByRole('heading', { level: 1, name: 'Tasarım sistemi' })).toBeVisible()
  })

  test.afterEach(() => {
    expect(konsolHatalari, 'konsol hataları').toEqual([])
  })

  for (const g of GENISLIKLER) {
    test(`W3/W4 UI-DoD: ${g.ad} px axe ciddi ihlal yok, yatay taşma yok`, async ({ page }) => {
      await page.setViewportSize({ width: g.width, height: g.height })
      await expectNoSeriousA11yViolations(page, `${g.ad} px`)
      const tasma = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(tasma, 'yatay taşma (px)').toBeLessThanOrEqual(0)
    })
  }

  test('W4: üç genişlikte ekran görüntüsü alınır', async ({ page }) => {
    await ucGenislikteCek(page, 'vitrin')
  })

  test('W3: yükleniyor düğmesi aria-busy taşır ve tıklanamaz', async ({ page }) => {
    const dugme = page.getByRole('button', { name: /Kaydediliyor/ })
    await expect(dugme).toHaveAttribute('aria-busy', 'true')
    await expect(dugme).toBeDisabled().catch(async () => {
      // Devre dışı yerine aria-disabled kullanılıyorsa onu kabul et (odak kaybı olmasın diye).
      await expect(dugme).toHaveAttribute('aria-disabled', 'true')
    })
  })

  test('W3: geri alınabilir bildirim durum bölgesinde görünür ve Geri al düğmesi var', async ({ page }) => {
    await page.getByRole('button', { name: 'Geri alınabilir bildirim' }).click()
    await expect(page.getByText('Müşteri silindi.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Geri al/ })).toBeVisible()
  })

  test('W4: alt sayfa/diyalog: açılır, Esc kapatır, odak tetikleyiciye döner', async ({ page }) => {
    const tetik = page.getByRole('button', { name: 'Alt sayfa / diyalog aç' })
    await tetik.click()
    const diyalog = page.getByRole('dialog', { name: 'Yeni randevu' })
    await expect(diyalog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(diyalog).toBeHidden()
    await expect(tetik).toBeFocused()
  })

  test('W4: 390 px telefonda alt sayfa dibe yaslı ve tam genişlik; 1440 px masaüstünde ortalı diyalog', async ({ page }) => {
    const tetik = page.getByRole('button', { name: 'Alt sayfa / diyalog aç' })
    const ac = async () => {
      await tetik.click()
      const d = page.getByRole('dialog', { name: 'Yeni randevu' })
      await expect(d).toBeVisible()
      const kutu = await d.boundingBox()
      await page.keyboard.press('Escape')
      await expect(d).toBeHidden()
      return kutu
    }
    await page.setViewportSize({ width: 390, height: 844 })
    const tel = await ac()
    expect(tel, 'telefon kutusu').not.toBeNull()
    expect(Math.round(tel!.width), 'telefonda tam genişlik').toBe(390)
    expect(Math.round(tel!.y + tel!.height), 'telefonda dibe yaslı').toBe(844)

    await page.setViewportSize({ width: 1440, height: 900 })
    const mas = await ac()
    expect(mas!.width, 'masaüstünde diyalog dar').toBeLessThan(900)
    expect(Math.round(mas!.x + mas!.width / 2), 'yatayda ortalı').toBeGreaterThan(700)
    expect(Math.round(mas!.x + mas!.width / 2)).toBeLessThan(740)
  })

  test('W4: onay penceresi eylem adını taşır, Esc onaylamadan kapatır', async ({ page }) => {
    const tetik = page.getByRole('button', { name: 'Onay penceresi aç' })
    await tetik.click()
    const d = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: /silmek istiyor musunuz/ }))
    await expect(d).toBeVisible()
    await expect(d.getByRole('button', { name: 'Müşteriyi sil' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
    await expect(tetik).toBeFocused()
  })

  test('W4: açılır menü klavye ile açılır, oklarla gezilir, Esc kapatır', async ({ page }) => {
    const tetik = page.locator('[aria-haspopup="menu"]').first()
    await tetik.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(tetik).toBeFocused()
  })

  test('W4: sekmeler ok tuşuyla değişir', async ({ page }) => {
    const ilk = page.getByRole('tab', { name: 'Bilgiler' })
    await ilk.focus()
    await expect(ilk).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: 'Randevular' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Randevular burada.')).toBeVisible()
  })

  test('W4: veri tablosu 640 px altında satıra döner (veriler görünür), üstünde sütun başlıkları vardır', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.getByRole('columnheader', { name: 'Müşteri' })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByText('Ayşe Yılmaz').first()).toBeVisible()
    await expect(page.getByText('Saç boyama').first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Müşteri' })).toBeHidden()
  })

  test('W3: tutar ve tarih Türkçe biçimde (₺ ve nokta binlik, virgül ondalık)', async ({ page }) => {
    await expect(page.getByText(/₺\s?1\.250,50/).first()).toBeVisible()
  })

  test('W3: sayfa Türkçe lang ve odak halkı klavyeyle görünür', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
    await page.keyboard.press('Tab')
    const halka = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null
      if (!e) return null
      const s = getComputedStyle(e)
      return { outline: s.outlineStyle, ow: s.outlineWidth, shadow: s.boxShadow }
    })
    expect(halka, 'odaklı öğe').not.toBeNull()
    const gorunur = halka!.outline !== 'none' && halka!.ow !== '0px'
    expect(gorunur || halka!.shadow !== 'none', 'odak halkı').toBe(true)
  })
})

