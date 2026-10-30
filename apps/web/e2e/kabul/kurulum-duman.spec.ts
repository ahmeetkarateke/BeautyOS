import { expect, test } from '@playwright/test'
import { benzersiz } from '../yardimcilar/api'
import { ATLAMA_NEDENI, PANEL_ACIK, ayniSiteHazir, genislikAyarla, yeniOturum, type Oturum } from '../yardimcilar/panel'

// W31 kurulum sihirbazı dumanı: kayıttan sonra /kurulum'a yönlenir, işletme türü değiştirilip sonraki adıma geçilir,
// kalan adımlar atlanır, "Panele git" ile panele girilir; Ayarlar'da salon telefonu silinebilir (A-ayar-telefon-null).
// Çalıştırma: E2E_UI_V2=auth,panel. Bütçe: /auth 10 istek/15 dk: 1 kayıt + birkaç yenileme.
const AUTH_ACIK = (process.env.E2E_UI_V2 ?? '').toLowerCase().split(',').map((p) => p.trim()).includes('auth')
test.skip(!PANEL_ACIK || !AUTH_ACIK || !ayniSiteHazir(), `${ATLAMA_NEDENI}; ayrıca E2E_UI_V2 içinde auth gerekir`)
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let o: Oturum
let slug = ''

test.beforeAll(async ({ browser }, info) => {
  o = await yeniOturum(browser, info.project.use.baseURL as string)
})

test.afterAll(async () => {
  await o?.context.close()
})

test('kurulum duman: kayıttan sonra /kurulum açılır', async () => {
  const { page } = o
  const s = benzersiz()
  slug = `tst-kur-${s}`.slice(0, 30)
  await genislikAyarla(page, 1440, 900)
  await page.goto('/signup')
  await page.getByLabel('İşletme adı').fill(`Duman Kurulum ${s}`)
  await page.getByLabel('İşletme türü').selectOption({ index: 1 })
  await page.getByLabel('Online randevu adresi').fill(slug)
  await page.getByRole('button', { name: 'Devam et' }).click()
  await page.getByLabel('Ad soyad', { exact: true }).fill('Kurulum Sahibi')
  await page.getByLabel('Telefon', { exact: true }).fill('5551234567')
  await page.getByLabel('E-posta', { exact: true }).fill(`kurulum-${s}@e2e.test.local`)
  await page.getByLabel('Şifre', { exact: true }).fill('KurulumPass12!')
  await page.getByRole('checkbox', { name: /Kullanım şartlarını/ }).check()
  await page.getByRole('button', { name: 'Hesap oluştur' }).click()
  await expect(page).toHaveURL(new RegExp(`/panel/${slug}/kurulum`), { timeout: 30_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Kurulum ilerlemesi' })).toBeVisible()
})

test('kurulum duman: işletme türü değiştirilip sonraki adıma geçilir', async () => {
  const { page } = o
  const baslik = await page.getByRole('heading', { level: 1 }).textContent()
  const tur = page.getByLabel('İşletme türü')
  await expect(tur).toBeVisible()
  const secenekler = await tur.locator('option').evaluateAll((l) => (l as HTMLOptionElement[]).map((x) => x.value))
  const mevcut = await tur.inputValue()
  const yeni = secenekler.find((v) => v !== mevcut)
  expect(yeni, 'değiştirilecek başka bir tür').toBeTruthy()
  await tur.selectOption(yeni as string)
  await page.getByRole('button', { name: 'Devam et' }).click()
  await expect(page.getByRole('heading', { level: 1 }), 'sonraki adıma geçildi').not.toHaveText(baslik ?? '')
  await expect(page.getByRole('alert').filter({ hasText: /\S/ }), 'hata bandı yok').toHaveCount(0)
})

test('kurulum duman: kalan adımlar atlanır ve Panele git panele götürür', async () => {
  const { page } = o
  for (let i = 0; i < 10; i += 1) {
    if (await page.getByRole('button', { name: 'Panele git' }).isVisible()) break
    const atla = page.getByRole('button', { name: 'Şimdilik atla' })
    const devam = page.getByRole('button', { name: /^Devam et$/ })
    if (await atla.isVisible()) await atla.click()
    else await devam.click()
  }
  await page.getByRole('button', { name: 'Panele git' }).click()
  await expect(page).toHaveURL(new RegExp(`/panel/${slug}/bugun`), { timeout: 30_000 })
})

test('kurulum duman: Ayarlar > Salon bilgilerinde telefon yazılır ve silinir', async () => {
  const { page } = o
  await page.goto(`/panel/${slug}/ayarlar/salon`)
  const telefon = page.getByLabel('Telefon')
  await expect(telefon).toBeVisible()
  await page.getByLabel('Adres').fill('Duman Sokak No 12')
  await telefon.fill('02121234567')
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click()
  await expect(page.getByText('Salon bilgileri kaydedildi.', { exact: true }).last()).toBeVisible()
  await telefon.fill('')
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click()
  await expect(page.getByText('Salon bilgileri kaydedildi.', { exact: true }).last()).toBeVisible()
  await expect(page.getByText(/Telefonu 7 ile 20 karakter/)).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel('Telefon')).toHaveValue('')
})
