import { expect, test } from '@playwright/test'
import { benzersiz, kiraciKur, type TestKiraci } from '../yardimcilar/api'
import { ATLAMA_NEDENI, PANEL_ACIK, ayniSiteHazir, genislikAyarla, yeniOturum, type Oturum } from '../yardimcilar/panel'

// Giriş, kayıt ve davet kabul dumanı (yeni auth yüzeyi). E-posta gönderimi test yığınında yoktur: davet bağlantısı arayüzde gösterilir.
// Çalıştırma: E2E_UI_V2=auth,panel (eski /login yeni ekrana yönlenir).
// Bütçe: /auth 10 istek/15 dk: 1 kayıt (API) + 2 giriş + 1 davet kabulü + 1 arayüz kaydı.
const AUTH_ACIK = (process.env.E2E_UI_V2 ?? '').toLowerCase().split(',').map((p) => p.trim()).includes('auth')
test.skip(!PANEL_ACIK || !AUTH_ACIK || !ayniSiteHazir(), `${ATLAMA_NEDENI}; ayrıca E2E_UI_V2 içinde auth gerekir`)
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let k: TestKiraci
let sahip: Oturum
let davetJetonu = ''
const davetEposta = `davetli-${benzersiz()}@e2e.test.local`

test.beforeAll(async ({ browser }, info) => {
  k = await kiraciKur('auth')
  sahip = await yeniOturum(browser, info.project.use.baseURL as string)
})

test.afterAll(async () => {
  await sahip?.context.close()
})

test('auth duman: doğru şifre tek başına panele götürür', async () => {
  const { page } = sahip
  await genislikAyarla(page, 1440, 900)
  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1, name: 'Giriş yap' })).toBeVisible()
  await page.getByLabel('E-posta').fill(k.email)
  await page.getByLabel('Şifre', { exact: true }).fill(k.password)
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page).toHaveURL(new RegExp(`/panel/${k.slug}/bugun`), { timeout: 20_000 })
})

