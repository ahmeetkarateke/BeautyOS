import { expect, test, type Locator, type Page } from '@playwright/test'
import { kiraciKur, randevuVerisiKur, type TestKiraci } from '../yardimcilar/api'
import { ATLAMA_NEDENI, PANEL_ACIK, ayniSiteHazir, genislikAyarla, girisYap, yeniOturum, type Oturum } from '../yardimcilar/panel'

// Yeni ekranlar için YALNIZ mutlu yol dumanı (W16–W28, W30): her ekran açılır, liste gelir, bir kayıt oluşturulur.
// Rol kapıları (uzman): Müşteri kartında tutar yok; Ayarlar, Stok ve Kasa'ya erişilemez.
// Bütçe: /auth 10 istek/15 dk: bu dosya 1 kayıt + 2 giriş yapar.
test.skip(!PANEL_ACIK || !ayniSiteHazir(), ATLAMA_NEDENI)
test.describe.configure({ mode: 'serial', timeout: 120_000 })

const TZ = 'Europe/Istanbul'
const gunStr = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const bugun = gunStr(new Date())
const haftaOnce = gunStr(new Date(Date.now() - 6 * 86_400_000))
const telefon = () => `0555${Math.floor(1000000 + Math.random() * 8999999)}`
const YETKI_YOK = 'Bu sayfayı görme yetkiniz yok.'
const YENI_SIFRE = 'YeniPass34!'

let k: TestKiraci
let o: Oturum
let uzman: Oturum
let musteriId: string
let uzmanEposta: string
let uzmanParola: string
let tamamlanacakId: string

async function json<T>(r: { status(): number; text(): Promise<string>; json(): Promise<unknown> }): Promise<T> {
  expect(r.status(), await r.text()).toBeLessThan(300)
  return (await r.json()) as T
}

const liste = <T>(r: { data?: T[] } | T[]): T[] => (Array.isArray(r) ? r : (r.data ?? []))

test.beforeAll(async ({ browser }, info) => {
  k = await kiraciKur('duman')
  const veri = await randevuVerisiKur(k)
  uzmanEposta = veri.uzmanEposta
  uzmanParola = veri.uzmanParola
  musteriId = veri.musteri.id
  const randevu = async (saatZ: string, hedef: 'tamam' | 'surer') => {
    const a = await json<{ id: string }>(
      await k.api.post(k.yol('/appointments'), {
        data: { customerId: veri.musteri.id, serviceId: veri.hizmet.id, staffId: veri.uzman.id, startAt: new Date(`${bugun}T${saatZ}:00Z`).toISOString() },
      }),
    )
    await json(await k.api.patch(k.yol(`/appointments/${a.id}/status`), { data: { status: 'confirmed' } }))
    if (hedef === 'tamam') await json(await k.api.patch(k.yol(`/appointments/${a.id}/status`), { data: { status: 'completed', paymentMethod: 'cash' } }))
    else await json(await k.api.patch(k.yol(`/appointments/${a.id}/status`), { data: { status: 'in_progress' } }))
    return a.id
  }
  // Sahip kartta tutarı görsün diye tamamlanmış ücretli randevu; arayüzden ödeme alınacak bir de başlamış randevu.
  await randevu('06:00', 'tamam')
  tamamlanacakId = await randevu('07:00', 'surer')
  await json(await k.api.post(k.yol('/suppliers'), { data: { name: 'Duman Tedarikçisi' } }))
  o = await yeniOturum(browser, info.project.use.baseURL as string)
  uzman = await yeniOturum(browser, info.project.use.baseURL as string)
})

test.afterAll(async () => {
  await o?.context.close()
  await uzman?.context.close()
})

// /auth hız sınırı (15 dk'da 10) yenilemeyi de sayar: her tam sayfa yüklemesi bir yenileme isteğidir. Oturum açıldıktan sonra
// ekranlar uygulamanın kendi yönlendiricisiyle (istemci tarafı gezinme) açılır; yönlendirici yoksa tam yüklemeye düşülür.
const gec = async (page: Page, yol: string) => {
  const gitti = await page.evaluate((u) => {
    const yonlendirici = (window as unknown as { next?: { router?: { push(u: string): void } } }).next?.router
    if (!yonlendirici) return false
    yonlendirici.push(u)
    return true
  }, yol).catch(() => false)
  if (!gitti) return void (await page.goto(yol))
  await page.waitForURL((u) => u.pathname + u.search === yol)
}

