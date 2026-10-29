import { expect, test } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../yardimcilar/axe'
import { kiraciKur, type TestKiraci } from '../yardimcilar/api'
import {
  ATLAMA_NEDENI,
  PANEL_ACIK,
  ayniSiteHazir,
  ekranGoruntusu,
  genislikAyarla,
  girisYap,
  odakHalkasiOlc,
  yatayTasma,
  yeniOturum,
  type Oturum,
} from '../yardimcilar/panel'

// W6 görsel kabul (kodlama-plani W6 K1, K4, K6 + UI-DoD): uygulama kabuğu gerçek tarayıcıda.
// Bütçe: tek API sürecinde /auth 15 dk'da 10 istek, kayıt saatte 5, giriş 15 dk'da 5. Bu dosya 2 kayıt + 1 giriş +
// her tam sayfa yüklemesinde 1 yenileme harcar; bu yüzden testler seri ve tek tarayıcı bağlamını paylaşır, sayfalar arası
// geçişte (kabuk içinde) tam yükleme yapılmaz.
test.skip(!PANEL_ACIK || !ayniSiteHazir(), ATLAMA_NEDENI)
test.describe.configure({ mode: 'serial' })

let a: TestKiraci
let b: TestKiraci
let o: Oturum
const axeBulgulari: string[] = []

test.beforeAll(async ({ browser }, info) => {
  a = await kiraciKur('w6a')
  b = await kiraciKur('w6b')
  o = await yeniOturum(browser, info.project.use.baseURL as string)
})

test.afterAll(async () => {
  await o?.context.close()
})

test('W6 K4: giriş yapınca kendi panele düşer', async () => {
  await girisYap(o.page, a.email, a.password, new RegExp(`/panel/${a.slug}/bugun`))
  await expect(o.page.locator('body')).toContainText(a.salonAdi)
})

test('W6 K4: yabancı salon kısaltması kendi paneline yönlenir, yabancı salona ait hiçbir şey çizilmez ve istenmez', async () => {
  const { page } = o
  // Yabancı salon adı DOM'da hiç belirmemeli: değişiklik gözlemcisi her yüklemeden önce kurulur (geçici bir çizim de yakalanır).
  await page.addInitScript((yabanci: string) => {
    const w = window as unknown as { __yabanciGorulen: boolean }
    w.__yabanciGorulen = false
    const kontrol = () => {
      if (document.body?.innerText.includes(yabanci)) w.__yabanciGorulen = true
    }
    new MutationObserver(kontrol).observe(document, { subtree: true, childList: true, characterData: true })
  }, b.salonAdi)

  o.istekler.length = 0
  await page.goto(`/panel/${b.slug}/bugun`)
  await page.waitForURL(new RegExp(`/panel/${a.slug}/bugun`))
  await expect(page.locator('body')).toContainText(a.salonAdi)

  expect(await page.evaluate(() => (window as unknown as { __yabanciGorulen: boolean }).__yabanciGorulen), 'yabancı salon adı bir an bile çizildi').toBe(false)
  expect(await page.locator('body').innerText(), 'yabancı salon adı ekranda').not.toContain(b.salonAdi)
  // Kiracı sunucudan gelir: adresteki yabancı kısaltma API isteğine hiç girmemeli.
  const yabanciIstekler = o.istekler.filter((u) => u.includes(b.slug) && !u.startsWith(new URL(page.url()).origin))
  expect(yabanciIstekler, 'yabancı kiracıya atılan API istekleri').toEqual([])
})

test('W6 K6: hazır olmayan ekranda "Eski ekranda açın" ?eski=1 ile eski ekrana gider ve yeni panele geri yönlenmez', async () => {
  const { page } = o
  // Bugün ekranı gerçek ekran olduğundan "hazır olmayan" örnek olarak Takvim kullanılır (henüz yeni arayüzde yok).
  await page.goto(`/panel/${a.slug}/takvim`)
  await expect(page.getByRole('heading', { name: 'Bu ekran yeni arayüzde hazırlanıyor.' })).toBeVisible()
  const baglanti = page.getByRole('link', { name: 'Eski ekranda açın' })
  await expect(baglanti).toHaveAttribute('href', `/tenant/${a.slug}/appointments?eski=1`)
  const konsolOnce = o.konsol.length
  await baglanti.click()
  await page.waitForURL(`**/tenant/${a.slug}/appointments?eski=1`)
  // Eski ekran sürekli ağ isteği atar (networkidle gelmez): içeriğin çizilmesi koşul olarak beklenir, sonra adresin sabit kaldığı doğrulanır.
  // Yönlendirme sürüyorsa /panel'e düşerdi; eski ekranın kendi menüsü çizildikten sonra adres hâlâ ?eski=1 olmalı.
  await expect(page.locator('a[href*="/dashboard"]').first()).toBeAttached()
  await expect(page).toHaveURL(new RegExp(`/tenant/${a.slug}/appointments\\?eski=1$`))
  await expect(page.getByText('Bu ekran yeni arayüzde hazırlanıyor.')).toHaveCount(0)
  // Eski arayüz bu kabulün kapsamı dışındadır: konsol denetimi yalnız yeni panel gezintisini kapsar.
  o.konsol.length = konsolOnce
})

