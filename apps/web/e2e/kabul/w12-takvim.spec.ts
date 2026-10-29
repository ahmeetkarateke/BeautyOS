import { expect, test } from '@playwright/test'
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

// W12 görsel kabul: Takvim. Masaüstünde gün, hafta, ay; telefonda gün. Hizmeti kaldırılmış ve silinmiş personelin
// randevusu görünür kalır; personel listesi hatasında "Yeniden dene" çıkar ve düzelir; uzman yalnız kendi takvimini görür.
// Randevular "bugün" (İstanbul) 09:00'dan itibaren sabit saatlere kurulur: günün saatinden bağımsızdır, atlanmaz.
// Bütçe: /auth 10 istek/15 dk: bu dosya 1 kayıt + 2 giriş yapar.
test.skip(!PANEL_ACIK || !ayniSiteHazir(), ATLAMA_NEDENI)
// Takvim sayfaları ağır (1440 px tam sayfa görüntü + axe) ve sunucu 2 vCPU: test başına süre sınırı geniş tutulur; beklemeler koşulludur.
test.describe.configure({ mode: 'serial', timeout: 120_000 })

const TZ = 'Europe/Istanbul'
const bugunTarihi = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
// Günün saatinden bağımsız (atlama yok): İstanbul bugün 09:00 + dk. Türkiye yıl boyu UTC+3: 09:00 = 06:00Z. API panel için geçmiş saati kabul eder (W13-G1).
const dakikaSonra = (dk: number) => new Date(Date.parse(`${bugunTarihi}T06:00:00Z`) + dk * 60_000).toISOString()
const rastgeleTelefon = () => `0555${Math.floor(1000000 + Math.random() * 8999999)}`

let k: TestKiraci
let o: Oturum
let uzman: Oturum
let uzmanEposta: string
const axeBulgulari: string[] = []

async function json<T>(r: { status(): number; text(): Promise<string>; json(): Promise<unknown> }): Promise<T> {
  expect(r.status(), await r.text()).toBeLessThan(300)
  return (await r.json()) as T
}

