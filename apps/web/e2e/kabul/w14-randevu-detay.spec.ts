import { expect, test, type Locator } from '@playwright/test'
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

// W14 görsel kabul: Randevu ayrıntısı. İptal, Gelmedi ve Sil onay penceresiyle; kilitli (kapanmış/başlamış) randevuda eylem yok;
// uzman confirmed randevuda İptal görür, Sil ve ücret görmez. Randevular "bugün" (İstanbul) 09:00'dan itibaren 35 dk arayla
// sabit saatlere kurulur (günün saatinden bağımsız; gece yarısı sınırı sorunu ve atlama yok).
// Bütçe: /auth 10 istek/15 dk: bu dosya 1 kayıt + 2 giriş yapar.
test.skip(!PANEL_ACIK || !ayniSiteHazir(), ATLAMA_NEDENI)
test.describe.configure({ mode: 'serial', timeout: 120_000 })

const TZ = 'Europe/Istanbul'
const bugunTarihi = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
// Türkiye yıl boyu UTC+3: İstanbul 09:00 = 06:00Z.
const bugunSaat09 = (dk: number) => new Date(Date.parse(`${bugunTarihi}T06:00:00Z`) + dk * 60_000).toISOString()
const telefon = () => `0555${Math.floor(1000000 + Math.random() * 8999999)}`

let k: TestKiraci
let o: Oturum
let uzman: Oturum
let uzmanEposta: string
let uzmanParola: string
const ids: Record<string, string> = {}
const axeBulgulari: string[] = []

async function json<T>(r: { status(): number; text(): Promise<string>; json(): Promise<unknown> }): Promise<T> {
  expect(r.status(), await r.text()).toBeLessThan(300)
  return (await r.json()) as T
}

async function durum(ad: string): Promise<string | undefined> {
  const gun = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const r = await json<{ data?: Array<{ id: string; status: string }> } | Array<{ id: string; status: string }>>(await k.api.get(k.yol(`/appointments?date=${gun}`)))
  const dizi = Array.isArray(r) ? r : (r.data ?? [])
  return dizi.find((x) => x.id === ids[ad])?.status
}

function detay(page: Oturum['page']): Locator {
  return page.getByRole('dialog', { name: 'Randevu ayrıntısı' })
}

async function ac(page: Oturum['page'], musteriAdi: string): Promise<Locator> {
  const izgara = page.getByRole('group', { name: 'Günlük takvim' })
  await expect(izgara).toBeVisible()
  await izgara.getByRole('button', { name: new RegExp(musteriAdi) }).click()
  const d = detay(page)
  await expect(d).toBeVisible()
  await expect(d.getByText(musteriAdi, { exact: true })).toBeVisible()
  return d
}

test.beforeAll(async ({ browser }, info) => {
  k = await kiraciKur('w14')
  const veri = await randevuVerisiKur(k)
  uzmanEposta = veri.uzmanEposta
  uzmanParola = veri.uzmanParola
  const randevu = async (ad: string, dk: number, uzmanId: string, hedef: string) => {
    const m = await json<{ id: string }>(await k.api.post(k.yol('/customers'), { data: { fullName: ad, phone: telefon() } }))
    const a = await json<{ id: string }>(
      await k.api.post(k.yol('/appointments'), { data: { customerId: m.id, serviceId: veri.hizmet.id, staffId: uzmanId, startAt: bugunSaat09(dk) } }),
    )
    const onay = await k.api.patch(k.yol(`/appointments/${a.id}/status`), { data: { status: 'confirmed' } })
    expect(onay.status(), await onay.text()).toBeLessThan(300)
    ids[hedef] = a.id
  }
  // Aynı uzmanda çakışmasın diye 35 dk arayla.
  await randevu('Müşteri İptal', 0, veri.uzman.id, 'iptal')
  await randevu('Müşteri Gelmedi', 35, veri.uzman.id, 'gelmedi')
  await randevu('Müşteri Sil', 70, veri.uzman.id, 'sil')
  await randevu('Müşteri Başlat', 105, veri.uzman.id, 'baslat')
  await randevu('Müşteri Kilitli', 140, veri.uzman.id, 'kilitli')
  // Kilitli: tamamlanmış randevu (doğrudan ya da başlatıp tamamlayarak).
  let tamam = await k.api.patch(k.yol(`/appointments/${ids.kilitli}/status`), { data: { status: 'completed' } })
  if (tamam.status() >= 300) {
    await json(await k.api.patch(k.yol(`/appointments/${ids.kilitli}/status`), { data: { status: 'in_progress' } }))
    tamam = await k.api.patch(k.yol(`/appointments/${ids.kilitli}/status`), { data: { status: 'completed' } })
  }
  expect(tamam.status(), await tamam.text()).toBeLessThan(300)

  o = await yeniOturum(browser, info.project.use.baseURL as string)
  uzman = await yeniOturum(browser, info.project.use.baseURL as string)
})

