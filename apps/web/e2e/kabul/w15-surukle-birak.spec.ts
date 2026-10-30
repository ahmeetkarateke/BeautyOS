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
  hataBandi,
  yeniOturum,
  type Oturum,
} from '../yardimcilar/panel'

// W15 görsel kabul: Takvimde sürükle-bırak (yalnız masaüstü, fare, dikey, aynı personelin sütunu, 15 dk dilim).
// Uzman yalnız kendi randevusunu taşır; "Geri al" eski saate döner; dolu saate bırakınca (SLOT_TAKEN) randevu yerine döner ve hata çıkar.
// Randevular YARINA, sabit saatlere kurulur: taşınabilirlik "başlangıcı gelmemiş" ister, bu yüzden günün saatinden bağımsızdır (atlama yok).
// 1 saat = 72 px (HOUR_PX). Bütçe: /auth 10 istek/15 dk: bu dosya 1 kayıt + 2 giriş yapar.
test.skip(!PANEL_ACIK || !ayniSiteHazir(), ATLAMA_NEDENI)
test.describe.configure({ mode: 'serial', timeout: 120_000 })

const TZ = 'Europe/Istanbul'
const HOUR_PX = 72
const bugunTarihi = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
// Türkiye yıl boyu UTC+3: gün sınırı sorunu olmasın diye yarın, öğlen 12:00Z (İstanbul 15:00) üstünden hesaplanır.
const yarin = new Date(Date.parse(`${bugunTarihi}T12:00:00Z`) + 24 * 3_600_000).toISOString().slice(0, 10)
const saat = (hhmm: string) => new Date(`${yarin}T${hhmm}:00+03:00`).toISOString()
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

async function baslangic(ad: string): Promise<string | undefined> {
  const r = await json<{ data?: Array<{ id: string; startTime: string }> } | Array<{ id: string; startTime: string }>>(await k.api.get(k.yol(`/appointments?date=${yarin}`)))
  const dizi = Array.isArray(r) ? r : (r.data ?? [])
  const a = dizi.find((x) => x.id === ids[ad])
  return a ? new Date(a.startTime).toISOString() : undefined
}

const izgara = (page: Oturum['page']) => page.getByRole('group', { name: 'Günlük takvim' })
const olay = (page: Oturum['page'], ad: string): Locator => izgara(page).getByRole('button', { name: new RegExp(ad) })

async function yarinaGit(page: Oturum['page']) {
  await page.goto(`/panel/${k.slug}/takvim?tarih=${yarin}`)
  await expect(izgara(page)).toBeVisible()
}

/** Fareyle dikey sürükler (dnd-kit 6 px eşiği geçilir, adım adım hareket). */
async function surukle(page: Oturum['page'], ad: string, dakika: number) {
  const dugme = olay(page, ad)
  await dugme.scrollIntoViewIfNeeded()
  const kutu = await dugme.boundingBox()
  if (!kutu) throw new Error(`${ad} düğmesi çizilmedi`)
  const x = kutu.x + kutu.width / 2
  const y = kutu.y + Math.min(10, kutu.height / 2)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 8, { steps: 3 })
  await page.mouse.move(x, y + (dakika / 60) * HOUR_PX, { steps: 12 })
  await page.mouse.up()
}

test.beforeAll(async ({ browser }, info) => {
  k = await kiraciKur('w15')
  const veri = await randevuVerisiKur(k)
  uzmanEposta = veri.uzmanEposta
  uzmanParola = veri.uzmanParola
  const hizmet = veri.hizmet
  const digerUzman = await json<{ id: string }>(
    await k.api.post(k.yol('/staff'), {
      data: { email: `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.test.local`, password: 'TestPass12!', fullName: 'Diğer Uzman', title: 'Kuaför' },
    }),
  )
  await json(await k.api.post(k.yol(`/staff/${digerUzman.id}/services`), { data: { serviceId: hizmet.id } }))
  const randevu = async (ad: string, staffId: string, hhmm: string, hedef: string, durum: string = 'confirmed') => {
    const m = await json<{ id: string }>(await k.api.post(k.yol('/customers'), { data: { fullName: ad, phone: telefon() } }))
    const a = await json<{ id: string }>(await k.api.post(k.yol('/appointments'), { data: { customerId: m.id, serviceId: hizmet.id, staffId, startAt: saat(hhmm) } }))
    await json(await k.api.patch(k.yol(`/appointments/${a.id}/status`), { data: { status: 'confirmed' } }))
    if (durum === 'completed') await json(await k.api.patch(k.yol(`/appointments/${a.id}/status`), { data: { status: 'completed' } }))
    ids[hedef] = a.id
  }
  await randevu('Müşteri Taşı', veri.uzman.id, '10:00', 'tasi')
  await randevu('Müşteri Dolu', veri.uzman.id, '12:00', 'dolu')
  await randevu('Müşteri Kilitli', veri.uzman.id, '14:00', 'kilitli', 'completed')
  await randevu('Müşteri Diğer', digerUzman.id, '10:00', 'diger')

  o = await yeniOturum(browser, info.project.use.baseURL as string)
  uzman = await yeniOturum(browser, info.project.use.baseURL as string)
})

