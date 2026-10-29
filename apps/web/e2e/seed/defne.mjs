// T3: "Defne Güzellik Salonu" demo verisi, YALNIZ API üzerinden kurulur (veritabanına doğrudan yazılmaz).
// Veri kurgusaldır (docs/tasarim/prototip/veri.js ile tutarlı); telefonlar 0500 000 00 xx.
//
// Kullanım:  E2E_API_URL=https://yeni-api.beautyossapp.com DEMO_SEED_PASSWORD=<parola> node defne.mjs
// Tekrar çalıştırılabilir: kiracı varsa giriş yapar, eksik olanı tamamlar (ad/telefon ile eşleştirir).
// Güvenlik: yalnız `demo-` ya da `tst-` önekli kiracı; canlı API adresine karşı çalışmayı reddeder.
// Parola dosyaya yazılmaz; ortamdan gelir. İstek bütçesi: /auth/* için tek turda en çok 2 istek (kayıt ya da giriş).

const API = (process.env.E2E_API_URL ?? '').replace(/\/$/, '')
const PAROLA = process.env.DEMO_SEED_PASSWORD ?? ''
const SLUG = process.env.DEMO_SLUG ?? 'demo-defne'
// E-posta adresleri kiracılar arası tekil: ikinci demo kiracı için DEMO_EPOSTA_SON (örn. '2@ornek.test') verilir.
const EPOSTA_SON = process.env.DEMO_EPOSTA_SON ?? '@ornek.test'
const SAHIP_EPOSTA = process.env.DEMO_OWNER_EMAIL ?? `derya${EPOSTA_SON}`

if (!API) throw new Error('E2E_API_URL tanımlı değil.')
if (PAROLA.length < 10) throw new Error('DEMO_SEED_PASSWORD en az 10 karakter olmalı (dosyaya yazılmaz).')
if (!/^(demo|tst)-/.test(SLUG)) throw new Error(`Kiracı slug'ı demo- ya da tst- ile başlamalı: ${SLUG}`)
// İzin listesi (kara liste değil): sondaki nokta ('api.beautyossapp.com.') ve büyük harf kara listeyi atlatırdı.
const host = new URL(API).hostname.toLowerCase().replace(/\.$/, '')
const IZINLI_HOSTLAR = new Set(['yeni-api.beautyossapp.com', 'localhost', '127.0.0.1'])
if (!IZINLI_HOSTLAR.has(host) && !/^bostest-[a-z0-9-]+(\.bostest\.test)?$/.test(host)) {
  throw new Error(`Demo verisi yalnız geçici test yığınına ya da staging API'sine kurulur; gelen: ${host}`)
}

const HIZMETLER = [
  ['Kadın saç kesimi', 'Saç', 45, 850, ['p1', 'p2']], ['Fön', 'Saç', 30, 450, ['p1', 'p2']],
  ['Dip boya', 'Saç', 90, 1600, ['p1']], ['Ombre ve balyaj', 'Saç', 180, 4500, ['p1']],
  ['Keratin bakım', 'Saç', 120, 3200, ['p1', 'p2']], ['Manikür', 'Tırnak', 45, 600, ['p3']],
  ['Kalıcı oje', 'Tırnak', 60, 750, ['p3']], ['Protez tırnak', 'Tırnak', 120, 1400, ['p3']],
  ['Pedikür', 'Tırnak', 60, 800, ['p3']], ['Klasik cilt bakımı', 'Cilt', 60, 1500, ['p4']],
  ['Cilt bakımı (derin temizlik)', 'Cilt', 75, 2400, ['p4']], ['Kaş alımı', 'Kaş ve kirpik', 15, 250, ['p4']],
  ['Kirpik lifting', 'Kaş ve kirpik', 60, 1200, ['p4']],
]

// p1 sahip kullanıcıdır ama API sahibe uzman profili açmaz (A2'ye kadar): ayrı bir uzman kaydı olarak kurulur.
const PERSONEL = [
  ['p1', 'Derya Aksoy', 'Saç tasarım', `derya.uzman${EPOSTA_SON}`, 1], ['p2', 'Elif Şahin', 'Kuaför', `elif${EPOSTA_SON}`, 2],
  ['p3', 'Zeynep Arslan', 'Manikür ve pedikür', `zeynep${EPOSTA_SON}`, 3], ['p4', 'Merve Çelik', 'Cilt bakım uzmanı', `merve${EPOSTA_SON}`, 4],
]

