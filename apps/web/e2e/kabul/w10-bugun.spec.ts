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

// W10 görsel kabul: Bugün ekranı, bekleyen online talep onay/ret akışı (S2-ek / ADR-0038 ile birlikte).
// Önkoşul: S2-ek içeren API (gorev/S6-durumlu-oturum ucu) + W10 arayüzü; aksi halde "Yeni müşteri olarak kaydet" 409 döner.
// Bütçe: online talep IP başına saatte 3 (ONLINE_LIMITS.ipPerHour); bu dosya tam 3 talep açar. Hız sınırı aşılmaz, çevrilmez.
test.skip(!PANEL_ACIK || !ayniSiteHazir(), ATLAMA_NEDENI)
test.describe.configure({ mode: 'serial' })

const API = process.env.E2E_API_URL as string
const TZ = 'Europe/Istanbul'
const gunBicimi = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const gun = (t: number) => gunBicimi.format(new Date(t))

let k: TestKiraci
let o: Oturum
let anon: APIRequestContext
let kayitliMusteriId: string
let kayitliTelefon: string

interface Satir {
  id: string
  customerName: string
  customerId?: string | null
  status: string
}

async function randevular(): Promise<Satir[]> {
  const simdi = Date.now()
  const r = await k.api.get(k.yol(`/appointments?dateFrom=${gun(simdi)}&dateTo=${gun(simdi + 14 * 86_400_000)}`))
  expect(r.status(), await r.text()).toBe(200)
  const govde = (await r.json()) as { data?: Satir[] } | Satir[]
  return Array.isArray(govde) ? govde : (govde.data ?? [])
}

async function musteriler(): Promise<Array<{ id: string; fullName: string }>> {
  const r = await k.api.get(k.yol('/customers'))
  expect(r.status(), await r.text()).toBe(200)
  const govde = (await r.json()) as { data?: Array<{ id: string; fullName: string }> } | Array<{ id: string; fullName: string }>
  return Array.isArray(govde) ? govde : (govde.data ?? [])
}

// Bekleyen talepler başlangıç saatine göre sıralanır (en erken ilk): şeridin "Gözden geçir" düğmesi hep en erkeni açar.
async function ilkTalebiAc(page: Oturum['page']) {
  await page.getByTestId('bugun-bulgu').getByRole('button', { name: 'Gözden geçir' }).click()
  const katman = page.getByRole('dialog', { name: 'Online randevu talebi' })
  await expect(katman).toBeVisible()
  return katman
}

test.beforeAll(async ({ browser }, info) => {
  k = await kiraciKur('w10')
  const { hizmet, uzman } = await randevuVerisiKur(k)
  kayitliTelefon = `0555${Math.floor(1000000 + Math.random() * 8999999)}`
  const musteri = await k.api.post(k.yol('/customers'), { data: { fullName: 'Kayıtlı Müşteri', phone: kayitliTelefon } })
  expect(musteri.status(), await musteri.text()).toBe(201)
  kayitliMusteriId = ((await musteri.json()) as { id: string }).id
  const ayar = await k.api.patch(k.yol('/settings'), { data: { publicBookingEnabled: true } })
  expect(ayar.status(), await ayar.text()).toBe(200)

  // Üç online talep (herkese açık uç, giriş yok). Saatler artan: banner sırası = bu sıra. Hepsi 3 saatten uzak ve 14 gün içinde.
  anon = await request.newContext({ baseURL: API })
  const talep = async (saatSonra: number, ad: string, telefon: string) => {
    const baslangic = new Date(Date.now() + saatSonra * 3_600_000)
    const r = await anon.post(`/api/v1/tenants/${k.slug}/public/book`, {
      data: { serviceId: hizmet.id, staffId: uzman.id, startAt: `${baslangic.toISOString().slice(0, 19)}Z`, customerName: ad, customerPhone: telefon },
    })
    expect(r.status(), `${ad}: ${await r.text()}`).toBe(201)
    expect(((await r.json()) as { approvalRequired: boolean }).approvalRequired, `${ad} onay beklemeli`).toBe(true)
  }
  await talep(26, 'Aday Bir', kayitliTelefon)
  await talep(30, 'Aday Iki', kayitliTelefon)
  await talep(34, 'Aday Uc', `0555${Math.floor(1000000 + Math.random() * 8999999)}`)

  o = await yeniOturum(browser, info.project.use.baseURL as string)
})

test.afterAll(async () => {
  await o?.context.close()
  await anon?.dispose()
})

test('W10: sahip girince Bugün açılır ve üç bekleyen online talep şeritte görünür', async () => {
  const { page } = o
  await girisYap(page, k.email, k.password, new RegExp(`/panel/${k.slug}/bugun`))
  await expect(page.getByRole('heading', { level: 1, name: 'Bugün' })).toBeVisible()
  const serit = page.getByTestId('bugun-bulgu')
  await expect(serit).toContainText('3 online randevu onay bekliyor.')
  await expect(serit).toContainText('Aday Bir')
  await expect(serit).toContainText('Aday Uc')
})