test.afterAll(async () => {
  await o?.context.close()
  await uzman?.context.close()
})

test('W15 sürükle: randevu aynı personelin sütununda 1 saat aşağı bırakılır; saat 11:00 olur, bildirim çıkar, taşınabilirlik işareti yalnız uygun randevuda', async () => {
  const { page } = o
  await genislikAyarla(page, 1440, 900)
  await girisYap(page, k.email, k.password, new RegExp(`/panel/${k.slug}/bugun`))
  await yarinaGit(page)
  await expect(olay(page, 'Müşteri Taşı')).toHaveAttribute('data-movable', 'true')
  await expect(olay(page, 'Müşteri Kilitli'), 'tamamlanmış randevu taşınamaz').not.toHaveAttribute('data-movable', 'true')
  // Denetçi notu: erişilebilir ad, müşteri adı ile saat arasında boşluk taşır ("Müşteri Taşı10:00" olmamalı).
  await expect(olay(page, 'Müşteri Taşı')).toHaveAccessibleName(/^(10[.:]00\s+Müşteri Taşı|Müşteri Taşı\s+10[.:]00)(\s|,|$)/)
  expect(await baslangic('tasi')).toBe(saat('10:00'))
  await surukle(page, 'Müşteri Taşı', 60)
  await expect(page.getByText(/^Randevu 11[.:]00.* taşındı\.$/).last()).toBeVisible()
  await expect.poll(() => baslangic('tasi'), { message: 'sunucuda yeni saat' }).toBe(saat('11:00'))
  expect(await baslangic('diger'), 'başka personelin randevusu değişmedi').toBe(saat('10:00'))
  await ekranGoruntusu(page, 'w15-tasindi-1440')
})

test('W15 Geri al: bildirimdeki Geri al randevuyu eski saate (10:00) döndürür', async () => {
  const { page } = o
  await page.getByRole('button', { name: 'Geri al' }).last().click()
  await expect(page.getByText('Taşıma geri alındı.', { exact: true }).last()).toBeVisible()
  await expect.poll(() => baslangic('tasi'), { message: 'eski saat' }).toBe(saat('10:00'))
})

test('W15 SLOT_TAKEN: dolu saate (12:00) bırakınca randevu yerine döner ve hata görünür; sunucuda saat değişmez', async () => {
  const { page } = o
  expect(await baslangic('dolu'), 'engelleyen randevu gerçekten var').toBe(saat('12:00'))
  // Konum ızgaranın üstüne göre ölçülür: hata bandı sayfayı aşağı iter, mutlak y yanıltır.
  const goreceli = async () => Math.round(((await olay(page, 'Müşteri Taşı').boundingBox())?.y ?? -1) - ((await izgara(page).boundingBox())?.y ?? 0))
  const once = await goreceli()
  await surukle(page, 'Müşteri Taşı', 120)
  await expect(hataBandi(page), 'hata bandı').toBeVisible({ timeout: 15_000 })
  expect(await baslangic('tasi'), 'sunucuda saat değişmedi').toBe(saat('10:00'))
  await expect.poll(goreceli, { message: 'randevu eski yerine döndü' }).toBe(once)
  await ekranGoruntusu(page, 'w15-slot-dolu-1440')
})