const MUSTERILER = [
  'Aylin Yıldız', 'Burcu Demir', 'Gizem Koç', 'Ece Aydın', 'Nur Tekin', 'Sibel Kurt', 'Hande Polat', 'Melis Er',
  'Pınar Uçar', 'Tuğba Şen', 'Aslı Güneş', 'Fatma Aksu', 'İrem Bulut', 'Ceren Oral', 'Gül Erdem', 'Duygu Kara',
  'Seda Kılıç', 'Ayşe Yalın',
]
const telefon = (i) => `05000000${String(21 + i).padStart(3, '0')}`.slice(0, 11)

// [personel, hizmet(sıra), başlangıç, müşteri(sıra)] — bugünün şablonu (çakışmasız).
const SABLON = [
  ['p1', 2, '09:30', 0], ['p1', 0, '11:30', 1], ['p1', 3, '13:30', 2], ['p1', 0, '17:00', 3],
  ['p2', 1, '10:00', 4], ['p2', 4, '12:00', 5], ['p2', 0, '14:30', 6], ['p2', 1, '15:30', 7], ['p2', 1, '18:00', 8],
  ['p3', 6, '10:00', 9], ['p3', 5, '11:30', 10], ['p3', 8, '13:00', 11], ['p3', 7, '14:30', 12], ['p3', 6, '17:00', 13],
  ['p4', 9, '11:00', 14], ['p4', 12, '12:30', 15], ['p4', 10, '15:00', 16], ['p4', 11, '16:30', 17],
]

// 429'da (randevu oluşturma: kiracı başına dakikada 20) Retry-After kadar koşullu beklenip yeniden denenir.
async function istek(yontem, yol, govde, token, deneme = 0) {
  const sonuc = await istekTek(yontem, yol, govde, token)
  if (sonuc.durum === 429 && !yol.startsWith('/api/v1/auth') && deneme < 5) {
    await new Promise((r) => setTimeout(r, Math.max(sonuc.bekle, 5) * 1000 + 500))
    return istek(yontem, yol, govde, token, deneme + 1)
  }
  return sonuc
}

async function istekTek(yontem, yol, govde, token) {
  const r = await fetch(`${API}${yol}`, {
    method: yontem,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: govde ? JSON.stringify(govde) : undefined,
  })
  const metin = await r.text()
  let json = null
  try { json = JSON.parse(metin) } catch { /* gövde JSON değil */ }
  return { durum: r.status, json, metin, bekle: Number(r.headers.get('retry-after') ?? 0) }
}

async function oturum() {
  const giris = await istek('POST', '/api/v1/auth/login', { email: SAHIP_EPOSTA, password: PAROLA })
  if (giris.durum === 200) return giris.json.token
  if (giris.durum === 429) throw new Error('Giriş hız sınırı doldu (429); 15 dk sonra yeniden dene.')
  const kayit = await istek('POST', '/api/v1/auth/register', {
    salonName: 'Defne Güzellik Salonu', slug: SLUG, ownerFullName: 'Derya Aksoy', email: SAHIP_EPOSTA, password: PAROLA,
    phone: '05000000010',
  })
  if (kayit.durum !== 201) throw new Error(`Kayıt başarısız (${kayit.durum}): ${kayit.metin.slice(0, 200)}`)
  return kayit.json.token
}

// Istanbul saatini UTC ISO'ya çevirir (TR kalıcı +03:00).
const utc = (gun, saat) => new Date(`${gun}T${saat}:00+03:00`).toISOString()
const istanbulGunu = (kaydir) => {
  const d = new Date(Date.now() + kaydir * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d)
}

async function ekle(token, yol, govde, ad) {
  const r = await istek('POST', `/api/v1/tenants/${SLUG}${yol}`, govde, token)
  if (r.durum !== 201) throw new Error(`${ad}: ${r.durum} ${r.metin.slice(0, 200)}`)
  return r.json
}

async function liste(token, yol) {
  const r = await istek('GET', `/api/v1/tenants/${SLUG}${yol}`, null, token)
  if (r.durum !== 200) throw new Error(`GET ${yol}: ${r.durum}`)
  return r.json.data ?? r.json
}

const token = await oturum()
const ayar = await istek('PATCH', `/api/v1/tenants/${SLUG}/settings`, { onboardingCompleted: true }, token)
if (ayar.durum !== 200) throw new Error(`ayar: ${ayar.durum} ${ayar.metin.slice(0, 160)}`)
const sonuc = { hizmet: 0, personel: 0, musteri: 0, randevu: 0, atlanan: 0 }

