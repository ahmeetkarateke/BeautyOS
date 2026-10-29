import { expect, request, test, type APIRequestContext } from '@playwright/test'
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

// W11 görsel kabul: uzman hesabıyla Günüm (sıradaki kartı, günün sırası, özet, izinlerim) ve kapsam sınırı.
// Randevular "bugün" (İstanbul) ve şimdiden sonra kurulur; gece geç saatte gün değişir, bu yüzden 22:00'den sonra atlanır.
test.skip(!PANEL_ACIK || !ayniSiteHazir(), ATLAMA_NEDENI)
test.describe.configure({ mode: 'serial' })

const API = process.env.E2E_API_URL as string
const TZ = 'Europe/Istanbul'
const istanbulSaati = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
test.skip(istanbulSaati >= 22, 'İstanbul saati 22:00 sonrası: "bugün" randevuları gün sınırını aşabilir')

const gunBicimi = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const bugun = () => gunBicimi.format(new Date())
const dakikaSonra = (dk: number) => new Date(Date.now() + dk * 60_000).toISOString()
const rastgeleTelefon = () => `0555${Math.floor(1000000 + Math.random() * 8999999)}`
const UZMAN_PAROLA = 'TestPass12!'

let k: TestKiraci
let o: Oturum
const axeBulgulari: string[] = []
let uzmanApi: APIRequestContext
let digerUzmanId: string
let uzmanEposta: string
let birinciRandevuId: string
const birinciTelefon = rastgeleTelefon()

async function json<T>(r: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  expect(r.status(), await r.text()).toBeLessThan(300)
  return (await r.json()) as T
}

test.beforeAll(async ({ browser }, info) => {
  k = await kiraciKur('w11')
  const { hizmet, uzman, uzmanEposta: eposta } = await randevuVerisiKur(k)
  uzmanEposta = eposta

  const diger = await json<{ id: string }>(
    await k.api.post(k.yol('/staff'), {
      data: { email: `diger-${Date.now().toString(36)}@e2e.test.local`, password: UZMAN_PAROLA, fullName: 'Diğer Uzman', title: 'Kuaför' },
    }),
  )
  digerUzmanId = diger.id
  await json(await k.api.post(k.yol(`/staff/${diger.id}/services`), { data: { serviceId: hizmet.id } }))

  const musteri = async (ad: string, telefon: string) => (await json<{ id: string }>(await k.api.post(k.yol('/customers'), { data: { fullName: ad, phone: telefon } }))).id
  const randevu = async (musteriId: string, staffId: string, dk: number) => {
    const a = await json<{ id: string }>(
      await k.api.post(k.yol('/appointments'), { data: { customerId: musteriId, serviceId: hizmet.id, staffId, startAt: dakikaSonra(dk) } }),
    )
    await json(await k.api.patch(k.yol(`/appointments/${a.id}/status`), { data: { status: 'confirmed' } }))
    return a.id
  }
  // Uzman 1: iki randevu. Uzman 2: bir randevu (uzman 1 bunu görmemeli).
  birinciRandevuId = await randevu(await musteri('Müşteri Bir', birinciTelefon), uzman.id, 20)
  await randevu(await musteri('Müşteri Iki', rastgeleTelefon()), uzman.id, 80)
  await randevu(await musteri('Başka Müşteri', rastgeleTelefon()), digerUzmanId, 30)

  // Kapsam denetimi için uzmanın kendi belirteci (1 giriş; /auth bütçesi: giriş 15 dk'da 5).
  const anon = await request.newContext({ baseURL: API })
  const giris = await json<{ token: string }>(await anon.post('/api/v1/auth/login', { data: { email: uzmanEposta, password: UZMAN_PAROLA } }))
  await anon.dispose()
  uzmanApi = await request.newContext({ baseURL: API, extraHTTPHeaders: { Authorization: `Bearer ${giris.token}` } })

  o = await yeniOturum(browser, info.project.use.baseURL as string)
})

test.afterAll(async () => {
  await o?.context.close()
  await uzmanApi?.dispose()
})

test('W11: uzman girince Günüm açılır, yalnız kendi iki randevusu sayılır', async () => {
  const { page } = o
  await girisYap(page, uzmanEposta, UZMAN_PAROLA, new RegExp(`/panel/${k.slug}/gunum`))
  await expect(page.getByRole('heading', { level: 1, name: 'Günüm' })).toBeVisible()
  await expect(page.getByText(/2 randevu/)).toBeVisible()
  await expect(page.locator('[data-testid^="randevu-"]')).toHaveCount(2)
})

test('W11: Sıradaki kartı en yakın randevuyu, kalan süreyi ve aranabilir telefonu gösterir', async () => {
  const { page } = o
  const kart = page.getByTestId('gunum-siradaki')
  await expect(kart.getByRole('heading', { name: 'Sıradaki' })).toBeVisible()
  await expect(kart).toContainText('Müşteri Bir')
  await expect(kart).toContainText(/\d+ dk sonra/)
  await expect(kart.getByRole('button', { name: 'Başlat' })).toBeVisible()
  const ara = kart.getByRole('link', { name: /\bara$/ })
  const href = (await ara.getAttribute('href')) ?? ''
  expect(href.startsWith('tel:'), `tel bağlantısı: ${href}`).toBe(true)
  expect(href.replace(/\D/g, '').endsWith(birinciTelefon.slice(-10)), `telefon hanesi: ${href}`).toBe(true)
})

