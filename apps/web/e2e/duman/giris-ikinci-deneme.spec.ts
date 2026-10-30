import { expect, test, type Page } from '@playwright/test'
import { hataBandi } from '../yardimcilar/panel'

// H1 regresyonu: yanlış şifreden sonra doğru şifreyle ikinci deneme.
// Gerçek tarayıcıda koşar, API'yi page.route ile sahteler (yığın gerekmez); gerçek API gecikmesini 500 ms ile taklit eder.
// Çalıştırma: E2E_BASE_URL=<web> E2E_UI_V2=auth (eski /login yeni ekrana yönlenir).
//
// H1'in kök nedeni ürün kodunda değil, testin "hata bandı göründü" beklemesindeydi: `getByRole('alert').first()`
// Next'in görünmez yol duyurucusunu (#__next-route-announcer__, role=alert) yakalar; bu yüzden bekleme ilk
// istek bitmeden geçer, test şifreyi istek sürerken değiştirip tıklar ve düğme yüklenirken tıklamayı yok sayar.
const AUTH_ACIK = (process.env.E2E_UI_V2 ?? '').toLowerCase().split(',').map((p) => p.trim()).includes('auth')
test.skip(!AUTH_ACIK, 'auth yüzeyi açık değil (E2E_UI_V2=auth)')

const GECIKME_MS = 500
const DOGRU_SIFRE = 'DogruPass12!'

async function sahteGiris(page: Page): Promise<string[]> {
  const gonderilenler: string[] = []
  await page.route('**/api/v1/auth/login', async (route) => {
    const sifre = (route.request().postDataJSON() as { password?: string }).password ?? ''
    gonderilenler.push(sifre)
    await new Promise((bitti) => setTimeout(bitti, GECIKME_MS))
    if (sifre === DOGRU_SIFRE) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 't', user: { tenantSlug: 'defne' } }) })
    }
    return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'x' } }) })
  })
  // Giriş sonrası panel yüklenirken oturum çağrıları gerçek API'ye gitmesin.
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"code":"UNAUTHORIZED"}}' }))
  return gonderilenler
}

test('H1: yanlış şifre hata bandı gösterir, ardından doğru şifre ikinci isteği gönderir ve panele gider', async ({ page }) => {
  const gonderilenler = await sahteGiris(page)
  await page.goto('/login')
  await page.getByLabel('E-posta').fill('defne@e2e.test.local')
  await page.getByLabel('Şifre', { exact: true }).fill('YanlisPass99!')
  await page.getByRole('button', { name: 'Giriş yap' }).click()

  await expect(hataBandi(page), 'yanlış şifrede hata bandı').toBeVisible()
  await expect(hataBandi(page)).toHaveText('E-posta veya şifre hatalı.')
  await expect(page.getByRole('button', { name: 'Giriş yap' })).toBeEnabled()

  await page.getByLabel('Şifre', { exact: true }).fill(DOGRU_SIFRE)
  await page.getByRole('button', { name: 'Giriş yap' }).click()

  await expect(page).toHaveURL(/\/panel\/defne\//, { timeout: 15_000 })
  expect(gonderilenler, 'iki istek: yanlış, sonra doğru şifre').toEqual(['YanlisPass99!', DOGRU_SIFRE])
})

test('H1: istek sürerken ikinci tıklama ikinci istek göndermez (çift gönderim yok)', async ({ page }) => {
  const gonderilenler = await sahteGiris(page)
  await page.goto('/login')
  await page.getByLabel('E-posta').fill('defne@e2e.test.local')
  await page.getByLabel('Şifre', { exact: true }).fill('YanlisPass99!')
  const dugme = page.getByRole('button', { name: /Giriş yap/ })
  await dugme.click()
  await expect(page.getByRole('button', { name: /Giriş yapılıyor/ })).toBeVisible()
  await dugme.click({ force: true })
  await expect(page.getByText('E-posta veya şifre hatalı.')).toBeVisible()
  expect(gonderilenler).toEqual(['YanlisPass99!'])
})
