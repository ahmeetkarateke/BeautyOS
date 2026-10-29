import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectNoSeriousA11yViolations } from '../yardimcilar/axe'
import { kiraciKur, randevuVerisiKur, type TestKiraci } from '../yardimcilar/api'
import {
  ATLAMA_NEDENI,
  PANEL_ACIK,
  ayniSiteHazir,
  ekranGoruntusu,
  genislikAyarla,
  girisYap,
  yatayTasma,
  yeniOturum,
  type Oturum,
} from '../yardimcilar/panel'

// W13 görsel kabul: Randevu oluştur katmanı (müşteri ara/yeni ekle, hizmet, personel, 14 günlük şerit, boş saat) ve
// DUPLICATE_PHONE'da "Kayıtlı müşteriyi seç" (+90 ile saklanan kayıt da bulunmalı). Kiracı izolasyonu: başka salonun müşterisi aramada çıkmaz.
// Bütçe: /auth 10 istek/15 dk: bu dosya 2 kayıt + 1 giriş yapar.
test.skip(!PANEL_ACIK || !ayniSiteHazir(), ATLAMA_NEDENI)
test.describe.configure({ mode: 'serial', timeout: 120_000 })

let a: TestKiraci
let b: TestKiraci
let o: Oturum
let hizmetAdi: string
let uzmanAdi: string
let kayitliId: string
let kayitliAd: string
let kayitliHane: string
const axeBulgulari: string[] = []

const hane = () => `5${Math.floor(100000000 + Math.random() * 899999999)}`

async function json<T>(r: { status(): number; text(): Promise<string>; json(): Promise<unknown> }): Promise<T> {
  expect(r.status(), await r.text()).toBeLessThan(300)
  return (await r.json()) as T
}

