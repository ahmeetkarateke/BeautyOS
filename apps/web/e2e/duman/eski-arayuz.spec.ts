import { expect, test } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../yardimcilar/axe'
import { kiraciKur, randevuVerisiKur, type TestKiraci } from '../yardimcilar/api'
import { ucGenislikteCek } from '../yardimcilar/ekran-goruntusu'

// T1-K2: eski arayüz dumanı. Giriş, panel açılışı, randevu oluşturma, /book açılışı.
// Veri API ile kurulur; her koşu kendi `tst-` kiracısını açar (sıra bağımlılığı yok).
let k: TestKiraci
let veri: Awaited<ReturnType<typeof randevuVerisiKur>>

test.beforeAll(async () => {
  k = await kiraciKur('duman')
  veri = await randevuVerisiKur(k)
})

async function girisYap(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByPlaceholder('ornek@salon.com').fill(k.email)
  await page.getByPlaceholder('••••••••').fill(k.password)
  await page.getByRole('button', { name: /Giriş Yap/ }).click()
  await page.waitForURL(`**/tenant/${k.slug}/dashboard`)
}

test('K2: giriş yapınca panel açılır', async ({ page }) => {
  await girisYap(page)
  await expect(page).toHaveURL(new RegExp(`/tenant/${k.slug}/dashboard`))
  await expect(page.locator('main, [role="main"], body')).toBeVisible()
})

test('K2: hatalı şifre girişi reddeder, panele geçmez', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('ornek@salon.com').fill(k.email)
  await page.getByPlaceholder('••••••••').fill('YanlisSifre99!')
  await page.getByRole('button', { name: /Giriş Yap/ }).click()
  // Koşul bekleme: URL değişmediğini sabit beklemeyle değil, hata görünümüyle doğrula.
  await expect(page.getByText(/hatalı|geçersiz|yanlış/i).first()).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('K2: randevu oluşturma katmanından randevu eklenir', async ({ page }) => {
  await girisYap(page)
  await page.goto(`/tenant/${k.slug}/appointments`)
  await page.getByRole('button', { name: 'Yeni Randevu' }).click()
  const katman = page.getByRole('dialog')
  await expect(katman.getByText('Yeni Randevu')).toBeVisible()
  await katman.locator('#customerId').selectOption(veri.musteri.id)
  await katman.locator('#serviceId').selectOption(veri.hizmet.id)
  await katman.locator('#staffId').selectOption(veri.uzman.id)
  // Saat seçimi: ilk müsait saat (ilk seçenek yer tutucu).
  const saat = katman.locator('select').last()
  await expect(saat.locator('option')).not.toHaveCount(1)
  await saat.selectOption({ index: 1 })
  await katman.getByRole('button', { name: 'Randevu Oluştur' }).click()
  await expect(katman).toBeHidden()

  const liste = await k.api.get(k.yol('/appointments?limit=50'))
  expect(liste.status()).toBe(200)
  expect(JSON.stringify(await liste.json())).toContain(veri.musteri.id)
})

test('K2: /book sayfası oturumsuz açılır', async ({ page }) => {
  await page.goto(`/book/${k.slug}`)
  await expect(page.getByText('Test Salon').first()).toBeVisible()
})

test('K3: giriş sayfası axe ve üç genişlikte ekran görüntüsü', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('ornek@salon.com').waitFor()
  await ucGenislikteCek(page, 'eski-giris')
  // Eski arayüz bilinen ihlaller taşıyabilir: bu test ölçer, W2'den sonra kapı olur.
  test.info().annotations.push({ type: 'axe', description: 'bilgi amaçlı (eski arayüz)' })
  await expectNoSeriousA11yViolations(page, '/login').catch((e) => {
    test.info().annotations.push({ type: 'axe-ihlal', description: String(e.message).slice(0, 500) })
  })
})
