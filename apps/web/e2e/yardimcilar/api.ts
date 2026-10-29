import { expect, request, type APIRequestContext } from '@playwright/test'

// E2E verisi API üzerinden kurulur (arayüz sürücüsü değil). Adlar anonim ve uydurmadır;
// slug her zaman `tst-` önekli (test temizliği yalnız bu öneki tanır).
const API = process.env.E2E_API_URL
if (!API) throw new Error('E2E_API_URL tanımlı değil (örn. http://bostest-api:3001).')
// Beyaz liste: yalnız geçici yığının iç adı (bostest-api) ya da yerel adres; aynı-site çerezi için tek ek `bostest-api.bostest.test` (.test gerçek bir adrese çözülmez). Canlı ve staging adresleri reddedilir.
const apiHost = new URL(API).hostname.toLowerCase()
if (!/^bostest-[a-z0-9-]+(\.bostest\.test)?$/.test(apiHost) && apiHost !== '127.0.0.1' && apiHost !== 'localhost') {
  throw new Error(`E2E_API_URL yalnız geçici test yığınına işaret edebilir; gelen ana bilgisayar: ${apiHost}`)
}

export interface TestKiraci {
  slug: string
  salonAdi: string
  email: string
  password: string
  token: string
  api: APIRequestContext
  yol: (alt: string) => string
}

export function benzersiz(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export async function kiraciKur(onek = 'e2e'): Promise<TestKiraci> {
  const s = benzersiz()
  const slug = `tst-${onek}-${s}`.slice(0, 30)
  const salonAdi = `Test Salon ${s}`
  const email = `sahip-${s}@e2e.test.local`
  const password = 'TestPass12!'
  const anon = await request.newContext({ baseURL: API })
  const kayit = await anon.post('/api/v1/auth/register', {
    data: { salonName: salonAdi, slug, ownerFullName: 'Test Sahibi', email, password },
  })
  expect(kayit.status(), await kayit.text()).toBe(201)
  const { token } = (await kayit.json()) as { token: string }
  await anon.dispose()
  const api = await request.newContext({
    baseURL: API,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  const k: TestKiraci = { slug, salonAdi, email, password, token, api, yol: (alt) => `/api/v1/tenants/${slug}${alt}` }
  // Giriş sonrası onboarding sihirbazına düşülmesin: kurulum tamamlanmış kiracı kurulur.
  const ayar = await api.patch(k.yol('/settings'), { data: { onboardingCompleted: true } })
  expect(ayar.status(), await ayar.text()).toBe(200)
  return k
}

async function olustur<T>(k: TestKiraci, alt: string, data: object): Promise<T> {
  const r = await k.api.post(k.yol(alt), { data })
  expect(r.status(), `${alt}: ${await r.text()}`).toBe(201)
  return (await r.json()) as T
}

// Randevu alınabilmesi için gereken en küçük veri: hizmet, uzman, uzman-hizmet ataması, müşteri.
export async function randevuVerisiKur(k: TestKiraci) {
  const s = benzersiz()
  const hizmet = await olustur<{ id: string; name: string }>(k, '/services', {
    name: 'Test Saç Kesimi',
    durationMinutes: 30,
    price: 100,
  })
  const uzman = await olustur<{ id: string; fullName: string }>(k, '/staff', {
    email: `uzman-${s}@e2e.test.local`,
    password: 'TestPass12!',
    fullName: 'Test Uzmanı',
    title: 'Kuaför',
  })
  await olustur(k, `/staff/${uzman.id}/services`, { serviceId: hizmet.id })
  const musteri = await olustur<{ id: string; fullName: string }>(k, '/customers', {
    fullName: 'Test Müşterisi',
    phone: `0555${Math.floor(1000000 + Math.random() * 8999999)}`,
  })
  return { hizmet, uzman, musteri, uzmanEposta: `uzman-${s}@e2e.test.local`, uzmanParola: 'TestPass12!' }
}