test('W6 K6: ?eski=1 olmadan eski panel yolu yeni panele yönlenir (kontrol)', async () => {
  const yanit = await o.context.request.get(`/tenant/${a.slug}/dashboard`, { maxRedirects: 0, failOnStatusCode: false })
  expect(yanit.status()).toBe(307)
  expect(new URL(yanit.headers()['location'], 'http://web').pathname).toBe(`/panel/${a.slug}/bugun`)
})

test('W6 K1: Menü ekranında Tab ile gezerken her satırda odak halkası görünür ve kırpılmaz (390 px)', async () => {
  const { page } = o
  await genislikAyarla(page, 390, 844)
  await page.goto(`/panel/${a.slug}/menu`)
  await expect(page.getByRole('heading', { level: 1, name: 'Menü' })).toBeVisible()

  const satirlar: Awaited<ReturnType<typeof odakHalkasiOlc>>[] = []
  let ilkSatirGoruntusu = false
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab')
    const olcum = await odakHalkasiOlc(page)
    if (olcum.menuSatiri) {
      satirlar.push(olcum)
      if (!ilkSatirGoruntusu) {
        ilkSatirGoruntusu = true
        await ekranGoruntusu(page, 'w6-menu-odak-390')
      }
    }
    if (olcum.cikis) {
      expect(olcum.gorunur, `Çıkış yap düğmesinde halka görünmüyor (${olcum.oge})`).toBe(true)
      break
    }
  }
  expect(satirlar.length, 'Tab ile gezilen menü satırı sayısı').toBeGreaterThanOrEqual(5)
  for (const s of satirlar) {
    expect(s.gorunur, `halka çizilmiyor: ${s.oge}`).toBe(true)
    expect(s.kirpilan, `halka kırpılıyor: ${s.oge}`).toBeNull()
  }
})

for (const g of [
  { ad: '390', w: 390, h: 844 },
  { ad: '1440', w: 1440, h: 900 },
]) {
  test(`W6 UI-DoD: Menü ${g.ad} px ekran görüntüsü, yatay taşma yok, ciddi axe ihlali yok`, async () => {
    const { page } = o
    await genislikAyarla(page, g.w, g.h)
    await expect(page.getByRole('heading', { level: 1, name: 'Menü' })).toBeVisible()
    await ekranGoruntusu(page, `w6-menu-${g.ad}`)
    expect(await yatayTasma(page), 'yatay taşma (px)').toBeLessThanOrEqual(0)
    // İhlal hemen fırlatılmaz (serial kip kalan testleri atlatır); kaydedilir ve serinin sonunda ayrı testle hükme bağlanır.
    await expectNoSeriousA11yViolations(page, `W6 Menü ${g.ad} px`).catch((e: Error) => {
      axeBulgulari.push(e.message.split('\n').slice(0, 14).join('\n'))
    })
    // Kabuk eşiği: 1024 px ve üstünde yan menü, altında alt menü.
    await expect(page.getByRole('navigation', { name: 'Alt menü' })).toBeVisible({ visible: g.w < 1024 })
  })
}

// Serinin son testi: birikmiş ölçümler birlikte hükme bağlanır (soft: biri kalsa da diğeri raporlanır).
test('W6 UI-DoD: Menü iki genişlikte ciddi axe ihlali yok ve gezinti boyunca konsolda hata yok', () => {
  expect.soft(axeBulgulari, 'axe ihlalleri').toEqual([])
  expect.soft(o.konsol, 'konsol hataları').toEqual([])
})