for (const g of [
  { ad: '390', w: 390, h: 844 },
  { ad: '1440', w: 1440, h: 900 },
]) {
  test(`W10 UI-DoD: Bugün ${g.ad} px ekran görüntüsü, yatay taşma yok, ciddi axe ihlali yok`, async () => {
    const { page } = o
    await genislikAyarla(page, g.w, g.h)
    await expect(page.getByTestId('bugun-bulgu')).toBeVisible()
    await ekranGoruntusu(page, `w10-bugun-${g.ad}`)
    expect(await yatayTasma(page), 'yatay taşma (px)').toBeLessThanOrEqual(0)
    await expectNoSeriousA11yViolations(page, `W10 Bugün ${g.ad} px`)
  })
}

test('W10 K2 (ADR-0038): aday varken onay seçim yapılmadan açılmaz; "Yeni müşteri olarak kaydet" başarılı olur ve ayrı müşteri açar', async () => {
  const { page } = o
  await genislikAyarla(page, 390, 844)
  const katman = await ilkTalebiAc(page)
  await expect(katman).toContainText('Aday Bir')
  await expect(katman.getByText('Bu telefonla kayıtlı müşteri var. Bu kişi mi?')).toBeVisible()
  await expect(katman.getByRole('radio', { name: /Kayıtlı Müşteri/ })).toBeVisible()
  const onayla = katman.getByRole('button', { name: 'Talebi onayla' })
  await expect(onayla, 'seçim yapılmadan onay açık').toBeDisabled()

  await katman.getByRole('radio', { name: /Yeni müşteri olarak kaydet/ }).click()
  await expect(katman.getByText('Bu telefon başka bir müşteride de kayıtlı kalacak.')).toBeVisible()
  await expect(onayla).toBeEnabled()
  await ekranGoruntusu(page, 'w10-onay-katmani-390')
  await onayla.click()

  await expect(page.getByText('Randevu talebi onaylandı.')).toBeVisible()
  await expect(katman).toBeHidden()

  const satir = (await randevular()).find((r) => r.customerName === 'Aday Bir')
  expect(satir, 'onaylanan randevu API listesinde').toBeDefined()
  expect(satir?.status).toBe('confirmed')
  const yeni = (await musteriler()).filter((m) => m.fullName === 'Aday Bir')
  expect(yeni, 'yeni müşteri kaydı').toHaveLength(1)
  expect(satir?.customerId, 'randevu yeni müşteriye bağlı').toBe(yeni[0].id)
  expect(satir?.customerId, 'kayıtlı müşteriye bağlanmamalı').not.toBe(kayitliMusteriId)
  expect((await musteriler()).filter((m) => m.fullName === 'Kayıtlı Müşteri'), 'kayıtlı müşteri değişmedi').toHaveLength(1)
  await expect(page.getByTestId('bugun-bulgu')).toContainText('2 online randevu onay bekliyor.')
})

test('W10: aday seçilip bağlanınca randevu kayıtlı müşteriye bağlanır, yeni müşteri açılmaz', async () => {
  const { page } = o
  const katman = await ilkTalebiAc(page)
  await expect(katman).toContainText('Aday Iki')
  await katman.getByRole('radio', { name: /Kayıtlı Müşteri/ }).click()
  await katman.getByRole('button', { name: 'Talebi onayla' }).click()
  await expect(page.getByText('Randevu talebi onaylandı.')).toBeVisible()
  await expect(katman).toBeHidden()

  const satir = (await randevular()).find((r) => r.customerName === 'Kayıtlı Müşteri' && r.status === 'confirmed' && r.id !== undefined)
  expect(satir, 'bağlanan randevu kayıtlı müşteri adıyla listelenir').toBeDefined()
  expect(satir?.customerId).toBe(kayitliMusteriId)
  expect((await musteriler()).filter((m) => m.fullName === 'Aday Iki'), 'bağlamada yeni müşteri açılmamalı').toHaveLength(0)
  await expect(page.getByTestId('bugun-bulgu')).toContainText('1 online randevu onay bekliyor.')
})

test('W10: talep reddedilir (onay penceresiyle), randevu iptal olur ve şerit kalkar', async () => {
  const { page } = o
  const katman = await ilkTalebiAc(page)
  await expect(katman).toContainText('Aday Uc')
  // Eşleşecek aday yok: seçim sorulmaz.
  await expect(katman.getByRole('radio')).toHaveCount(0)
  await katman.getByRole('button', { name: 'Talebi reddet' }).click()
  await expect(page.getByText('Talebi reddetmek istiyor musunuz?')).toBeVisible()
  // Hâlâ iptal edilmedi: onay verilmeden randevu bekliyor.
  expect((await randevular()).find((r) => r.customerName === 'Aday Uc')?.status).toBe('pending')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Talebi reddet' }).click()

  await expect(page.getByText('Randevu talebi reddedildi.')).toBeVisible()
  await expect(page.getByTestId('bugun-bulgu')).toHaveCount(0)
  const satir = (await randevular()).find((r) => r.customerName === 'Aday Uc')
  expect(satir?.status).toBe('cancelled')
})

test('W10 UI-DoD: gezinti boyunca tarayıcı konsolunda hata yok', async () => {
  expect(o.konsol, 'konsol hataları').toEqual([])
})