test('W11 kapsam: uzman başka uzmanın randevusunu ve müşterisini hiçbir biçimde görmez (ekran ve API)', async () => {
  const { page } = o
  await expect(page.getByText('Müşteri Iki')).toBeVisible()
  const metin = await page.locator('body').innerText()
  expect(metin, 'başka uzmanın müşterisi ekranda').not.toContain('Başka Müşteri')
  expect(metin, 'başka uzmanın adı ekranda').not.toContain('Diğer Uzman')

  // Sunucu da kapsamı zorlar: uzman başka uzmanın kimliğini sorguya yazsa bile onun randevusu gelmez.
  const r = await uzmanApi.get(k.yol(`/appointments?date=${bugun()}&staffId=${digerUzmanId}`))
  expect(r.status(), await r.text()).toBeLessThan(500)
  expect(await r.text(), 'API başka uzmanın randevusunu döndürdü').not.toContain('Başka Müşteri')
  // Pozitif eş: aynı çağrı kendi kapsamında veriyi gerçekten döndürür (tesadüfen boş olduğu için geçmiş olmasın).
  const kendi = await uzmanApi.get(k.yol(`/appointments?date=${bugun()}`))
  expect(await kendi.text()).toContain('Müşteri Bir')
})

test('W11 R3: Günüm fiyat göstermez; İzinlerim "Yakında" der', async () => {
  const { page } = o
  expect(await page.locator('body').innerText(), 'fiyat/para birimi').not.toMatch(/₺|\bTL\b/)
  const izin = page.getByRole('heading', { name: 'İzinlerim' }).locator('xpath=ancestor::*[self::section or self::div][1]')
  await expect(izin).toContainText('Yakında')
  await expect(page.getByRole('heading', { name: 'Günün sırası' })).toBeVisible()
  await expect(page.getByText('Tamamlanan')).toBeVisible()
  await expect(page.getByText('Kalan')).toBeVisible()
})

for (const g of [
  { ad: '390', w: 390, h: 844 },
  { ad: '1440', w: 1440, h: 900 },
]) {
  test(`W11 UI-DoD: Günüm ${g.ad} px ekran görüntüsü, yatay taşma yok, ciddi axe ihlali yok`, async () => {
    const { page } = o
    await genislikAyarla(page, g.w, g.h)
    await expect(page.getByTestId('gunum-siradaki')).toBeVisible()
    await ekranGoruntusu(page, `w11-gunum-${g.ad}`)
    expect(await yatayTasma(page), 'yatay taşma (px)').toBeLessThanOrEqual(0)
    // İhlal hemen fırlatılmaz (serial kip kalan testleri atlatır); kaydedilir ve serinin sonunda ayrı testle hükme bağlanır.
    await expectNoSeriousA11yViolations(page, `W11 Günüm ${g.ad} px`).catch((e: Error) => {
      axeBulgulari.push(e.message.split('\n').slice(0, 14).join('\n'))
    })
  })
}

test('W11: Başlat randevuyu başlatır; kart "Şimdi" olur ve sunucuda durum in_progress', async () => {
  const { page } = o
  await genislikAyarla(page, 390, 844)
  const kart = page.getByTestId('gunum-siradaki')
  await kart.getByRole('button', { name: 'Başlat' }).click()
  await expect(page.getByText('Randevu başladı.', { exact: true }).last()).toBeVisible()
  await expect(kart.getByRole('heading', { name: 'Şimdi' })).toBeVisible()
  await expect(kart).toContainText('Devam ediyor')
  await expect(kart.getByRole('button', { name: 'Başlat' })).toHaveCount(0)
  const durum = await json<{ data?: Array<{ id: string; status: string }> }>(await k.api.get(k.yol(`/appointments?date=${bugun()}`)))
  expect(durum.data?.find((a) => a.id === birinciRandevuId)?.status).toBe('in_progress')
})

test('W11: uzman Bugün adresine giderse Günüm\'e yönlenir ve sahip ekranı (kasa özeti) görmez', async () => {
  const { page } = o
  await page.goto(`/panel/${k.slug}/bugun`)
  await page.waitForURL(new RegExp(`/panel/${k.slug}/gunum`))
  await expect(page.getByRole('heading', { level: 1, name: 'Günüm' })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toContain('Kasa özeti')
})

// Serinin son testi: birikmiş ölçümler birlikte hükme bağlanır (soft: biri kalsa da diğeri raporlanır).
test('W11 UI-DoD: Günüm iki genişlikte ciddi axe ihlali yok ve gezinti boyunca konsolda hata yok', () => {
  expect.soft(axeBulgulari, 'axe ihlalleri').toEqual([])
  expect.soft(o.konsol, 'konsol hataları').toEqual([])
})