const ac = async (page: Page, yol: string) => {
  await gec(page, `/panel/${k.slug}/${yol}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

const kutu = (page: Page): Locator => page.getByRole('dialog')
const toast = (page: Page, metin: string) => expect(page.getByText(metin, { exact: true }).last()).toBeVisible()

/** Açılır listede metni içeren seçeneği seçer (seçenek metni rol/ek bilgi taşıyabilir). */
async function sec(alan: Locator, icerir: string) {
  // Seçenekler API'den gelir: yüklenene kadar koşul beklenir (sabit bekleme yok).
  const metinler = () => alan.locator('option').allTextContents()
  await expect.poll(async () => (await metinler()).some((m) => m.includes(icerir)), { message: `seçenek: ${icerir}` }).toBe(true)
  const bulunan = (await metinler()).find((m) => m.includes(icerir))
  await alan.selectOption({ label: bulunan as string })
}

test('duman sahip: Müşteriler listesi gelir, Yeni müşteri eklenir, Müşteri kartı toplam harcamayı gösterir', async () => {
  const { page } = o
  await genislikAyarla(page, 1440, 900)
  await girisYap(page, k.email, k.password, new RegExp(`/panel/${k.slug}/bugun`))
  await ac(page, 'musteriler')
  await expect(page.getByText('Test Müşterisi').first()).toBeVisible()
  await gec(page, `/panel/${k.slug}/musteri-yeni`)
  const ad = `Duman Müşteri ${Date.now().toString(36)}`
  await page.getByLabel('Ad soyad').fill(ad)
  await page.getByLabel('Telefon').fill(telefon())
  await page.getByRole('button', { name: /^Müşteri ekle$/i }).click()
  await expect
    .poll(async () => liste<{ fullName: string }>(await json(await k.api.get(k.yol(`/customers?search=${encodeURIComponent(ad)}`)))).some((m) => m.fullName === ad), {
      message: 'yeni müşteri sunucuda',
    })
    .toBe(true)
  await ac(page, `musteri/${musteriId}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Test Müşterisi' })).toBeVisible()
  await expect(page.getByText(/Toplam harcama/i).first(), 'sahip toplam harcamayı görür').toBeVisible()
})

test('duman sahip: Hizmetler listesi gelir ve yeni hizmet eklenir', async () => {
  const { page } = o
  await ac(page, 'hizmetler')
  await expect(page.getByText('Test Saç Kesimi').first()).toBeVisible()
  await page.getByRole('button', { name: /^Hizmet ekle$/ }).first().click()
  const d = kutu(page)
  await d.getByLabel('Ad', { exact: true }).fill('Duman Fön')
  await d.getByLabel('Süre (dk)', { exact: true }).fill('20')
  await d.getByLabel('Fiyat (₺)').fill('75')
  await d.getByRole('button', { name: 'Hizmet ekle' }).click()
  await toast(page, 'Hizmet eklendi.')
  await expect(page.getByText('Duman Fön').first()).toBeVisible()
})