test('W15 yetki: uzman yalnız kendi randevusunu görür ve sürükler; başkasının randevusu takviminde yok', async () => {
  const { page } = uzman
  await genislikAyarla(page, 1440, 900)
  await girisYap(page, uzmanEposta, uzmanParola, new RegExp(`/panel/${k.slug}/gunum`))
  await yarinaGit(page)
  await expect(olay(page, 'Müşteri Taşı')).toBeVisible()
  await expect(olay(page, 'Müşteri Diğer'), 'başka uzmanın randevusu uzmanın takviminde yok').toHaveCount(0)
  // Uzmanın taşıma izni (appointment.reschedule, R3 kurucu kararı) paylaşılan izin tablosundan gelir. Arayüz ile izin aynı karşılığı vermeli:
  // takvim açıklamasındaki "sürükleyerek" cümlesi yalnız izin varken çıkar. İzin varsa uzman kendi randevusunu sürükler; yoksa hiçbir randevu sürüklenemez.
  const izinVar = (await page.getByText(/sürükleyerek/).count()) > 0
  test.info().annotations.push({ type: 'uzman-tasima-izni', description: izinVar ? 'var' : 'yok (R3 izni bu uçta yok)' })
  if (izinVar) {
    await expect(olay(page, 'Müşteri Taşı')).toHaveAttribute('data-movable', 'true')
    await surukle(page, 'Müşteri Taşı', 60)
    await expect.poll(() => baslangic('tasi'), { message: 'uzman kendi randevusunu taşıdı' }).toBe(saat('11:00'))
  } else {
    await expect(page.locator('[data-movable="true"]'), 'izin yokken sürüklenebilir randevu çizilmez').toHaveCount(0)
    await surukle(page, 'Müşteri Taşı', 60).catch(() => undefined)
    expect(await baslangic('tasi'), 'izin yokken sürükleme saati değiştirmez').toBe(saat('10:00'))
  }
  expect(await baslangic('diger'), 'başkasının randevusu değişmedi').toBe(saat('10:00'))
})

test('W15 sahip: başka personelin randevusu da taşınabilir işaretli (olumlu eşleme: sahip her sütunu taşır)', async () => {
  const { page } = o
  await yarinaGit(page)
  await expect(olay(page, 'Müşteri Diğer')).toHaveAttribute('data-movable', 'true')
})

test('W15 telefon (390 px): sürükleme yok; saat çizelgesinde taşınabilir işaret çizilmez, taşma yok', async () => {
  const { page } = o
  await genislikAyarla(page, 390, 844)
  await page.goto(`/panel/${k.slug}/takvim?tarih=${yarin}`)
  await expect(page.getByRole('region', { name: 'Saat çizelgesi' })).toBeVisible()
  await expect(page.locator('[data-movable="true"]')).toHaveCount(0)
  expect(await yatayTasma(page)).toBeLessThanOrEqual(0)
  await expectNoSeriousA11yViolations(page, 'W15 390').catch((e: Error) => {
    axeBulgulari.push(e.message.split('\n').filter((s) => /kural|etki|dugumSayisi|ornek|\.|\[|axe ihlalleri/.test(s)).slice(0, 30).join('\n'))
  })
})

test('W15 UI-DoD: masaüstü ızgarada ciddi axe ihlali yok; konsolda hata yok (bilerek tetiklenen 409 hariç)', async () => {
  const { page } = o
  await genislikAyarla(page, 1440, 900)
  await yarinaGit(page)
  await expectNoSeriousA11yViolations(page, 'W15 1440').catch((e: Error) => {
    axeBulgulari.push(e.message.split('\n').filter((s) => /kural|etki|dugumSayisi|ornek|\.|\[|axe ihlalleri/.test(s)).slice(0, 30).join('\n'))
  })
  expect.soft(axeBulgulari, 'axe ihlalleri').toEqual([])
  // Dolu saate bırakma bilerek 409 üretti: yalnız o tarayıcı satırı süzülür, başka hata gizlenmez.
  const yonetici = o.konsol.filter((s) => !/status of 409/.test(s))
  expect.soft(yonetici, 'konsol hataları (yönetici)').toEqual([])
  expect.soft(uzman.konsol, 'konsol hataları (uzman)').toEqual([])
})