test.afterAll(async () => {
  await o?.context.close()
  await uzman?.context.close()
})

test('W14: takvimde randevuya basınca ayrıntı açılır; bilgi, Ara ve WhatsApp bağlantıları, durum eylemleri görünür', async () => {
  const { page } = o
  await genislikAyarla(page, 1440, 900)
  await girisYap(page, k.email, k.password, new RegExp(`/panel/${k.slug}/bugun`))
  await page.goto(`/panel/${k.slug}/takvim`)
  const d = await ac(page, 'Müşteri İptal')
  await expect(d.getByText('Test Saç Kesimi')).toBeVisible()
  await expect(d.getByText('Ücret')).toBeVisible()
  const ara = d.getByRole('link', { name: /^Ara:/ })
  expect(await ara.getAttribute('href')).toMatch(/^tel:/)
  const wa = d.getByRole('link', { name: /^WhatsApp:/ })
  expect(await wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/90\d{10}$/)
  for (const ad of ['Başlat', 'Saati değiştir', 'Gelmedi', 'İptal et', 'Sil']) {
    await expect(d.getByRole('button', { name: ad, exact: true }), `${ad} eylemi`).toBeVisible()
  }
  await ekranGoruntusu(page, 'w14-detay-1440')
  expect(await yatayTasma(page)).toBeLessThanOrEqual(0)
  await expectNoSeriousA11yViolations(page, 'W14 ayrıntı 1440').catch((e: Error) => {
    axeBulgulari.push(e.message.split('\n').filter((s) => /kural|etki|dugumSayisi|ornek|\.|\[|axe ihlalleri/.test(s)).slice(0, 30).join('\n'))
  })
})

test('W14 iptal: onay penceresi çıkar, vazgeçince durum değişmez, onaylayınca randevu iptal olur', async () => {
  const { page } = o
  const d = detay(page)
  await d.getByRole('button', { name: 'İptal et', exact: true }).click()
  const onay = page.getByRole('alertdialog', { name: 'Randevuyu iptal etmek istiyor musunuz?' })
  await expect(onay).toBeVisible()
  expect(await durum('iptal'), 'onaydan önce durum değişmedi').toBe('confirmed')
  await page.keyboard.press('Escape')
  await expect(onay).toBeHidden()
  expect(await durum('iptal'), 'vazgeçince durum değişmedi').toBe('confirmed')

  await d.getByRole('button', { name: 'İptal et', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Randevuyu iptal et' }).click()
  await expect(page.getByText('Randevu iptal edildi.', { exact: true }).last()).toBeVisible()
  await expect(detay(page)).toBeHidden()
  expect(await durum('iptal')).toBe('cancelled')
})

test('W14 gelmedi: onay penceresi çıkar, onaylayınca "no_show" olur; sonra randevu kilitlidir', async () => {
  const { page } = o
  const d = await ac(page, 'Müşteri Gelmedi')
  await d.getByRole('button', { name: 'Gelmedi', exact: true }).click()
  const onay = page.getByRole('alertdialog', { name: 'Müşteri gelmedi olarak işaretlensin mi?' })
  await expect(onay).toBeVisible()
  expect(await durum('gelmedi'), 'onaydan önce durum değişmedi').toBe('confirmed')
  await onay.getByRole('button', { name: 'Gelmedi olarak işaretle' }).click()
  await expect(page.getByText(/Gelmedi.* olarak işaretlendi\./).last()).toBeVisible()
  expect(await durum('gelmedi')).toBe('no_show')

  const tekrar = await ac(page, 'Müşteri Gelmedi')
  await expect(tekrar.getByText('Bu randevu kapandı; artık değiştirilemez.')).toBeVisible()
  for (const ad of ['Başlat', 'Saati değiştir', 'Gelmedi', 'İptal et', 'Sil']) {
    await expect(tekrar.getByRole('button', { name: ad, exact: true }), `kilitli randevuda ${ad} görünmemeli`).toHaveCount(0)
  }
  await page.keyboard.press('Escape')
})

test('W14 sil: onay penceresi çıkar, onaylayınca randevu takvimden ve listeden kalkar', async () => {
  const { page } = o
  const d = await ac(page, 'Müşteri Sil')
  await d.getByRole('button', { name: 'Sil', exact: true }).click()
  const onay = page.getByRole('alertdialog', { name: 'Randevuyu silmek istiyor musunuz?' })
  await expect(onay).toBeVisible()
  expect(await durum('sil'), 'onaydan önce silinmedi').toBe('confirmed')
  await onay.getByRole('button', { name: 'Randevuyu sil' }).click()
  await expect(page.getByText('Randevu silindi.', { exact: true }).last()).toBeVisible()
  expect(await durum('sil'), 'listeden kalktı').toBeUndefined()
  await expect(page.getByRole('group', { name: 'Günlük takvim' }).getByRole('button', { name: /Müşteri Sil/ })).toHaveCount(0)
})

// Uzman kontrolü, eylemlerin göründüğü "confirmed" randevuda (Müşteri Başlat henüz başlamadı) yapılır: aksi halde başlamış/kilitli randevuda
// eylem listesi herkese boş döner ve "Sil yok" rol kuralını değil durumu sınar (T4-4 Kritik 1). Önce olumlu kontrol, sonra Sil yokluğu.
test('W14 yetki: uzman, eylemleri görünen randevuda İptal et görür ama Sil ve ücret görmez', async () => {
  const { page } = uzman
  await genislikAyarla(page, 1440, 900)
  await girisYap(page, uzmanEposta, uzmanParola, new RegExp(`/panel/${k.slug}/gunum`))
  await page.goto(`/panel/${k.slug}/takvim`)
  const izgara = page.getByRole('group', { name: 'Günlük takvim' })
  await expect(izgara).toBeVisible()
  await izgara.getByRole('button', { name: /Müşteri Başlat/ }).click()
  const d = detay(page)
  await expect(d).toBeVisible()
  expect(await durum('baslat'), 'kontrol randevusu henüz başlamamış olmalı').toBe('confirmed')
  await expect(d.getByRole('button', { name: 'İptal et', exact: true }), 'uzman eylem görür (eylem yok ile yetki yok ayrılır)').toBeVisible()
  await expect(d.getByRole('button', { name: 'Başlat', exact: true }), 'uzman Başlat görür').toBeVisible()
  await expect(d.getByRole('button', { name: 'Sil', exact: true }), 'uzman silemez').toHaveCount(0)
  await expect(d.getByText('Ücret'), 'uzman ücret görmez').toHaveCount(0)
})

test('W14 başlat: randevu "in_progress" olur; başlamış randevuda eylem görünmez', async () => {
  const { page } = o
  const d = await ac(page, 'Müşteri Başlat')
  await d.getByRole('button', { name: 'Başlat', exact: true }).click()
  await expect(page.getByText('Randevu başladı.', { exact: true }).last()).toBeVisible()
  expect(await durum('baslat')).toBe('in_progress')
  const tekrar = await ac(page, 'Müşteri Başlat')
  for (const ad of ['Başlat', 'Saati değiştir', 'Gelmedi', 'İptal et', 'Sil']) {
    await expect(tekrar.getByRole('button', { name: ad, exact: true }), `başlamış randevuda ${ad}`).toHaveCount(0)
  }
  await page.keyboard.press('Escape')
})

test('W14 kilitli: tamamlanmış randevuda hiçbir eylem görünmez', async () => {
  const { page } = o
  const d = await ac(page, 'Müşteri Kilitli')
  await expect(d.getByText('Bu randevu kapandı; artık değiştirilemez.')).toBeVisible()
  for (const ad of ['Başlat', 'Saati değiştir', 'Gelmedi', 'İptal et', 'Sil']) {
    await expect(d.getByRole('button', { name: ad, exact: true }), `tamamlanmış randevuda ${ad}`).toHaveCount(0)
  }
  await page.keyboard.press('Escape')
})

test('W14 telefon (390 px): ayrıntı katmanı sığar, taşma yok', async () => {
  const { page } = o
  await genislikAyarla(page, 390, 844)
  await page.goto(`/panel/${k.slug}/takvim`)
  const cizelge = page.getByRole('region', { name: 'Saat çizelgesi' })
  await expect(cizelge).toBeVisible()
  await cizelge.getByText('Müşteri Kilitli').first().click()
  await expect(detay(page)).toBeVisible()
  await ekranGoruntusu(page, 'w14-detay-390')
  expect(await yatayTasma(page)).toBeLessThanOrEqual(0)
  await expectNoSeriousA11yViolations(page, 'W14 ayrıntı 390').catch((e: Error) => {
    axeBulgulari.push(e.message.split('\n').filter((s) => /kural|etki|dugumSayisi|ornek|\.|\[|axe ihlalleri/.test(s)).slice(0, 30).join('\n'))
  })
})

// Serinin son testi: birikmiş ölçümler birlikte hükme bağlanır.
test('W14 UI-DoD: ciddi axe ihlali yok, konsolda hata yok', () => {
  expect.soft(axeBulgulari, 'axe ihlalleri').toEqual([])
  expect.soft(o.konsol, 'konsol hataları (yönetici)').toEqual([])
  expect.soft(uzman.konsol, 'konsol hataları (uzman)').toEqual([])
})