test('auth duman: sahip personel davet eder, bağlantı arayüzde görünür', async () => {
  const { page } = sahip
  await page.goto(`/panel/${k.slug}/personel`)
  await page.getByRole('button', { name: 'Personel davet et' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Ad soyad').fill('Davetli Uzman')
  await d.getByLabel('E-posta').fill(davetEposta)
  await d.getByRole('button', { name: 'Daveti gönder' }).click()
  const baglanti = page.getByLabel('Davet bağlantısı')
  await expect(baglanti).toBeVisible()
  const deger = await baglanti.inputValue()
  davetJetonu = new URL(deger).hash.replace(/^#/, '')
  expect(davetJetonu.length, 'davet jetonu bağlantıda').toBeGreaterThan(10)
})

test('auth duman: davet kabul ekranı açılır, şifre belirlenir ve panele girilir', async ({ browser }, info) => {
  const yeni = await yeniOturum(browser, info.project.use.baseURL as string)
  try {
    const { page } = yeni
    await page.goto(`/invite#${davetJetonu}`)
    await expect(page.getByText(/sizi davet etti/)).toBeVisible()
    await expect(page.getByLabel('E-posta')).toHaveValue(davetEposta)
    await page.getByLabel('Şifre', { exact: true }).fill('DavetPass12!')
    await page.getByRole('button', { name: 'Hesabımı oluştur' }).click()
    await expect(page).toHaveURL(new RegExp(`/panel/${k.slug}/`), { timeout: 20_000 })
  } finally {
    await yeni.context.close()
  }
})

test('auth duman: kullanılmış davet bağlantısı yeniden kabul edilmez', async ({ browser }, info) => {
  const yeni = await yeniOturum(browser, info.project.use.baseURL as string)
  try {
    const { page } = yeni
    await page.goto(`/invite#${davetJetonu}`)
    await expect(page.getByText(/sizi davet etti/), 'kullanılmış davet form göstermez').toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  } finally {
    await yeni.context.close()
  }
})

test('auth duman: kayıt iki adımda tamamlanır ve yeni panele girilir', async ({ browser }, info) => {
  const yeni = await yeniOturum(browser, info.project.use.baseURL as string)
  try {
    const { page } = yeni
    const s = benzersiz()
    await genislikAyarla(page, 1440, 900)
    await page.goto('/signup')
    await page.getByLabel('İşletme adı').fill(`Duman Kayıt ${s}`)
    await page.getByLabel('İşletme türü').selectOption({ index: 1 })
    await page.getByLabel('Online randevu adresi').fill(`tst-kayit-${s}`.slice(0, 30))
    await page.getByRole('button', { name: 'Devam et' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Hesap bilgileriniz' })).toBeVisible()
    await page.getByLabel('Ad soyad', { exact: true }).fill('Kayıt Sahibi')
    await page.getByLabel('Telefon', { exact: true }).fill('5551234567')
    await page.getByLabel('E-posta', { exact: true }).fill(`kayit-${s}@e2e.test.local`)
    await page.getByLabel('Şifre', { exact: true }).fill('KayitPass12!')
    await page.getByRole('checkbox', { name: /Kullanım şartlarını/ }).check()
    await page.getByRole('button', { name: 'Hesap oluştur' }).click()
    await expect(page).toHaveURL(/\/panel\/tst-kayit-/, { timeout: 20_000 })
  } finally {
    await yeni.context.close()
  }
})

// Bilinen hata H1 (frontend): en sona alındı ki serideki diğer testler koşsun; düzelince yerine taşınabilir.
test('auth duman: yanlış şifre hata gösterir, ardından doğru şifre panele götürür', async ({ browser }, info) => {
  const yeni = await yeniOturum(browser, info.project.use.baseURL as string)
  try {
    const { page } = yeni
    // Tanı: giriş isteklerinin durum kodları (ikinci denemede istek gidiyor mu, hangi kodu alıyor).
    const girisYanitlari: string[] = []
    const tumIstekler: string[] = []
    page.on('request', (r) => {
      if (/\/api\//.test(r.url())) tumIstekler.push(`${r.method()} ${new URL(r.url()).pathname}`)
    })
    page.on('requestfailed', (r) => tumIstekler.push(`FAILED ${r.url()} ${r.failure()?.errorText ?? ''}`))
    page.on('response', (r) => {
      if (/\/auth\/login/.test(r.url())) girisYanitlari.push(String(r.status()))
    })
    await page.goto('/login')
    await page.getByLabel('E-posta', { exact: true }).fill(k.email)
    await page.getByLabel('Şifre', { exact: true }).fill('YanlisPass99!')
    await page.getByRole('button', { name: 'Giriş yap' }).click()
    await expect(page.getByRole('alert').first(), 'yanlış şifrede hata bandı').toBeVisible()
    await expect(page).toHaveURL(/\/(v2\/)?login/)
    await page.getByLabel('Şifre', { exact: true }).fill(k.password)
    await page.getByRole('button', { name: 'Giriş yap' }).click()
    // Tanı: ikinci denemede istek gidiyor mu, düğme hangi durumda (kararlı bekleme: koşul).
    await expect.poll(() => girisYanitlari.length, { timeout: 8000 }).toBeGreaterThan(1).catch(() => undefined)
    const dugme = page.getByRole('button', { name: /Giriş/ })
    const durum = await dugme.evaluate((e) => ({ metin: e.textContent, kapali: (e as HTMLButtonElement).disabled }))
    expect(girisYanitlari, JSON.stringify({ durum, tum: tumIstekler })).toEqual(['401', '200'])
    await expect(page).toHaveURL(new RegExp(`/panel/${k.slug}/bugun`), { timeout: 20_000 })
  } finally {
    await yeni.context.close()
  }
})