test('duman sahip: Personel listesi gelir ve personel davet edilir', async () => {
  const { page } = o
  await ac(page, 'personel')
  await expect(page.getByRole('list', { name: 'Personel' }).getByText('Test Uzmanı')).toBeVisible()
  await page.getByRole('button', { name: 'Personel davet et' }).click()
  const d = kutu(page)
  await d.getByLabel('Ad soyad').fill('Duman Davetli')
  await d.getByLabel('E-posta').fill(`davetli-${Date.now().toString(36)}@e2e.test.local`)
  await d.getByRole('button', { name: 'Daveti gönder' }).click()
  await expect(page.getByLabel('Davet bağlantısı')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Bekleyen davetler' }).getByText('Duman Davetli')).toBeVisible()
})

test('duman sahip: Bekleme listesine kayıt eklenir', async () => {
  const { page } = o
  await ac(page, 'bekleme')
  await expect(page.getByRole('heading', { level: 1, name: 'Bekleme listesi' })).toBeVisible()
  await page.getByRole('button', { name: 'Listeye ekle' }).first().click()
  const d = kutu(page)
  await d.getByLabel('Müşteri ara').fill('Test Müşt')
  await d.getByRole('list', { name: 'Müşteri sonuçları' }).getByRole('button', { name: 'Test Müşterisi' }).click()
  await d.getByRole('button', { name: 'Listeye ekle' }).click()
  await toast(page, 'Listeye eklendi.')
  await expect(page.getByRole('list', { name: 'Açık kayıtlar' }).getByText('Test Müşterisi')).toBeVisible()
})

test('duman sahip: Hesaplar ekranında hesap eklenir', async () => {
  const { page } = o
  await ac(page, 'hesaplar')
  await page.getByRole('button', { name: 'Hesap ekle' }).first().click()
  const d = kutu(page)
  await d.getByLabel('Hesap adı').fill('Duman Kasası')
  await d.getByRole('button', { name: 'Hesap ekle' }).click()
  await toast(page, 'Hesap eklendi.')
  await expect(page.getByRole('list', { name: 'Hesaplar' }).getByText('Duman Kasası')).toBeVisible()
})

test('duman sahip: Stok ekranında ürün eklenir', async () => {
  const { page } = o
  await ac(page, 'stok')
  await page.getByRole('button', { name: 'Ürün ekle' }).first().click()
  const d = kutu(page)
  await d.getByLabel('Ürün adı').fill('Duman Şampuanı')
  await d.getByLabel('Başlangıç miktarı').fill('5')
  await d.getByLabel('Birim maliyet (₺)').fill('10')
  await d.getByRole('button', { name: 'Ürün ekle' }).click()
  await toast(page, 'Ürün eklendi.')
  await expect(page.getByRole('list', { name: 'Ürünler' }).getByText('Duman Şampuanı').first()).toBeVisible()
})

test('duman sahip: Faturalar ekranında taslak alış faturası kaydedilir', async () => {
  const { page } = o
  await ac(page, 'faturalar')
  await page.getByRole('button', { name: 'Fatura ekle' }).first().click()
  const d = kutu(page)
  await sec(d.getByLabel('Tedarikçi'), 'Duman Tedarikçisi')
  await d.getByLabel('Fatura numarası').fill('DMN-001')
  await d.getByLabel('Kalem 1 adı', { exact: true }).fill('Duman Kalemi')
  await d.getByLabel('Kalem 1 adet', { exact: true }).fill('2')
  await d.getByLabel('Kalem 1 birim fiyat (₺)', { exact: true }).fill('50')
  await d.getByRole('button', { name: 'Taslak olarak kaydet' }).click()
  await toast(page, 'Taslak kaydedildi.')
  await expect(page.getByRole('list', { name: 'Alış faturaları' }).getByText(/DMN-001|Duman Tedarikçisi/).first()).toBeVisible()
})

test('duman sahip: Paketler ekranında paket eklenir', async () => {
  const { page } = o
  await ac(page, 'paketler')
  await page.getByRole('button', { name: 'Paket ekle' }).first().click()
  const d = kutu(page)
  await sec(d.getByLabel('Hizmet', { exact: true }), 'Test Saç Kesimi')
  await d.getByLabel('Paket adı').fill('Duman Paketi')
  await d.getByLabel('Seans sayısı').fill('5')
  await d.getByLabel('Paket fiyatı (₺)').fill('400')
  await d.getByRole('button', { name: 'Paket ekle' }).click()
  await expect(page.getByRole('list', { name: 'Paketler' }).getByText('Duman Paketi')).toBeVisible()
})

test('duman sahip: Personel ödemeleri ekranında ödeme kaydı eklenir', async () => {
  const { page } = o
  await ac(page, 'odemeler')
  await page.getByRole('button', { name: 'Ödeme ekle' }).first().click()
  const d = kutu(page)
  await sec(d.getByLabel('Personel', { exact: true }), 'Test Uzmanı')
  await d.getByLabel('Dönem başı').fill(haftaOnce)
  await d.getByLabel('Dönem sonu').fill(bugun)
  await expect(d.getByText('Ödenecek net tutar')).toBeVisible()
  await d.getByRole('button', { name: 'Ödeme kaydı ekle' }).click()
  await toast(page, 'Ödeme kaydı eklendi.')
  await expect(page.getByRole('list', { name: 'Personel ödemeleri' }).getByText('Test Uzmanı').first()).toBeVisible()
})

test('duman sahip: Bahşiş ekranında bahşiş kaydedilir', async () => {
  const { page } = o
  await ac(page, 'bahsis')
  await page.getByRole('button', { name: 'Bahşiş ekle' }).first().click()
  const d = kutu(page)
  await d.getByLabel('Tutar (₺)').fill('25')
  await sec(d.getByLabel('Personel', { exact: true }), 'Test Uzmanı')
  await d.getByRole('button', { name: 'Bahşişi kaydet' }).click()
  await toast(page, 'Bahşiş eklendi.')
  await expect(page.getByRole('list', { name: 'Bahşiş kayıtları' }).getByRole('listitem').first()).toBeVisible()
})

test('duman sahip: Ayarlar bölümleri gelir, Salon bilgileri kaydedilir', async () => {
  const { page } = o
  await ac(page, 'ayarlar')
  await expect(page.getByText(YETKI_YOK), 'sahipte Ayarlar yetki yok göstermez').toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Ayar bölümleri' }).getByText('Salon bilgileri')).toBeVisible()
  await ac(page, 'ayarlar/salon')
  await page.getByLabel('Adres').fill(`Duman Sokak No ${Date.now().toString(36)}`)
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click()
  await toast(page, 'Salon bilgileri kaydedildi.')
})

test('duman sahip (H2): takvim?randevu= bağlantısı Randevu ayrıntısını açar', async () => {
  const { page } = o
  await page.goto(`/panel/${k.slug}/takvim?randevu=${tamamlanacakId}`)
  await expect(page.getByRole('dialog', { name: 'Randevu ayrıntısı' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Randevu ayrıntısı' })).toHaveCount(0)
})

test('duman sahip: Tamamla ve ödeme al, başlamış randevuyu tamamlar', async () => {
  const { page } = o
  // Not: Bugün/Günüm `takvim?randevu=<id>` bağlantısına yönlendirir ama Takvim bu parametreyi okumaz (ayrı hata, raporda); pencere ızgaradan açılır.
  await ac(page, 'takvim')
  await page.getByRole('group', { name: 'Günlük takvim' }).getByRole('button', { name: /10:00 Test Müşterisi/ }).click()
  const detay = page.getByRole('dialog', { name: 'Randevu ayrıntısı' })
  await expect(detay).toBeVisible()
  await detay.getByRole('button', { name: 'Tamamla ve ödeme al', exact: true }).click()
  const odeme = page.getByRole('dialog', { name: 'Tamamla ve ödeme al' })
  await expect(odeme).toBeVisible()
  await odeme.getByRole('button', { name: /^Ödeme al/ }).click()
  await toast(page, 'Ödeme alındı.')
  await expect
    .poll(async () => {
      const r = liste<{ id: string; status: string }>(await json(await k.api.get(k.yol(`/appointments?date=${bugun}`))))
      return r.find((x) => x.id === tamamlanacakId)?.status
    }, { message: 'randevu tamamlandı' })
    .toBe('completed')
})

test('duman sahip: Randevusuz işlem tahsilatı kaydedilir', async () => {
  const { page } = o
  await ac(page, 'bugun')
  await page.getByRole('button', { name: 'Randevusuz işlem' }).click()
  const d = kutu(page)
  await d.getByLabel('Açıklama').fill('Duman ürün satışı')
  await d.getByLabel('Tutar (₺)').fill('50')
  await d.getByRole('button', { name: /^Ödeme al/ }).click()
  await toast(page, 'Ödeme alındı.')
})

test('duman sahip: Raporlar bugünün tahsilatını gösterir', async () => {
  const { page } = o
  await ac(page, 'raporlar')
  await expect(page.getByRole('heading', { level: 1, name: 'Raporlar' })).toBeVisible()
  await expect(page.getByText('Bu dönemde tahsilat yok.'), 'ödemeler alındı, rapor boş olmamalı').toHaveCount(0)
  await expect(page.getByText(/Tahsilat/).first()).toBeVisible()
})

test('duman sahip: Kasa açılır ve gün kapatılır', async () => {
  const { page } = o
  await ac(page, 'kasa')
  await expect(page.getByRole('heading', { level: 1, name: 'Kasa' })).toBeVisible()
  await page.getByRole('button', { name: 'Günü kapat' }).first().click()
  const d = kutu(page)
  await d.getByLabel('Sayılan nakit (₺)').fill('250')
  await d.getByLabel('Not').fill('Duman testi')
  await d.getByRole('button', { name: 'Günü kapat' }).click()
  await toast(page, 'Gün sonu kaydedildi.')
})

test('duman rol kapıları: uzman Müşteri kartında tutar görmez; Ayarlar, Stok ve Kasa yetki yok', async () => {
  const { page } = uzman
  await genislikAyarla(page, 1440, 900)
  await girisYap(page, uzmanEposta, uzmanParola, new RegExp(`/panel/${k.slug}/gunum`))
  await gec(page, `/panel/${k.slug}/musteri/${musteriId}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Test Müşterisi' })).toBeVisible()
  await expect(page.getByText(/Toplam harcama/i), 'uzman toplam harcama görmez').toHaveCount(0)
  await expect(page.getByRole('main').getByText(/₺/), 'uzman karttaki hiçbir tutarı görmez').toHaveCount(0)
  for (const yol of ['ayarlar', 'stok', 'kasa']) {
    await gec(page, `/panel/${k.slug}/${yol}`)
    await expect(page.getByText(YETKI_YOK), `uzman ${yol} yetki yok`).toBeVisible()
  }
  await gec(page, `/panel/${k.slug}/primim`)
  await expect(page.getByRole('heading', { level: 1, name: 'Primim' })).toBeVisible()
})

test('duman rol kapıları (API): uzman Ayarlar, Stok ve Kasa uçlarında 403 alır, müşteri yanıtında tutar yok', async () => {
  const giris = await o.context.request.post(`${process.env.E2E_API_URL}/api/v1/auth/login`, { data: { email: uzmanEposta, password: uzmanParola } })
  expect(giris.status(), await giris.text()).toBe(200)
  const { token } = (await giris.json()) as { token: string }
  const baslik = { Authorization: `Bearer ${token}` }
  const musteri = await o.context.request.get(`${process.env.E2E_API_URL}${k.yol(`/customers/${musteriId}`)}`, { headers: baslik })
  expect(musteri.status()).toBe(200)
  const govde = await musteri.text()
  expect(govde, 'uzman yanıtında lifetimeValue yok').not.toContain('lifetimeValue')
  expect(govde, 'uzman yanıtında priceCharged yok').not.toContain('priceCharged')
  const url = (yol: string) => `${process.env.E2E_API_URL}${k.yol(yol)}`
  // Olumlu eş: aynı uçlar sahip için 200 (yetki yokluğundan başka bir nedenle reddedilmediğini gösterir).
  const sahipBaslik = { Authorization: `Bearer ${k.token}` }
  for (const yol of ['/inventory', `/finance/day-status?date=${bugun}`]) {
    const olumlu = await o.context.request.get(url(yol), { headers: sahipBaslik })
    expect(olumlu.status(), `sahip ${yol}: ${await olumlu.text()}`).toBe(200)
    const r = await o.context.request.get(url(yol), { headers: baslik })
    expect(r.status(), `uzman ${yol}: ${await r.text()}`).toBe(403)
  }
  const ayar = await o.context.request.patch(url('/settings'), { headers: baslik, data: { address: 'Uzman Sokak' } })
  expect(ayar.status(), `uzman PATCH /settings: ${await ayar.text()}`).toBe(403)
})

test('duman: konsolda hata yok (bilerek yetkisiz ekranlar hariç sunucu 403/404 satırları süzülür)', () => {
  expect.soft(o.konsol.filter((s) => !/status of (403|404)/.test(s)), 'konsol (sahip)').toEqual([])
  expect.soft(uzman.konsol.filter((s) => !/status of (403|404)/.test(s)), 'konsol (uzman)').toEqual([])
})

// Son test: şifre değişince oturumlar kapanır, sonrasında başka adım yok.
test('duman sahip: Hesabım açılır ve şifre değiştirilir', async () => {
  const { page } = o
  await ac(page, 'hesabim')
  await expect(page.getByRole('heading', { level: 1, name: 'Hesabım' })).toBeVisible()
  await page.getByLabel('Mevcut şifre').fill(k.password)
  await page.getByLabel('Yeni şifre', { exact: true }).fill(YENI_SIFRE)
  await page.getByLabel('Yeni şifre (tekrar)').fill(YENI_SIFRE)
  await page.getByRole('button', { name: 'Şifreyi değiştir' }).click()
  // Şifre değişince oturum kapanır ve giriş ekranına dönülür (bildirim metni bu geçişte görünmeyebilir): sonuç yeni şifreyle girişle doğrulanır.
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
  const yeniGiris = await o.context.request.post(`${process.env.E2E_API_URL}/api/v1/auth/login`, { data: { email: k.email, password: YENI_SIFRE } })
  expect(yeniGiris.status(), await yeniGiris.text()).toBe(200)
})