// Ekran görüntüsü, yatay taşma ve axe ölçümü; ihlal fırlatılmaz (serial kip kalan testleri atlatır), serinin sonunda hükme bağlanır.
async function olc(page: Oturum['page'], ad: string) {
  await ekranGoruntusu(page, ad)
  expect(await yatayTasma(page), `yatay taşma (px): ${ad}`).toBeLessThanOrEqual(0)
  await expectNoSeriousA11yViolations(page, ad).catch((e: Error) => {
    // Yalnız "+" ile başlayan (alınan) satırlar: kural, etki ve düğüm adresleri; JSON gürültüsü kısaltılır.
    axeBulgulari.push(e.message.split('\n').filter((s) => /kural|etki|dugumSayisi|ornek|\.|\[|axe ihlalleri/.test(s)).slice(0, 30).join('\n'))
  })
}

test.beforeAll(async ({ browser }, info) => {
  k = await kiraciKur('w12')
  const veri = await randevuVerisiKur(k)
  uzmanEposta = veri.uzmanEposta
  const hizmet = veri.hizmet

  const personel = async (ad: string) => {
    const s = await json<{ id: string }>(
      await k.api.post(k.yol('/staff'), {
        data: { email: `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.test.local`, password: 'TestPass12!', fullName: ad, title: 'Kuaför' },
      }),
    )
    await json(await k.api.post(k.yol(`/staff/${s.id}/services`), { data: { serviceId: hizmet.id } }))
    return s.id
  }
  const musteri = async (ad: string) => (await json<{ id: string }>(await k.api.post(k.yol('/customers'), { data: { fullName: ad, phone: rastgeleTelefon() } }))).id
  const randevu = async (ad: string, staffId: string, dk: number) => {
    const a = await json<{ id: string }>(
      await k.api.post(k.yol('/appointments'), { data: { customerId: await musteri(ad), serviceId: hizmet.id, staffId, startAt: dakikaSonra(dk) } }),
    )
    await json(await k.api.patch(k.yol(`/appointments/${a.id}/status`), { data: { status: 'confirmed' } }))
  }

  const silinecek = await personel('Silinecek Uzman')
  const hizmetsiz = await personel('Hizmetsiz Uzman')
  // Bugün 4 randevu: Test Uzmanı 2, Silinecek 1, Hizmetsiz 1. Ayrıca yarın ve 3 gün sonra birer randevu (hafta/ay sayımı).
  await randevu('Müşteri A1', veri.uzman.id, 30)
  await randevu('Müşteri A2', veri.uzman.id, 100)
  await randevu('Müşteri B', silinecek, 40)
  await randevu('Müşteri C', hizmetsiz, 50)
  await randevu('Müşteri Yarın', veri.uzman.id, 26 * 60)

  // Randevuları dururken: C'nin hizmet ataması kaldırılır, B silinir.
  const hizmetiKaldir = await k.api.delete(k.yol(`/staff/${hizmetsiz}/services/${hizmet.id}`))
  expect(hizmetiKaldir.status(), await hizmetiKaldir.text()).toBeLessThan(300)
  const sil = await k.api.delete(k.yol(`/staff/${silinecek}`))
  expect(sil.status(), await sil.text()).toBeLessThan(300)

  o = await yeniOturum(browser, info.project.use.baseURL as string)
  uzman = await yeniOturum(browser, info.project.use.baseURL as string)
})

test.afterAll(async () => {
  await o?.context.close()
  await uzman?.context.close()
})

test('W12 masaüstü Gün: giriş sonrası Takvim açılır; silinmiş ve hizmeti kaldırılmış personelin randevusu da ızgarada görünür', async () => {
  const { page } = o
  await genislikAyarla(page, 1440, 900)
  await girisYap(page, k.email, k.password, new RegExp(`/panel/${k.slug}/bugun`))
  await page.goto(`/panel/${k.slug}/takvim`)
  await expect(page.getByRole('heading', { level: 1, name: 'Takvim' })).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Görünüm' })).toBeVisible()
  const izgara = page.getByRole('group', { name: 'Günlük takvim' })
  await expect(izgara).toBeVisible()
  await expect(izgara.locator('[data-event-id]')).toHaveCount(4)
  for (const ad of ['Müşteri A1', 'Müşteri A2', 'Müşteri B', 'Müşteri C']) {
    await expect(izgara.getByRole('button', { name: new RegExp(ad) }), `${ad} ızgarada`).toBeVisible()
  }
  await olc(page, 'w12-takvim-gun-1440')
})

test('W12 masaüstü Hafta: personel ve gün başına sayım tablosu; silinmiş ve hizmeti kaldırılmış personel satırı kaybolmaz', async () => {
  const { page } = o
  await page.getByRole('radio', { name: 'Hafta' }).click()
  await page.waitForURL(/gorunum=hafta/)
  const tablo = page.getByRole('table', { name: /Haftalık özet/ })
  await expect(tablo).toBeVisible()
  for (const ad of ['Test', 'Silinecek', 'Hizmetsiz']) {
    await expect(tablo.getByRole('rowheader', { name: new RegExp(ad) }), `${ad} satırı`).toBeVisible()
  }
  await olc(page, 'w12-takvim-hafta-1440')
})

test('W12 masaüstü Ay: gün hücrelerinde randevu sayısı; hücre o günün Gün görünümüne gider', async () => {
  const { page } = o
  await page.getByRole('radio', { name: 'Ay' }).click()
  await page.waitForURL(/gorunum=ay/)
  const ay = page.getByRole('group', { name: 'Ay görünümü' })
  await expect(ay).toBeVisible()
  const bugunHucre = ay.getByRole('link', { name: /4 randevu$/ })
  await expect(bugunHucre, 'bugünün hücresi 4 randevu sayar').toHaveCount(1)
  await olc(page, 'w12-takvim-ay-1440')
  await bugunHucre.click()
  await page.waitForURL(/tarih=\d{4}-\d{2}-\d{2}/)
  await expect(page.getByRole('group', { name: 'Günlük takvim' })).toBeVisible()
})

test('W12 telefon Gün: saat çizelgesi, gün şeridi ve personel çipleri; görünüm seçici yok, ?gorunum=ay Gün olarak açılır', async () => {
  const { page } = o
  await genislikAyarla(page, 390, 844)
  await page.goto(`/panel/${k.slug}/takvim?gorunum=ay`)
  await expect(page.getByRole('heading', { level: 1, name: 'Takvim' })).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Görünüm' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Gün seçin' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Saat çizelgesi' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Personel' })).toBeVisible()
  const cizelge = page.getByRole('region', { name: 'Saat çizelgesi' })
  for (const ad of ['Müşteri A1', 'Müşteri B', 'Müşteri C']) {
    await expect(cizelge.getByText(ad).first(), `${ad} telefon çizelgesinde`).toBeVisible()
  }
  await olc(page, 'w12-takvim-gun-390')
})