const mevcutHizmet = new Map((await liste(token, '/services')).map((h) => [h.name, h.id]))
const hizmetId = []
for (const [ad, kategori, sure, fiyat] of HIZMETLER) {
  if (!mevcutHizmet.has(ad)) {
    const h = await ekle(token, '/services', { name: ad, category: kategori, durationMinutes: sure, price: fiyat }, `hizmet ${ad}`)
    mevcutHizmet.set(ad, h.id)
    sonuc.hizmet++
  }
  hizmetId.push(mevcutHizmet.get(ad))
}

const mevcutPersonel = new Map((await liste(token, '/staff')).map((p) => [p.email ?? p.user?.email, p.id]))
const personelId = {}
for (const [kod, ad, unvan, eposta, renk] of PERSONEL) {
  if (!mevcutPersonel.has(eposta)) {
    const p = await ekle(token, '/staff', { email: eposta, password: PAROLA, fullName: ad, title: unvan, colorCode: renk }, `personel ${ad}`)
    mevcutPersonel.set(eposta, p.id)
    sonuc.personel++
  }
  personelId[kod] = mevcutPersonel.get(eposta)
}
for (const hizmet of HIZMETLER) {
  const ad = hizmet[0]
  for (const kod of hizmet[4]) {
    // Atama idempotent (upsert). Yalnız sahip yapabilir; token sahibin.
    const r = await istek('POST', `/api/v1/tenants/${SLUG}/staff/${personelId[kod]}/services`,
      { serviceId: mevcutHizmet.get(ad), commissionType: 'percentage', commissionValue: 25 }, token)
    if (r.durum !== 201) throw new Error(`atama ${ad}/${kod}: ${r.durum}`)
  }
}

const mevcutMusteri = new Map((await liste(token, '/customers?limit=100')).map((m) => [m.fullName, m.id]))
const musteriId = []
for (let i = 0; i < MUSTERILER.length; i++) {
  if (!mevcutMusteri.has(MUSTERILER[i])) {
    const m = await ekle(token, '/customers', { fullName: MUSTERILER[i], phone: telefon(i) }, `müşteri ${MUSTERILER[i]}`)
    mevcutMusteri.set(MUSTERILER[i], m.id)
    sonuc.musteri++
  }
  musteriId.push(mevcutMusteri.get(MUSTERILER[i]))
}

// Randevular: -7..+7 gün, pazar kapalı. Geçmiş: tamamlandı (biri iptal, biri gelmedi); bugün: karışık; gelecek: onaylı.
const odeme = ['card', 'cash']

const ARALIK = Number(process.env.DEMO_SEED_GUN ?? 7)
for (let g = -ARALIK; g <= ARALIK; g++) {
  const gun = istanbulGunu(g)
  if (new Date(`${gun}T12:00:00+03:00`).getUTCDay() === 0) continue
  // O günün mevcut randevuları (iptal/gelmedi dahil): aynı personel+saat yeniden açılmaz.
  const mevcutGun = await liste(token, `/appointments?date=${gun}&limit=100`)
  const dolu = new Set(mevcutGun.map((a) => `${a.startTime}|${a.staffName}`))
  const sablon = g === 0 ? SABLON : SABLON.filter((_, i) => i % 2 === (Math.abs(g) % 2))
  for (let i = 0; i < sablon.length; i++) {
    const [kod, h, saat, m] = sablon[i]
    const musteri = musteriId[(m + Math.abs(g)) % musteriId.length]
    const baslangic = utc(gun, saat)
    if (dolu.has(`${baslangic}|${PERSONEL.find((p) => p[0] === kod)[1]}`)) { sonuc.atlanan++; continue }
    const r = await istek('POST', `/api/v1/tenants/${SLUG}/appointments`,
      { customerId: musteri, serviceId: hizmetId[h], staffId: personelId[kod], startAt: baslangic }, token)
    if (r.durum === 409) { sonuc.atlanan++; continue }
    if (r.durum !== 201) throw new Error(`randevu ${gun} ${saat}: ${r.durum} ${r.metin.slice(0, 160)}`)
    sonuc.randevu++
    const durumGovde = g < 0 ? (i === 3 ? { status: 'cancelled', cancellationReason: 'Müşteri vazgeçti' } : i === 7 ? { status: 'no_show' } : { status: 'completed', paymentMethod: odeme[i % 2] })
      : g === 0 ? (i % 4 === 0 ? { status: 'completed', paymentMethod: odeme[i % 2] } : { status: 'confirmed' })
      : { status: 'confirmed' }
    const p = await istek('PATCH', `/api/v1/tenants/${SLUG}/appointments/${r.json.id}/status`, durumGovde, token)
    if (p.durum !== 200) throw new Error(`durum ${durumGovde.status}: ${p.durum} ${p.metin.slice(0, 160)}`)
  }
}

console.log(JSON.stringify({ kiraci: SLUG, ...sonuc }))