async function olc(page: Page, ad: string) {
  await ekranGoruntusu(page, ad)
  expect(await yatayTasma(page), `yatay taşma (px): ${ad}`).toBeLessThanOrEqual(0)
  await expectNoSeriousA11yViolations(page, ad).catch((e: Error) => {
    axeBulgulari.push(e.message.split('\n').filter((s) => /kural|etki|dugumSayisi|ornek|\.|\[|axe ihlalleri/.test(s)).slice(0, 30).join('\n'))
  })
}

/** Katmanda hizmet ve personel seçer, boş saati olan ilk günü bulup ilk boş saati seçer. */
async function hizmetPersonelSaatSec(katman: Locator) {
  await katman.getByRole('group', { name: 'Hizmet' }).getByRole('button', { name: new RegExp(hizmetAdi) }).click()
  await katman.getByRole('group', { name: 'Personel' }).getByRole('button', { name: uzmanAdi }).click()
  const seritDugmeleri = katman.getByRole('group', { name: 'Tarih seçin' }).getByRole('button')
  const sayi = await seritDugmeleri.count()
  for (let i = 0; i < sayi; i++) {
    const dugme = seritDugmeleri.nth(i)
    if (await dugme.isDisabled()) continue
    await dugme.click()
    const saatler = katman.getByRole('group', { name: 'Boş saatler' })
    const bos = katman.getByText('Bu gün boş saat yok.')
    await expect(saatler.or(bos)).toBeVisible()
    if (await saatler.isVisible()) {
      await saatler.getByRole('button').first().click()
      return
    }
  }
  throw new Error('14 günlük şeritte boş saati olan gün bulunamadı')
}

test.beforeAll(async ({ browser }, info) => {
  a = await kiraciKur('w13a')
  b = await kiraciKur('w13b')
  const veri = await randevuVerisiKur(a)
  hizmetAdi = veri.hizmet.name
  uzmanAdi = veri.uzman.fullName

  // A'da +90 ile saklanan kayıtlı müşteri (ulusal 10 hane ile aranınca bulunmalı).
  kayitliHane = hane()
  kayitliAd = 'Kayıtlı Telefonlu'
  const musteri = await json<{ id: string; phone?: string }>(await a.api.post(a.yol('/customers'), { data: { fullName: kayitliAd, phone: `+90${kayitliHane}` } }))
  kayitliId = musteri.id

  // B salonunda ayrı bir müşteri (A'nın aramasında görünmemeli).
  await json(await b.api.post(b.yol('/customers'), { data: { fullName: 'Yabancı Salon Müşterisi', phone: `0${hane()}` } }))

  o = await yeniOturum(browser, info.project.use.baseURL as string)
})

test.afterAll(async () => {
  await o?.context.close()
})

test('W13: takvimden Randevu oluştur katmanı açılır; tamamlanmadan düğme kapalı, yeni müşteriyle randevu oluşur', async () => {
  const { page } = o
  await genislikAyarla(page, 1440, 900)
  await girisYap(page, a.email, a.password, new RegExp(`/panel/${a.slug}/bugun`))
  await page.goto(`/panel/${a.slug}/takvim?yeni=1`)
  const katman = page.getByRole('dialog', { name: 'Randevu oluştur' })
  await expect(katman).toBeVisible()
  const olustur = katman.getByRole('button', { name: 'Randevu oluştur' })
  await expect(olustur, 'hiçbir şey seçilmeden düğme açık').toBeDisabled()

  const yeniAd = 'Yeni Aday Müşteri'
  await katman.getByRole('searchbox', { name: /Müşteri ara/ }).fill(yeniAd)
  await katman.getByRole('button', { name: new RegExp(`${yeniAd} adıyla yeni müşteri ekle`) }).click()
  await katman.getByLabel('Telefon').fill(hane())
  await expect(olustur, 'saat seçilmeden düğme kapalı').toBeDisabled()
  await hizmetPersonelSaatSec(katman)
  await expect(olustur).toBeEnabled()
  await ekranGoruntusu(page, 'w13-olustur-katmani-1440')
  await olustur.click()
  await expect(page.getByText('Randevu oluşturuldu.', { exact: true }).last()).toBeVisible()
  await expect(katman).toBeHidden()

  const musteriler = await json<{ data?: Array<{ id: string; fullName: string }> } | Array<{ id: string; fullName: string }>>(await a.api.get(a.yol('/customers')))
  const dizi = Array.isArray(musteriler) ? musteriler : (musteriler.data ?? [])
  expect(dizi.filter((m) => m.fullName === yeniAd), 'yeni müşteri tek kayıt').toHaveLength(1)
})

test('W13: DUPLICATE_PHONE sonrası "Kayıtlı müşteriyi seç" +90 saklanan gerçek kaydı bulur ve randevu o müşteriye bağlanır', async () => {
  const { page } = o
  await page.goto(`/panel/${a.slug}/takvim?yeni=1`)
  const katman = page.getByRole('dialog', { name: 'Randevu oluştur' })
  await expect(katman).toBeVisible()
  const ad = 'Telefon Çakışan Aday'
  await katman.getByRole('searchbox', { name: /Müşteri ara/ }).fill(ad)
  await katman.getByRole('button', { name: new RegExp(`${ad} adıyla yeni müşteri ekle`) }).click()
  await katman.getByLabel('Telefon').fill(kayitliHane)
  await hizmetPersonelSaatSec(katman)
  await katman.getByRole('button', { name: 'Randevu oluştur' }).click()

  const sec = katman.getByRole('button', { name: 'Kayıtlı müşteriyi seç' })
  await expect(sec, 'telefon çakışması seçeneği çıktı').toBeVisible()
  await expect(katman.getByRole('button', { name: 'Yine de yeni müşteri ekle' })).toBeVisible()
  // Bilerek tetiklenen telefon çakışmasının (409) tarayıcı konsol satırı bu kabulün konsol denetimine sayılmaz.
  o.konsol.splice(0, o.konsol.length, ...o.konsol.filter((m) => !/status of 409/.test(m)))
  await ekranGoruntusu(page, 'w13-telefon-cakismasi-1440')
  await sec.click()

  const hit = katman.getByRole('button', { name: new RegExp(kayitliAd) })
  await expect(hit, '+90 ile saklanan kayıtlı müşteri aramada bulundu').toBeVisible()
  await hit.click()
  await expect(katman.getByText(kayitliAd, { exact: true })).toBeVisible()
  await hizmetPersonelSaatSec(katman)
  await katman.getByRole('button', { name: 'Randevu oluştur' }).click()
  await expect(page.getByText('Randevu oluşturuldu.', { exact: true }).last()).toBeVisible()
  await expect(katman).toBeHidden()

  const musteriler = await json<{ data?: Array<{ id: string; fullName: string }> } | Array<{ id: string; fullName: string }>>(await a.api.get(a.yol('/customers')))
  const dizi = Array.isArray(musteriler) ? musteriler : (musteriler.data ?? [])
  expect(dizi.filter((m) => m.fullName === ad), 'çakışan adayla yeni müşteri açılmamalı').toHaveLength(0)
  const randevular = await json<{ data?: Array<{ customerId?: string | null }> } | Array<{ customerId?: string | null }>>(
    await a.api.get(a.yol(`/appointments?dateFrom=${new Date().toISOString().slice(0, 10)}&dateTo=${new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)}`)),
  )
  const sat = Array.isArray(randevular) ? randevular : (randevular.data ?? [])
  expect(sat.filter((r) => r.customerId === kayitliId), 'randevu kayıtlı müşteriye bağlı').toHaveLength(1)
})

test('W13 izolasyon: başka salonun müşterisi aramada çıkmaz; kendi müşterisi ulusal ve +90 yazımla bulunur', async () => {
  const { page } = o
  await page.goto(`/panel/${a.slug}/takvim?yeni=1`)
  const katman = page.getByRole('dialog', { name: 'Randevu oluştur' })
  await expect(katman).toBeVisible()
  const arama = katman.getByRole('searchbox', { name: /Müşteri ara/ })

  await arama.fill('Yabancı Salon')
  await expect(katman.getByRole('button', { name: /Yabancı Salon adıyla yeni müşteri ekle/ }), 'arama tamamlandı').toBeVisible()
  await expect(katman.getByText('Yabancı Salon Müşterisi')).toHaveCount(0)

  await arama.fill(`0${kayitliHane}`)
  await expect(katman.getByRole('button', { name: new RegExp(kayitliAd) }), 'ulusal 0 ile yazılan telefon').toBeVisible()
  await arama.fill(`+90${kayitliHane}`)
  await expect(katman.getByRole('button', { name: new RegExp(kayitliAd) }), '+90 ile yazılan telefon').toBeVisible()
  await arama.fill('Kayıtlı Tel')
  await expect(katman.getByRole('button', { name: new RegExp(kayitliAd) }), 'ad ile arama').toBeVisible()
})

test('W13 telefon (390 px): katman ekrana sığar, taşma yok', async () => {
  const { page } = o
  await genislikAyarla(page, 390, 844)
  await page.goto(`/panel/${a.slug}/takvim?yeni=1`)
  const katman = page.getByRole('dialog', { name: 'Randevu oluştur' })
  await expect(katman).toBeVisible()
  await katman.getByRole('group', { name: 'Hizmet' }).getByRole('button', { name: new RegExp(hizmetAdi) }).click()
  await olc(page, 'w13-olustur-katmani-390')
})

// Serinin son testi: birikmiş ölçümler birlikte hükme bağlanır.
test('W13 UI-DoD: ciddi axe ihlali yok, konsolda hata yok', () => {
  expect.soft(axeBulgulari, 'axe ihlalleri').toEqual([])
  expect.soft(o.konsol, 'konsol hataları').toEqual([])
})