test('W12 hata yolu: personel listesi yüklenemezse "Yeniden dene" çıkar ve basınca takvim gelir', async () => {
  const { page } = o
  await genislikAyarla(page, 1440, 900)
  const konsolOnce = o.konsol.length
  const personelListesi = /\/tenants\/[^/]+\/staff(\?.*)?$/
  // Yalnız bu test sırasında, yalnız personel listesi uç noktasına tarayıcı düzeyinde sunucu hatası verilir.
  await page.route(personelListesi, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL","message":"test"}}' }))
  await page.goto(`/panel/${k.slug}/takvim`)
  await expect(page.getByText(/Personel listesi/).first()).toBeVisible({ timeout: 30_000 })
  const yeniden = page.getByRole('button', { name: 'Yeniden dene' })
  await expect(yeniden).toBeVisible()
  await ekranGoruntusu(page, 'w12-takvim-personel-hatasi-1440')
  await page.unroute(personelListesi)
  await yeniden.click()
  await expect(page.getByRole('group', { name: 'Günlük takvim' })).toBeVisible()
  // Bilerek verilen 500'ün tarayıcı konsol satırları bu kabulün konsol denetimine sayılmaz.
  o.konsol.length = konsolOnce
})

test('W12 yetki: uzman Takvimim\'de yalnız kendi randevularını görür (başkasının müşterisi ekranda yok)', async () => {
  const { page } = uzman
  await genislikAyarla(page, 1440, 900)
  await girisYap(page, uzmanEposta, 'TestPass12!', new RegExp(`/panel/${k.slug}/gunum`))
  await page.goto(`/panel/${k.slug}/takvim`, { waitUntil: 'domcontentloaded' })
  const izgara = page.getByRole('group', { name: 'Günlük takvim' })
  // Tanı: yüklenmezse uzmanın attığı API istekleri ve konsol hatası hata iletisine eklenir.
  await expect(izgara, `uzman takvimi yüklenmedi; istekler: ${uzman.istekler.filter((u) => u.includes('/api/')).slice(-8).join(' | ')}; konsol: ${uzman.konsol.slice(-3).join(' | ')}`).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Takvimim' })).toBeVisible()
  await expect(izgara.locator('[data-event-id]')).toHaveCount(2)
  const metin = await page.locator('body').innerText()
  for (const yabanci of ['Müşteri B', 'Müşteri C']) expect(metin, `${yabanci} uzmanın ekranında`).not.toContain(yabanci)
})

// Serinin son testi: birikmiş ölçümler birlikte hükme bağlanır (soft: biri kalsa da diğeri raporlanır).
test('W12 UI-DoD: üç görünümde ve telefonda ciddi axe ihlali yok, konsolda hata yok', () => {
  expect.soft(axeBulgulari, 'axe ihlalleri').toEqual([])
  expect.soft(o.konsol, 'konsol hataları (yönetici)').toEqual([])
  expect.soft(uzman.konsol, 'konsol hataları (uzman)').toEqual([])
})
