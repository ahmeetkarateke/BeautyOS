# BeautyOS — Ekran Envanteri ve Teknik Kısıtlar (frontend-gelistirici girdisi)

- **Tarih:** 2026-10-28 · **Sahibi:** `frontend-gelistirici` · **Aşama:** 1 (girdi)
- **Kaynak:** `tasima/docker` @ `71ee311`, `apps/web/src` (salt okunur kopya) + sözleşme doğrulaması için `apps/api/src` ve `prisma/schema.prisma`. Derleme/çalıştırma yapılmadı; her şey statik kod okumasına dayanır.
- **Okuma notu:** "Doğrulandı" = ilgili satırı kodda okudum. "Olası" = kodun yönlendirdiği ama çalıştırarak göstermediğim sonuç. Satır numaraları 71ee311'e göredir.
- **Kapsam dürüstlüğü:** 38 `page.tsx` rotasının hepsini taradım (API çağrıları, durum yönetimi, formlar); en büyük 6 ekranı (takvim, müşteri kartı, ayarlar, kasa, rezervasyon, giriş/kayıt) satır düzeyinde okudum. Kalan modal ve liste ekranlarında alan listesi tip tanımlarından ve zod şemalarından çıkarıldı; gözle görünen her etiketi tek tek okumadım. Metin envanteri `teknik-yazar`ın işidir.

---

## 0. Tasarımı doğrudan etkileyen 12 bulgu (önce bunları okuyun)

| # | Bulgu | Tasarıma etkisi |
|---|---|---|
| 1 | **Takvim bugün yalnızca ilk 10 randevuyu gösteriyor.** `appointment-calendar.tsx:144-150` `/appointments`'ı tarih ve `limit` vermeden çağırıyor; API varsayılan `limit=10`, `startAt asc` sıralı, tarih filtresi yok (`tenant.route.ts:284,327-346`). Yani "tüm zamanların en eski 10 randevusu". Doğrulandı. | Takvim yeniden tasarlanırken veri akışı da değişmek zorunda: görünür aralığa (`dateFrom/dateTo`) göre çekim. Frontend tarafında düzeltilir, API'ye eklenti gerekmez (`limit` en çok 100: bir haftalık/aylık görünüm 100'ü aşabilir, bkz. §7 uyarı B1). |
| 2 | **Onboarding "Estetik & Medikal Estetik" seçeneği API'de geçersiz.** `Step1Salon.tsx:18,26` değeri `aesthetic` gönderiyor; API `BusinessType` enum'unda `aesthetic` yok (`aesthetic_clinic` var, `schema.prisma:23-34`). Seçilirse PATCH `VALIDATION_ERROR` döner. Ayrıca iş türü listesi iki yerde farklı (kurulumda 5, ayarlarda 11). Doğrulandı. | Tasarım tek bir iş türü listesi kullanmalı (11 değer). Kurulum sihirbazında tüm türler sığmıyorsa arama/"Diğer" kalıbı tasarlanmalı. |
| 3 | **Yazı tipi Türkçe karakterleri eksik yüklüyor.** Panel `Inter({ subsets: ['latin'] })` (`app/layout.tsx:5`); `İ Ş ş Ğ ğ` `latin-ext` kümesindedir. Bu harfler sistem yazı tipine düşer. Pazarlama sayfası ayrıca Geist yüklüyor (`(marketing)/layout.tsx`). Brif §Tasarım kuralları `latin-ext` ister. | Tasarımcı yazı tipini seçerken `latin-ext` desteğini doğrulasın. Uygulamada tek font, `latin` + `latin-ext`. |
| 4 | **Tailwind kurulumu tutarsız.** `package.json`: `tailwindcss ^3.4.19` (devDep), `@tailwindcss/postcss ^4.2.3`. Kilit dosyası kökte `tailwindcss 4.2.3`, `apps/web/node_modules` altında 3.4.19 kuruyor. CSS v4 sözdizimi (`@import "tailwindcss"`, `@theme`), `tailwind.config.ts` ise v3 biçimi. `postcss.config.mjs` v4 eklentisini kullandığı için **derleme v4 ile çalışıyor; `tailwind.config.ts` büyük olasılıkla hiç okunmuyor** (v4 `@config` ile çağrılmadıkça yok sayar). Dockerfile `npm install` kullanıyor (kilit dosyası uyumsuzluğunu tolere ediyor). Kısmen doğrulandı (çözülen sürümler okundu, derleme çalıştırılmadı). | Token aktarımı v4 `@theme` ile yapılmalı (bkz. §5). Önce tek sürüme (v4) geçiş ve `tailwind.config.ts` silinmesi şart. Bu tek başına bir "temel iş" görevidir. |
| 5 | **v4 tema anahtarları yanlış adlandırılmış.** `globals.css` `--font-family-sans`, `--border-radius-lg`, `--shadow-card` tanımlıyor; v4 isim alanları `--font-sans`, `--radius-lg`, `--shadow-*`. `--font-family-sans` ve `--border-radius-*` v4'te yardımcı sınıf üretmez; `--color-primary-*`, `--color-salon-*` ve `--shadow-card` çalışır. `Button` `focus-visible:ring-ring` kullanıyor ama `ring` rengi tanımlı değil (1 kullanım). `animate-in/fade-in-0/zoom-in-95` (Dialog, Toast: 7 kullanım) `tailwindcss-animate` eklentisi ister; ne v3 ne v4 olarak kurulu, **dialog/toast animasyonları büyük olasılıkla çalışmıyor**. Olası. | Mevcut görsel "çalışıyor" görünse de bunun bir kısmı tesadüf. Tasarım tokenları sıfırdan, doğru v4 isim alanlarıyla kurulmalı; animasyon için ya `tw-animate-css` ya da kendi `@keyframes` (öneri: kendi, bağımlılıksız). |
| 6 | **Koyu tema bugün var ama hileli.** `globals.css` `.dark .bg-white`, `.dark .text-gray-900`… gibi ~14 genel geçersiz kılma ile "çeviriyor"; sidebar `dark:bg-[#0f0f1a]` gibi sabit hex kullanıyor; 267 satır içi `style={{}}`. Tema anahtarı (Güneş/Ay) kenar çubuğunun altında. Brif: "koyu tema sonra, tokenlar hazır". | Yeni sistemde koyu tema **çizilmez ama anahtar kaldırılmaz/gizlenir**: karar ui-ux-tasarimci'nın (öneri: anahtarı gizle, tokenları koru; yarım koyu tema amatör görünür). Bkz. §5. |
| 7 | **Rol modeli tasarımın "unvana göre yetki" kararını karşılamıyor.** API'de roller: `owner`, `manager`, `staff` (+`superadmin`). Personel eklenirken rol **her zaman `staff`** atanıyor (`tenant.route.ts:1446`); arayüzden `manager` oluşturmanın yolu yok. "Unvan" (`title`) serbest metin, yetkiyle ilgisiz. Web'de yetki yalnız `role === 'staff'` ise 4 yolu gizlemekten ibaret (`sidebar.tsx:109-115`). Doğrulandı. | Brif karar #4 ("yetkiler unvana göre") **backend + veri modeli işi** gerektirir (bkz. §7, B3). Tasarım üç role (sahip/yönetici/personel) göre mümkün; "unvana göre özel yetki" ise yeni bir rol/izin modeli ister. `urun-analisti` rol matrisini bununla uzlaştırmalı. |
| 8 | **Personel görünümü için API desteği kısmen var.** `GET /appointments` `staff` rolünde otomatik olarak yalnız kendi randevularını döndürüyor (`tenant.route.ts:322-335`); gösterge paneli `isStaff` iken Gelir/Müşteri/Doluluk kartlarını saklıyor. Ama müşteri listesi, hizmet listesi, personel listesi staff'a tam açık; personelin müşteri telefonunu/alerji notunu görmesi sınırlanmıyor. | "Sade personel görünümü" ekranı kolay; "personel hangi müşteri bilgisini görebilir" ise API kararıdır (§7, B3). |
| 9 | **Listeler sayfalanmıyor (müşteri hariç).** Yalnız `GET /customers` imleç (cursor) sayfalıyor (`limit` ≤200, varsayılan 50; web `useInfiniteQuery`). Hizmet, personel, paket, tedarikçi, stok, bahşiş, cari, fatura, bekleme listesi: tamamı tek istekte. Randevu: `limit` ≤100, sayfa/imleç yok. | Sonsuz kaydırma/sayfa numarası tasarımı yalnız müşteri listesinde güvenli. Diğer listeler için "N kayıt" varsayımıyla tasarlanmalı veya B1 backend işi eklenmeli. |
| 10 | **Gün sınırları UTC.** Randevu tarih filtreleri `${date}T00:00:00.000Z`–`23:59:59.999Z` (`tenant.route.ts:303-310`). İstanbul UTC+3 olduğundan 00:00–03:00 arası randevular "önceki güne" sayılır. Slot kimliği `Z`'siz UTC dizesi, web `slot.id + 'Z'` ekliyor (`slot-select.tsx:106`); `new-appointment-modal.tsx:56` sabit +3 saat. | Tasarımda "gece yarısını aşan/erken sabah" randevu varsayımı yok; ama hizmet saati 08:00–22:00 sabit (bkz. takvim). Zaman dilimi düzeltmesi B2'de. |
| 11 | **Fotoğraf yükleme URL ile.** `photo-upload-modal.tsx`: tek alan `https://` adres (zod: `url`, yalnız https). Dosya yükleme/kamera yok; `logoUrl` ve `coverUrl` de URL. | "Fotoğraf çek/seç" mobilde birincil beklenen davranış; bugün yok. Tasarım dosya seçimi içeriyorsa bu bir **backend + depolama** işi (B4). Prototip bunu "yakında" olarak işaretlemeli veya URL alanını dürüstçe göstermeli. |
| 12 | **Online randevu sayfasında fiyat, personel fotoğrafı, e-posta yok.** `GET /public/services` yalnız `id, name, durationMinutes, category` döner (`public.route.ts:84-96`); `public/staff` `id, fullName, title`. Müşteri yalnız ad + telefon (+SMS kodu + Turnstile CAPTCHA) verir. Hata ayrımı `error.code` yerine Türkçe mesaj metni aramasıyla yapılıyor (`book/[slug]/page.tsx:190-200`: `msg.includes('dolu')`). | Randevu sayfasında "fiyat göster" tasarımı backend gerektirir (B5). Ekran kayıt/hesap oluşturmaz; "randevumu görüntüle/iptal et" akışı da yoktur (referans kodu sadece gösterilir). |

---

## 1. Teknik temel

| Konu | Bugün | Not |
|---|---|---|
| Çatı | **Next.js 14.2.35 App Router**, `output: 'standalone'`, React **18.3.1** | React 19'a özgü kural uygulanmaz (`forwardRef` zorunlu kalır). Monorepo (`apps/web`, `apps/api`). |
| Render modeli | **Neredeyse tamamen istemci:** 99 istemci dosyası, hiçbir sayfa sunucuda veri çekmiyor; pazarlama sayfasının 11 bileşeni `'use client'`. | Panel için sorun değil (oturum istemcide). Pazarlama sayfası için sunucu bileşenine dönüş fırsatı (LCP). |
| Stil | Tailwind **v4.2.3 fiilen** (v3 kalıntılarıyla, §0-4/5), `@tailwindcss/forms`, `class-variance-authority`, `tailwind-merge`, `clsx` | Eylemli bileşenler `cva` ile; kalıp sağlam, korunabilir. |
| UI ilkelleri | Radix: `dialog`, `dropdown-menu`, `label`, `separator`, `slot`, `tabs`, `toast`, `avatar`. Kendi `ui/`: `button`, `card`, `confirm-dialog`, `dialog`, `input`, `label`, `select` (yerel `<select>`), `skeleton`, `textarea`, `toaster`, `mouse-orbs` | `dropdown-menu`, `tabs`, `avatar`, `separator` bağımlılık olarak var, `ui/` içinde sarmalayıcıları yok (kullanılıyor mu kontrol edilmeli, olasılıkla ölü bağımlılık). |
| İkonlar | **lucide-react 1.8.0**, adlandırılmış içe aktarma (ağaç sarsma uyumlu). `modules.ts` ikon adını string tutuyor ama `modules-panel.tsx` yalnız 3 ikon içe aktarıyor, yani string yalnız dokümantasyon | Emoji de kullanılıyor (dashboard başlığında 👋); brifin "şablon izi" kaygısıyla çelişir. |
| Yazı tipi | `next/font/google` Inter (`latin`), pazarlama: `geist` (Sans+Mono) | İki ayrı font ailesi, `latin-ext` yok (§0-3). `next/font/google` derleme zamanında Google'a ağ isteği yapar; sunucu derlemesinde ağ yoksa kırılır. Öneri: `next/font/local` ile dosyayı depoya koymak. |
| Veri | **TanStack React Query 5** (76 `useQuery`, 78 `useMutation`; varsayılan `staleTime 60 sn`, `retry 1`), `react-hook-form` + `zod` + `@hookform/resolvers` | `isError` yalnız 5 dosyada okunuyor (§3). |
| Durum | **Zustand 5** + `persist`: `auth` (`beautyos-auth`: user, token, onboardingCompleted), `admin` (`beautyos_admin_token`), `theme` (`beautyos-theme-v2`). Kenar çubuğu grup açık/kapalı durumu `localStorage` | Token'ın iki kopyası localStorage'da (denetim raporunda #3). |
| API istemcisi | `lib/api.ts` (`apiFetch`: Bearer + `credentials: include`, 401'de bir kez yenileme, 402'de `/subscription-required`, 429'da sabit mesaj), `lib/admin-api.ts` (yenileme yok), `book/[slug]` kendi `publicFetch`'i | Üç ayrı fetch sarmalayıcısı, üç farklı varsayılan adres. Hata gövdesi `{ error: { code, message } }`; istemci yalnız `message` okuyor. |
| Takvim | **FullCalendar 6.1.20** (`timeGrid`, `dayGrid`, `interaction`), Türkçe yerel ayar, `dynamic ssr:false`; mobilde `timeGridDay`, masaüstünde `timeGridWeek`; sabit `slotMinTime 08:00 / slotMaxTime 22:00` (salonun çalışma saatinden bağımsız); sürükle-bırak yeniden zamanlama (yalnız gelecekte ve sonlanmamış randevu) | Başlık öğesi `setTimeout` ile DOM'a elle dokunularak "tarihe git" seçicisine çevriliyor (kırılgan, `appointment-calendar.tsx:100-124`). Tasarım, FullCalendar'ın CSS'inin ne kadar özelleştirilebildiğini bilerek yapılmalı (aşağıda §4.3). |
| PDF/yazdırma | Kasa kapatma raporu `window.open` + `document.write` HTML ile yazdırılıyor; çıktı doğru kaçışlı (`esc`) | Yazdırma şablonunun da tokenlara bağlanması gerekir (inline hex). |
| Harici betik | Cloudflare Turnstile (yalnız `/book/[slug]` iletişim adımı) | CSP'de izin gerekir. |
| Testler | Yok (`test` betiği ve vitest bağımlılığı yok; tek test dosyası çalışmaz durumda). | Ekran başına bileşen testi yeni iş kapsamında yazılacak. |
| Ortam | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_BOT_FEATURES_ENABLED` | Bot menüsü/ayarları yalnız bayrak `true` ise görünür (varsayılan **kapalı**): "Bot Konuşmaları" sayfası, ayarlarda "Entegrasyonlar"/"Bot Ayarları" sekmeleri bugün **kullanıcıya görünmüyor**. |
| Varlıklar | `apps/web/public` **yok**: favicon, logo, OG görseli, manifest yok. Logo "Scissors" ikonu + metin | Marka varlıkları yeni tasarımın bir çıktısı olmalı (logo SVG, favicon seti). |

---

## 2. Rota haritası

Kök: `app/layout.tsx` (`lang="tr"`, Providers: React Query + tema + Toaster; satır içi tema betiği). **Yok:** `error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx` (hiçbiri; yanlış URL İngilizce varsayılan 404 verir), `robots`, `sitemap`.

| Rota | Yüzey | Kimlik doğrulama | Notlar |
|---|---|---|---|
| `/` | tanıtım | herkese açık | 11 bölüm (§4.1) |
| `/login`, `/signup`, `/forgot-password`, `/reset-password?token=` | giriş/kayıt | herkese açık | koyu cam kart + "orb" animasyonu |
| `/onboarding` | ilk kurulum | token gerekli | 4 adım |
| `/book/[slug]` | müşteri randevu sayfası | herkese açık | 5 adım + başarı |
| `/tenant/[slug]/dashboard` … (19 rota, §4.3) | salon paneli | `AuthGuard` (yalnız token + onboarding bayrağı) | kabuk: kenar çubuğu (≥sm) + alt çubuk/çekmece (mobil) |
| `/tenant/[slug]/subscription-required` | panel | token | 402'de yönlendirilen kilit ekranı |
| `/admin/login`, `/admin/dashboard`, `/admin/tenants`, `/admin/tenants/[tenantId]` | süper yönetici | `AdminGuard` | ayrı oturum anahtarı |
| **Eksik (footer'da bağlı, 404):** `/kvkk /gizlilik /sartlar /cerez /iletisim /yardim` | tanıtım/yasal | — | yeni tasarımda yazılacak; içerik `hukuk-uyum`/`teknik-yazar` |

**Panel kabuğu (tenant-shell):** `sm` altında alt çubuk (Bugün · Randevu · Müşteri · Bekleme · Tümü) + sağdan açılan çekmece (kendi elle yazılmış, odak tuzağı yok, `Esc` yok); `sm` ve üstü: 256 px / 64 px daralan kenar çubuğu (≥1280 px'te varsayılan açık). Menü 5 grup: GÜNLÜK, MÜŞTERİ, PERSONEL & HİZMET, FİNANS & STOK, (BOT, bayrakla); altta Ayarlar. Menü öğeleri **iki dosyada çoğaltılmış** (`sidebar.tsx`, `mobile-nav.tsx`) → tek kaynağa çıkarılmalı. Modül açık/kapalı (`activeModules`) filtreler; boş/geçersiz ise hepsi açık.

---

## 3. Durum yönetimi (yükleniyor / boş / hata) bugün

- **Yükleniyor:** çoğu sayfada var (iskelet `Skeleton` veya "—" metni). Auth guard hidrasyonda `null` döndürüyor (beyaz flaş).
- **Hata:** 76 sorgunun yalnız 5 dosyada `isError` işleniyor. Kasa (`finance`), gösterge paneli, randevu listesi, stok vb. API düşünce **sıfır/boş gösterir** (yanlış sıfır). Mutasyon hataları `toast(err.message, 'error')` ile gösteriliyor (sunucu mesajı olduğu gibi; mesajlar Türkçe ama kimisi teknik/İngilizce olabilir, örn. `SUBSCRIPTION_REQUIRED`).
- **Boş durum:** sayfaya göre düz metin ("Henüz personel eklenmemiş", "Müşteri bulunamadı"); ikon/eylem yok, ton tutarsız.
- **Yetkisiz:** 403 için ortak ekran yok; `staff` rolü bazı sayfalara URL ile girince yönlendiriliyor (finans) veya boş/hata (diğerleri; API 403 döner).
- **Başarı:** `toast('… güncellendi')` (4 sn sonra kaybolur, `aria-live` yok).
- **Silme onayı:** çoğu `ConfirmDialog`; ama `staff-payouts/page.tsx:310` ve `waitlist/page.tsx:162` tarayıcı `confirm()`'ü, `bot-conversations` el yapımı `div onClick` modal.
- **Oturum:** 401 → sert `window.location.href = '/login'` (mesaj yok); çok sorgu aynı anda 401 alırsa yenileme yarışı (denetim #4).

**Yeni sistem için gereken ortak durum bileşenleri** (hiçbiri yok, yeni yazılacak): `QueryState` (iskelet + hata/yeniden dene + boş + içerik), `EmptyState`, `ErrorState`, `Forbidden`, `PageHeader`, kök `error.tsx`/`not-found.tsx`.

---

## 4. Ekran envanteri

Sütun kısaltmaları: **Rol** = bugünkü web/API kısıtı. API yolları `/api/v1/tenants/:slug/…` önekini taşır (kısaltıldı).

### 4.1 Tanıtım sitesi (`/`) — Persuade
Bölümler (sırayla): `LandingNav`, `Hero`, `StatBand`, `Features`, `Sectors`, `TrustBand`, `Pilot`, `Pricing`, `FAQ`, `FinalCTA`, `Footer`. API çağrısı yok; tamamı statik içerik + framer-motion animasyon.
- **Yanıltıcı/doğrulanamaz içerik (brif #15 gereği kalkacak):** giriş sayfasında "Türkiye'nin #1 Salon Platformu", "500+ salon"; `Pilot`: "Kalan Kontenjan 42/50" ve sabit `%16` çubuk; `TrustBand`: "uçtan uca şifreli", "PCI-DSS"; Hero `#demo` bağlantısının hedefi yok; Hero ve Features içinde yanlış alan adları (`app.beautyos.com`, `beautyos.com/book`); `Pricing` ₺499 ve "Kurucu üye fiyat kilidi" (fiyat kararı kurucuya ait, yer tutucu kalmalı).
- **Bağlantılar:** "Giriş", "Kayıt/Deneme başlat" → `/login`, `/signup`; footer yasal bağlantıları 404; "Online Rezervasyon" ve "Demo Talebi" `/iletisim`'e (yok).
- **Kısıt:** Geist yazı tipi + `antialiased`; sayfa `(marketing)` route grubu kendi layout'unda meta/OG tanımlıyor ama OG görseli yok.

### 4.2 Giriş, kayıt, şifre, kurulum — Operate

| Ekran | Alanlar (doğrulama) | API | Durumlar / notlar |
|---|---|---|---|
| **/login** | `email` (zorunlu, e-posta biçimi), `password` (zorunlu, **min 6**). Şifre göster/gizle. "Şifremi unuttum", "Kayıt ol" bağlantıları. Sol panel marka metni (masaüstü) | `POST /auth/login` → `{ token, user:{id,email,name,role,tenantSlug} }`; sonra `GET /settings` (`onboardingCompleted`) | hata: `error` alanı formda gösteriliyor (yalnız `error.message`); `loginLimiter`, 429 → "bir saat bekleyin" sabit metni. `<label>` `htmlFor` yok, şifre düğmesi etiketsiz. |
| **/signup** (2 adım) | 1: `salonName` (min 2). 2: `slug` (2–50, `[a-z0-9-]`, salon adından **otomatik** üretilir ve kullanıcıya alan olarak gösterilir), `fullName` (min 2), `phone` (opsiyonel, `[0-9+\s()-]{7,20}`), `email`, `password` (**min 8**), `confirmPassword` (eşleşmeli) | `POST /auth/register` `{salonName, slug, ownerFullName, phone?, email, password}` → token+user | **KVKK/şartlar onay kutusu yok.** Slug alanı "teknik terim" (kullanıcıya adres olarak anlatılmalı; benzersizlik hatası `CONFLICT`/`DUPLICATE_*`). Giriş min 6, kayıt min 8: tutarsız. Hata mesajı API'den. |
| **/forgot-password** | `email` | `POST /auth/forgot-password` | başarı durumu ayrı ekran; hata toast. |
| **/reset-password?token=** | `password` (**min 6**), `passwordConfirm`; `token` URL'den | `POST /auth/reset-password` `{token, password}` | token yoksa/geçersizse özel durum tasarımı yok (yalnız API hatası toast'ı). Başarıda toast + `/login`. |
| **/onboarding** (4 adım) | 1 Salon: `name` (min 2), `address` (min 5), `phone` (min 10), `businessType` (5 değer, biri geçersiz §0-2). 2 Hizmet: 1–5 satır `{name min 2, category zorunlu, duration ≥5 dk, price ≥0}`, sektör önerileri (`sector-data.ts`). 3 Personel: 1–3 satır `{name, email, password min 8, title, color (8'li palet), serviceIds[], leaveDates[]}`. 4 Tamam | `PATCH /settings`, `POST /services` (adım başına), `POST /staff` + `POST /staff/:id/services` + `POST /staff/:id/leaves`, `PATCH /settings {onboardingCompleted}` | Adımlar ilerleme çubuğuyla. Adım 3 personel **şifresini** sahibi belirliyor (personel kendi şifresini seçmiyor); "izin tarihi" ilk kurulumda isteniyor (gereksiz yük). Atlama (skip) yok. |
| **/admin/login** | `email`, `password` (min 1) | `POST /auth/admin-login` (yerel `fetch`) | ayrı marka; oturum `beautyos_admin_token`. |

### 4.3 Salon paneli (`/tenant/[slug]/…`) — Operate

**Gün sonu / günlük**

| Ekran | Gösterilen veri | API | Eylemler | Durumlar |
|---|---|---|---|---|
| **dashboard** | Karşılama (ad), tarih; dönem seçici (Bugün/Hafta/Ay); KPI: gelir (+değişim %), randevu sayısı (+değişim %), toplam müşteri, doluluk %; "Bu dönemin randevuları" listesi (50'ye kadar, `statusIn` filtreli) | `GET /dashboard?period=` → `{period, todayRevenue, todayAppointmentCount, totalCustomers, occupancyRate, revenueChange|null, appointmentChange|null}`; `GET /appointments?dateFrom&dateTo&limit=50[&statusIn]` | KPI karta tıklayınca finans; randevuya tıklayınca detay çekmecesi | Yükleniyor "—"; **hata yok**; boş mesajı dönem başına. Personel: yalnız Randevu kartı. `todayRevenue` adı dönem ne olursa olsun aynı (ad yanıltıcı). Doluluk = randevu sayısı / (personel × 8 sa × gün), kaba bir hesap. |
| **appointments** | FullCalendar (hafta/gün/ay görünümleri), personel rengi, durum renkleri/stilleri (iptalde üstü çizili), filtre: personel, durum, müşteri adı arama (≥2 kr.) | `GET /staff`; takvim `GET /appointments?staffId&status&search` (**§0-1 hatası**) | Boş aralığa tıkla → yeni randevu; etkinliğe tıkla → detay; sürükle → `PATCH /appointments/:id/reschedule`; yeni randevu; hızlı işlem | Hata/boş durumu yok; takvim iskeleti var. |
| ↳ **Yeni randevu (modal)** | Müşteri (arama listesi, ilk sayfa), hizmet, personel, **saat** (slot seçici), not | `GET /customers`, `/services`, `/staff`, `GET /slots?serviceId&staffId&date`; `POST /appointments` `{customerId, serviceId, staffId, startAt, notes≤500}` | satır içi müşteri oluşturma (`inline-customer-create`) | Zod: hepsi zorunlu (not hariç). Hatalar: `SLOT_TAKEN`, `SLOT_CONFLICT`, `PAST_TIME`, `STAFF_NOT_SKILLED`, `TOO_MANY_BOOKINGS` (istemci `code` okumuyor). Müşteri listesi `limit`'siz çekiliyor → ilk 50 müşteri (**aramada bulunamayan müşteri hatası olası**). |
| ↳ **Hızlı işlem (modal)** | Müşteri, hizmet, personel, tutar (`priceCharged ≥0`), ödeme (nakit/kart) | `POST /appointments` + `PATCH /appointments/:id/status` (tamamlandı) | randevusuz satış | iki ardışık çağrı: ilki başarılı, ikincisi düşerse yarım kayıt (atomik değil). |
| ↳ **Randevu detay çekmecesi** | Müşteri, telefon, hizmet, personel, saat, durum rozeti, tutar, referans kodu, not | `PATCH /appointments/:id/reschedule`, `PATCH /appointments/:id` (not), `DELETE /appointments/:id` (**yalnız owner/manager** butonu), durum modalı | saat değiştir (datetime-local), not düzenle (≤500), sil, durumu değiştir, ara (tel) | Durum etiketleri iki yerde farklı: "Onaylı" ↔ "Onaylandı", "İptal" ↔ "İptal Edildi" (`appointment-detail-sheet`, `status-modal`, `customers/[id]`). |
| ↳ **Durum modalı** | 6 durum (Bekliyor, Onaylandı, Devam Ediyor, Tamamlandı, İptal Edildi, Gelmedi); tamamlama: ödeme yöntemi + tutar | `PATCH /appointments/:id/status {status, paymentMethod?, priceCharged?}` | Hata `STATUS_LOCKED` (sonlanmış randevu değişmez) | ödeme yöntemi `cash|card` (başka yöntem yok: havale/paket/karışık yok). |
| **waitlist** | Bekleme kayıtları (müşteri, hizmet, personel, tercih tarihi/saat aralığı, durum, bildirildi, notlar) | `GET /waitlist`, `/services`, `/staff`; `POST /waitlist`, `DELETE /waitlist/:id`, `POST /:id/book`, `POST /:id/notify` | ekle, bildir (SMS/WhatsApp ??? kanal bildirim modalında), randevuya çevir, sil (`confirm()`), süresi doldu | iki ayrı modal. Durum etiketleri `WaitlistStatus`. |

**Müşteri**

| Ekran | Gösterilen veri | API | Eylemler / formlar |
|---|---|---|---|
| **customers** | Arama kutusu (≥2 kr. server tarafı, `searchLimiter`), liste: ad, telefon, e-posta, toplam ziyaret, son ziyaret, kayıt tarihi; "daha fazla yükle" (imleç) | `GET /customers?search&cursor&limit` → `{data, nextCursor}` | Yeni müşteri (modal veya `/customers/new`: **iki ayrı ekran aynı işi yapıyor**). Zod: `fullName` min 2, `phone` min 7, `email` opsiyonel, `birthDate` opsiyonel; API: `DUPLICATE_PHONE`. |
| **customers/new** | aynı form (tam sayfa) | `POST /customers` | `isError` işleniyor. |
| **customers/[customerId]** | Başlık: ad; rozet segment (**VIP, Düzenli, Pasif, Risk Altında**), telefon, e-posta, doğum günü, alerji/tercih notları, toplam ziyaret, harcama toplamı (`lifetimeValue`), son ziyaret, telefon doğrulandı, kayıt tarihi; 4 sekme (Genel, Müşteri Hakkında/anamnez*, Fotoğraflar*, Ziyetler/Randevular) *modül açıksa | `GET /customers/:id`, `GET /customers/:id/photos`, anamnez `GET/PUT …/anamnesis`, paketler (`customer-packages-section`) | Düzenle (`edit-customer-modal`: `fullName,phone,email,birthDate,allergyNotes,preferenceNotes`), fotoğraf ekle (URL), kategori süzgeci (Tümü, Saç Öncesi/Sonrası, Tırnak, Cilt, Diğer), lightbox, fotoğraf sil, paket sat/kullan, anamnez doldur. **`marketingConsentSms/Email` API'de var, arayüzde gösterilmiyor ve değiştirilemiyor** (KVKK/İYS için hukuk-uyum bakacak). Hata durumu yok (`isError` 0). |
| **packages** | Paketler (ad, hizmet, seans sayısı, fiyat, geçerlilik gün, aktif) | `GET/POST/PATCH/DELETE /packages`; `customer-packages` | Paket modalı: `serviceId`, `name 2–100`, `totalSessions 1–100`, `price>0`, `validityDays 1–1095` (ops.), `description≤500`, `isActive`. Silme: `PACKAGE_IN_USE` hatası. Satış modalı: `packageId`, `pricePaid>0`, `notes`. Kullanım: `POST /customer-packages/:id/use` (hatalar: `PACKAGE_EXPIRED`, `NO_SESSIONS_LEFT`, `PACKAGE_NOT_ACTIVE`). |

**Personel ve hizmet**

| Ekran | Veri / API | Eylemler ve formlar |
|---|---|---|
| **services** | `GET /services?includeInactive=true` → ad, kategori, süre dk, fiyat, aktif; ayrıca stok reçeteleri (`service-recipes-section`, modül açıksa) | `service-modal`: `name≥2`, `category` (iş türüne göre öneri listesi + özel kategori), `durationMinutes≥5`, `price≥0`, `isActive`; takip (follow-up) satırları `{day 1–365, label≤50}` (ayar açıksa). `DELETE`/`PATCH` aktif-pasif. |
| **staff** | `GET /staff` → kart: ad, unvan, e-posta, renk, çalışma saatleri, yetenekler | `staff-modal` (ekle: `fullName, email, password≥8, title≥2, colorCode 0–7`; düzenle: `title, bio, colorCode`); `DELETE`. **Yalnız owner/manager** (staff için menüde gizli). |
| **staff/[staffId]** | profil, hizmet atamaları (`/staff/:id/services`), izinler (`/staff/:id/leaves`; tipler `day_off, sick_leave, vacation, other`), ödeme geçmişi (`/staff-payouts?staffId=`), çalışma saatleri seçici (`working-hours-picker`: 7 gün, her gün başlangıç/bitiş veya kapalı) | atama ekle/kaldır, izin ekle/sil, çalışma saati kaydet. 727 satır. |
| **staff-payouts** | `GET /staff-payouts?from&to&staffId` → dönem, brüt kazanç, ikramiye, kesinti, net, ödeme yöntemi (nakit/kart/karışık/online), durum (Bekliyor/Ödendi/İptal) | oluştur (`staffId, periodStart, periodEnd, bonus≥0, deductions≥0, notes≤500`; `GET /staff-payouts/calculate` ile hesap), düzenle, "ödendi" işaretle, sil (**`window.confirm`**). Yalnız owner/manager. |
| **tips** | `GET /tips`, `/tips/summary` (personel bazlı toplam), dağıtım geçmişi | ekle (`source: cash|card|salon_pool`, `staffId?`, `appointmentId?`, `amount>0`, `notes≤500`), **havuzu dağıt** (`POST /tips/distribute`), sil. |

**Finans ve stok ("Muhasebe/Yönetim" grubuna taşınacak olanlar, brif #7)**

| Ekran | Veri / API | Eylemler |
|---|---|---|
| **finance** ("Kasa") — 860 satır | Dönem seçici (Bugün/Hafta/Ay/Yıl/Özel aralık); toplam ciro, nakit, kart, net, tamamlanan adet; günlük dağılım tablosu; gelirler (saat/müşteri/hizmet/tutar/ödeme); personel komisyonları; giderler. `GET /reports/daily`, `/reports/staff-commissions?date=` | Manuel gelir ekle (`description, amount>0, paymentMethod cash|card, revenueDate`), gider ekle (`title, category (+özel kategori), amount>0, expenseDate`), gider sil, **Gün sonu kapat** (`POST /finance/close-day?date=`) + yazdır (yeni sekme). **Hata durumu yok**. Yalnız owner/manager (staff yönlendirilir). Menüde adı "Günlük Kasa", sayfa başlığı "Kasa", modül adı "Finans": üç ad. |
| **accounts** (Banka & Kasa) | `GET /accounts?includeInactive=true` | hesap oluştur/düzenle (`type: cash|bank|pos|credit_card|other`, ad, `currency` 3 harf, `openingBalance`, `isDefault`), virman (`POST /transactions/transfer` `{from,to,amount>0,date}`), hesap detayı + hareketler (`GET /accounts/:id`), hareket ekle (`type income|expense|adjustment`, `amount>0`, müşteri/tedarikçi bağlama, `linkToCurrentAccount`), hareket sil. Yazma: owner/manager; okuma: staff dahil. |
| **current-accounts** (+ `[partyType]/[partyId]`) | Müşteri/tedarikçi cari liste (borç, alacak, bakiye); ekstre `…/entries` | hareket ekle (`partyType customer|supplier`, `debit/credit`, `referenceType manual|opening_balance|appointment|invoice|purchase_invoice|payment|refund|adjustment`, `accountId` ops.), hareket sil. |
| **purchase-invoices** (+ `new`, `[id]`) | Fatura listesi; detay | yeni: `supplierId`, `invoiceDate`, `dueDate?`, kalemler (≥1, ≤200: `inventoryId?`, ad, `quantity≥1`, `unitPrice≥0`, `taxRate 0–100`, `discount`), `post` (hemen muhasebeleştir); detayda **Muhasebeleştir** (`/post`), **İptal** (`/cancel`), sil. Hatalar: `NOT_POSTED, NOT_EDITABLE, NOT_LATEST`. |
| **suppliers** | `GET /suppliers?includeInactive=true` | modal: `name`, `phone`, `email`, `notes≤500`; sil/aktif-pasif. İki yerde ayrı modal (`inventory/page` ve `suppliers/page`). |
| **inventory** | `GET /inventory`, `/inventory/low-stock`, tedarikçiler; hareket paneli `/inventory/:id/movements` | ürün modalı (`name 1–120`, `sku≤60`, `quantity` tam sayı ≥0, `lowStockThreshold`, `unitCost`, `sellingPrice?`, `unit 1–20`), hareket modalı (`type in|out|adjustment_in|adjustment_out|waste|return|transfer_in|transfer_out`, `quantity` tam sayı >0, `unitCost?`, `supplierId?`, `notes≤500`), hareket sil, ürün sil. **Miktar yalnız tam sayı** (gram/ml/yarım birim girilemez: kuaför/kozmetik için sınırlayıcı). Düşük stok bandı. |
| **bot-conversations** | `GET /bot-conversations?page&limit&outcome&channel` (sayfa numaralı!), detay `GET /:conversationId` | Salt okunur; bayrak kapalı olduğu için bugün erişilemez. El yapımı modal. |

**Ayarlar** (`settings`, 1008 satır, sekmeler: **Salon Profili · Modüller · Hesabım**; bayrakla **Entegrasyonlar · Bot Ayarları**)
- *Salon Profili:* ad (min 2), telefon (min 7), adres (min 5), çalışma saatleri (7 gün seçici), işletme türü (11), hizmet kategorileri (liste ekle/sil), **online randevu açık/kapalı** (`publicBookingEnabled`) ve randevu bağlantısı, takip hatırlatıcıları (`followUpEnabled`), marka rengi (`#RRGGBB`), logo URL, kapak URL, WhatsApp, Google Maps linki, kısa tanıtım (≤500, XSS süzgeçli), anamnez soruları yöneticisi (ekle/düzenle/sırala/sil). Hepsi `PATCH /settings` (yalnız owner/manager). Zod'lu form yalnız ilk 3 alanda; diğerleri elle durum.
- *Modüller (`settings/modules` + panel):* 18 modülün aç/kapa listesi, şablonlar (Tam, Salon, Berber, Nail Studio). Yeni sistemde brif #7 ile "Muhasebe/Yönetim" grubuna hizalanmalı; `MODULE_REGISTRY` kategorileri (core, customer, finance, staff, inventory, automation, marketing) menü gruplarıyla (GÜNLÜK, MÜŞTERİ, PERSONEL & HİZMET, FİNANS & STOK) **eşleşmiyor**: iki ayrı sınıflama var.
- *Hesabım:* mevcut/yeni şifre (+tekrar) → `PATCH /users/:userId/password`. Başka profil alanı yok (ad, e-posta, telefon değiştirilemez); oturumu kapat yalnız kenar çubuğunda.
- *Eksik/yok:* abonelik/plan/fatura ekranı (plan yalnız kenar çubuğunda "Deneme: N gün" rozeti), KVKK hakları (veri dışa aktarma, hesap silme), bildirim tercihleri, kullanıcı/rol yönetimi, denetim kaydı.

**subscription-required:** "Deneme Süreniz Doldu" + eylem (satın alma akışı **yok**; ödeme/iyzico entegrasyonu kodda bulunmuyor).

### 4.4 Müşterinin online randevu sayfası (`/book/[slug]`) — Operate
5 adım + başarı, geri düğmesi, mobil öncelikli. Salonun `brandColor`, logo, kapak, hakkında metni, adres/telefon/WhatsApp/harita bağlantısı kullanılır.
1. **Hizmet** (`GET /public/services`: ad, süre, kategori; **fiyat yok**) 2. **Personel** ("fark etmez" = `any`; `GET /public/staff?serviceId` → ad, unvan) 3. **Tarih** (`<input type="date">`) 4. **Saat** (`GET /public/slots?serviceId&staffId&date` → `{slots:[{id,label,available,staffId}]}`) 5. **İletişim:** ad (zorunlu), telefon (zorunlu), **SMS doğrulama kodu** (`POST /public/verify/send` → 60 sn bekleme, `verify/confirm`), Turnstile CAPTCHA; `POST /public/book` → `referenceCode`. Başarı: referans kodu.
- **Durumlar:** salon yok/`publicBookingEnabled=false` (`BOOKING_DISABLED`) → hata ekranı; slot dolu/geçmiş saat → ilgili adıma dönüş + bildirim; `RATE_LIMIT` (saatte 5 deneme), `CAPTCHA_FAILED`, `PHONE_NOT_VERIFIED`, `INVALID_PHONE`. `isError` 1.
- **Yok:** randevuyu görüntüleme/iptal/değiştirme, hesap, e-posta, not alanı (API `notes` kabul ediyor ama arayüz göndermiyor), takvime ekle, KVKK aydınlatma bağlantısı/onay (SMS ile kod gönderilen telefon kişisel veri: **hukuk-uyum**).
- Kendi `publicFetch`'i var, varsayılan adres `http://localhost:3001`.

### 4.5 Süper yönetici (`/admin/…`) — Operate
- **admin/login** (yukarıda), **admin/dashboard:** `GET /admin/stats` → `stats` (toplam salon, vb. 4 KPI), **admin/tenants:** arama + plan süzgeci (trial/starter/pro) + aktif süzgeci, liste (ad, slug, plan, deneme bitişi, aktif, kayıt tarihi, sahibi `users[0]`), **admin/tenants/[id]:** detay + etkinlik (`totalAppointments, totalCustomers, totalRevenue, lastActivityAt`), **Plan** ve **Deneme Bitiş Tarihi** düzenleme, aktif/pasif (onay diyaloğu).
- Oturum yenilemesi yok; `isError` hiçbir yerde işlenmiyor; plan adları İngilizce ("Trial/Starter/Pro"); yan menü `admin-sidebar`.

---

## 5. Bileşen envanteri

### 5.1 Yeniden kullanılacak (yeni görünümle sarmalanarak)
| Bileşen | Neden korunur | Gerekli değişiklik |
|---|---|---|
| `Button` (cva: default/outline/ghost/destructive/link; sm/default/lg/icon; `loading`) | API iyi; 44 px yükseklik zaten var | `ring-ring` düzeltmesi, token renkler, `type="button"` varsayılanı, `loading` iken `aria-busy` |
| `Dialog` (Radix) / `ConfirmDialog` | Odak tuzağı, `Esc`, `aria` Radix'ten; silme akışları bunu kullanıyor | Mobilde alt sayfa (bottom sheet) varyantı (şu an ortalanmış kutu, `max-h 90vh`); animasyon eklentisiz yeniden yazılır; "Bekleyin..." → "Kaydediliyor…" |
| `Skeleton`, `Card` | basit | token |
| `Toaster` (Radix Toast, özel mağaza) | yapı çalışır | `aria-live`, hata toast'ının daha uzun süre kalması, ikon rengi ≠ tek renk bağımlılığı, üst üste istif sınırı |
| `working-hours-picker`, `staff-colors` (8'li palet), `useActiveModules`, `use-debounce`, `formatCurrency/Date/Time` (`tr-TR`) | iş mantığı değerli | `formatCurrency` `minimumFractionDigits: 0` → kuruş gösterilmez (kasada sorun); saat dilimi `Europe/Istanbul` verilmiyor (tarayıcıya bağlı) |
| Anamnez, paket, stok, bahşiş, bekleme modalları | iş mantığı (zod şemaları, API sözleşmesi) | görünümleri ortak `Modal`/`FormField` altında yeniden |

### 5.2 Atılacak / yeniden yazılacak
| Bileşen | Sebep |
|---|---|
| `Input`, `Select`, `Textarea`, `Label` | `Label` `htmlFor` bağı yok; `Input` `useId`/`aria-describedby`/`aria-invalid`/`role="alert"` yok; `Select` yerel `<select>` (mobilde iyi, ama stil/boş değer/yerelleştirme tutarsız). Auth sayfaları bunları **hiç kullanmıyor** (satır içi `style` + `onFocus` ile elle halka). → tek `Field` (etiket+kontrol+ipucu+hata) bileşeni. |
| `mouse-orbs.tsx` + auth cam kartları + noise SVG + `shadow-glass/glow` | marka kaygısına ters ("şablon/yapay zekâ izi"), performans ve kontrast (`text-white/20-40`) |
| `landing/*` (11 bileşen) | içerik ve animasyon yeniden; hepsi `'use client'` |
| `sidebar.tsx` + `mobile-nav.tsx` | çoğaltılmış menü verisi, el yapımı çekmece. → tek `navConfig` + `AppShell` |
| `bot-conversations` el yapımı modal, `window.confirm` kullanan 2 yer | Dialog/ConfirmDialog'a |
| `kpi-card`, `todays-appointments` | görsel ve durum yönetimi yeniden |
| Tüm `style={{…}}` (267) ve satır içi hex (`#6B48FF` 69×, `#1F3E47` 49×, `#E89B96` 15×) | token + sınıf |
| `.dark .bg-white …` genel geçersiz kılmalar (`globals.css`) | koyu tema hilesi (bkz. §6) |

### 5.3 Yeni yazılması gerekenler
`AppShell`/`PageHeader`, `QueryState`/`EmptyState`/`ErrorState`/`Forbidden`, `Field`, `DataTable`/liste kalıbı (bugün her sayfa kendi `<table>`'ını yazıyor; mobilde kart dönüşümü yok, birçok tablo yatay taşar), `StatusBadge` (6 randevu + segment + ödeme durumu için tek kaynak; bugün 4 yerde ayrı), `Modal`/`Sheet` (mobil alt sayfa), `DatePicker/TimePicker` (bugün yerel `datetime-local`), `ConfirmDialog` (kalır), `RoleGate`/`useCan(permission)` (rol bazlı görünürlük, brif #4), `Money` (₺ biçim, kuruş kuralı).

**FullCalendar kısıtı:** olay kutusu, saat çizgisi, başlık ve araç çubuğu CSS ile büyük ölçüde özelleştirilebilir (`.fc-*` sınıfları, CSS değişkenleri: `--fc-border-color`, `--fc-today-bg-color`, `--fc-event-bg-color` …); ama etkinlik içeriği render fonksiyonuyla serbest, başlık/araç çubuğu düzeni sınırlı. Tasarım "kendi yapım takvim" gerektiriyorsa maliyeti yüksektir (sürükle-bırak, çakışan randevu yerleşimi, mobilde gün görünümü). Öneri: FullCalendar tutulur, görünüm CSS değişkenleri ve etkinlik render'ı ile markaya çekilir; araç çubuğu kendi bileşenimizle (`headerToolbar: false` + `calendar.prev()/next()/changeView()` API'si).

---

## 6. Tasarım tokenlarının Tailwind'e aktarımı — öneri

**Ön koşul:** Tailwind v4 tek sürüm olarak sabitlenir, `tailwindcss ^3.4.19` bağımlılığı ve `tailwind.config.ts` kaldırılır; `@tailwindcss/forms` eklentisi bırakılabilir ya da (tüm girdiler kendi `Field`'imizden geçeceğinden) çıkarılır. Animasyon eklentisi eklenmez, kendi `@keyframes`.

**Üç katman** (`src/styles/tokens.css`; Tailwind `globals.css` bunu içe aktarır):

1. **Ham renk ölçekleri (primitive)** — tema bağımsız, yalnız bu katmanda hex vardır:
   `--ref-petrol-50 … 950` (marka: `#1F3E47` çıpa), `--ref-pudra-*` (`#E89B96`), `--ref-mor-*` (`#6B48FF`), `--ref-gri-*`, durum renkleri `--ref-yesil-*`, `--ref-kehribar-*`, `--ref-kirmizi-*`, `--ref-mavi-*`. Ölçek adımlarını ui-ux-tasarimci belirler; ben yalnız adlandırma kuralını öneriyorum.
2. **Anlamsal (semantic) tokenlar** — bileşenlerin **yalnız** kullandığı katman; koyu tema yalnız bu katmanı yeniden eşler:
   ```css
   :root {
     --surface-page:    var(--ref-gri-50);
     --surface-raised:  #fff;                 /* kart, modal */
     --surface-sunken:  var(--ref-gri-100);   /* girdi arka planı, tablo başlığı */
     --text-strong:     var(--ref-gri-900);
     --text-default:    var(--ref-gri-700);
     --text-muted:      var(--ref-gri-600);   /* 4.5:1 kontrastı sağlayan en açık değer */
     --border-subtle:   var(--ref-gri-200);
     --border-strong:   var(--ref-gri-300);
     --action-primary:        var(--ref-petrol-700);
     --action-primary-hover:  var(--ref-petrol-800);
     --action-on-primary:     #fff;
     --accent:                var(--ref-pudra-500);
     --focus-ring:            var(--ref-mor-600);   /* 3:1 kontrast, tek odak rengi */
     --state-success-fg/bg/border, --state-warning-*, --state-danger-*, --state-info-*
     --status-pending/confirmed/in-progress/completed/cancelled/no-show-(fg|bg|border)
     --space-… (4 px ölçeği), --radius-sm/md/lg, --shadow-1/2/3, --duration-fast/base, --ease-out
   }
   :root[data-theme="dark"] { /* BOŞ — koyu tema sonra, yalnız semantic atamalar yazılacak */ }
   ```
   Koyu tema için **sınıf yerine `data-theme`** önerisi: `color-scheme` ile birlikte okunur, tek yerden. Mevcut `localStorage` anahtarı (`beautyos-theme-v2`) ve `<head>` betiği yeni attribute'a uyarlanır.
3. **Tailwind eşlemesi** — `@theme inline` ile anlamsal tokenlar yardımcı sınıfa çevrilir (`inline` şart: değerleri CSS değişkeni olarak çalışma zamanında çözsün, koyu tema geçişi derlemeyi gerektirmesin):
   ```css
   @import "tailwindcss";
   @theme inline {
     --color-page: var(--surface-page);
     --color-surface: var(--surface-raised);
     --color-sunken: var(--surface-sunken);
     --color-fg: var(--text-strong);
     --color-fg-muted: var(--text-muted);
     --color-line: var(--border-subtle);
     --color-primary: var(--action-primary);
     --color-primary-hover: var(--action-primary-hover);
     --color-accent: var(--accent);
     --color-danger: var(--state-danger-fg);   /* …devamı */
     --font-sans: var(--font-inter), system-ui, sans-serif;
     --radius-md: …;  --shadow-card: var(--shadow-1);
   }
   ```
   Kullanım: `bg-surface text-fg border-line`, **hiçbir bileşende `bg-white`, `text-gray-*`, `dark:` veya hex yok**. Böylece "koyu tema ekle" = yalnız §2'deki `[data-theme="dark"]` bloğunu doldurmak.

**Adlandırma kuralı** (koyu temaya hazır olmanın ölçütü): ad **rolü** anlatır (`surface`, `fg`, `line`, `danger`), rengi değil (`white`, `gray`, `purple` değil). Durum renkleri (`bekliyor`, `tamamlandı` vb.) hiçbir zaman yalnız renkle verilmez: ikon/etiket de olmak zorunda (WCAG 1.4.1).

**Yazı ölçeği:** en küçük 12 px (şu an 71 yerde 9–11 px); gövde 14–16 px; mobilde girdi 16 px (iOS yakınlaştırmasını önler). **Dokunma hedefi:** 44 px (zaten `touch-target` var; yeni sistemde tüm etkileşimli öğelere zorunlu kalıp). `font-variant-numeric: tabular-nums` para ve saat sütunlarında. Tarih/para: `Intl` ile `tr-TR` + `Europe/Istanbul`, kuruş gösterimi kararı (kasada ondalık gerekir).

**Hareket:** `prefers-reduced-motion` desteği şu an yok (framer-motion 16 dosya); yeni sistemde CSS geçişleri öncelikli, `framer-motion` yalnız gerekliyse ve `LazyMotion` ile.

---

## 7. API'nin tasarımı kısıtlayan yanları ve backend gerektiren fikirler için uyarı listesi

### 7.1 Kısıtlar (bugünkü sözleşme)
| # | Kısıt | Nerede | Tasarıma etkisi |
|---|---|---|---|
| K1 | Hata gövdesi `{ error: { code, message } }`; istemci yalnız `message` kullanır. 25+ farklı `code` var (`SLOT_TAKEN`, `DUPLICATE_PHONE`, `STATUS_LOCKED`, `PACKAGE_IN_USE`, `RATE_LIMIT`…). Mesajlar API'de sabit Türkçe | tüm API | Hata metinlerini arayüz `code`'a göre kendisi yazabilir (teknik-yazar metin rehberi ile); bugün sunucu mesajı olduğu gibi gösteriliyor. |
| K2 | `VALIDATION_ERROR` mesajı genel ("Geçersiz müşteri verisi."), **alan bilgisi dönmüyor** | `tenant.route.ts` (83 yer) | Sunucu doğrulama hatası alana bağlanamaz; "satır içi alan hatası" yalnız istemci zod ile mümkün. |
| K3 | Liste uçlarında sayfalama yok (müşteri hariç); randevu `limit` ≤100, tarih aralığı var | §0-9 | Uzun tablolar için sanallaştırma/"daha fazla" tasarımı ancak istemci tarafı. |
| K4 | `GET /dashboard`: yalnız 4 sayı + 2 değişim; gelir grafiği/seri verisi, en çok satan hizmet, personel bazlı kırılım **yok** | `tenant.route.ts:159` | Dashboard'da grafik/çizgi görseli veri bulamaz; `reports/daily` (günlük dağılım) kullanılabilir ama yalnız kasa için. |
| K5 | Randevu listesi öğesi: müşteri adı/telefonu, hizmet, personel, saat, durum, tutar, not, personel rengi. **Müşteri id'si, hizmet id'si, süre, ödeme durumu, referans** (referans var) yok → randevudan müşteri kartına geçiş ve "tekrar randevu" için ek istek gerekir | `tenant.route.ts:350-374` | "Müşteri kartına git" kısayolu tasarlanırsa `customerId` eksik. |
| K6 | Müşteri listesi öğesi: ad, telefon, e-posta, ziyaret sayısı, son ziyaret, kayıt tarihi; **segment, harcama, etiket yok** (detayda var) | `tenant.route.ts:433` | Listede VIP/Pasif rozeti göstermek için API alanı gerek (B6). |
| K7 | Müşteri araması yalnız ad/telefon, ≥2 karakter, dakikada sınırlı (`searchLimiter`) | `tenant.route.ts:383,143` | Anlık arama (her tuş) hız sınırına takılabilir; `use-debounce` gerekli. |
| K8 | Bildirim, bildirim merkezi, "okunmamış" kavramı yok | — | Tasarımda zil/bildirim listesi önerilirse backend (B7). |
| K9 | Çok kullanıcılı çalışma ipuçları (kim düzenliyor, gerçek zamanlı güncelleme, WebSocket) yok; yenilemeler sorgu zamanlayıcısıyla | — | Canlı güncelleme tasarlanmamalı. |
| K10 | Oturum: erişim token'ı gövdede döner, localStorage'da; yenileme httpOnly çerezde. Admin tarafında yenileme yok (15 dk sonra düşer, olası) | `lib/api.ts`, `admin-api.ts` | Çıkış/oturum sona erdi ekranı tasarımı gerekli; "beni hatırla" seçeneği yok. |
| K11 | Ödeme/abonelik ucu yok (iyzico/Stripe vb. entegre değil); plan alanı yalnız `trial|starter|pro` (admin düzenler) | `admin.route.ts` | "Planı yükselt/öde" ekranı tasarlanırsa yalnız "yakında" olarak işaretlenebilir (brif #15). |
| K12 | Raporlar: günlük/dönem ciro + personel komisyonu; **hizmet bazlı, müşteri bazlı, tahsilat yaşlandırma, vergi** raporları yok; dışa aktarma (CSV/PDF) yok (yazdır hariç) | `tenant.route.ts` raporlar | "Raporlar" bölümü tasarlanacaksa kapsam yalnız mevcut iki rapor. |

### 7.2 Backend gerektirecek tasarım fikirleri için erken uyarı
Tasarımcı bu özellikleri çizerse prototipte **"yakında"** işaretlenmeli veya `gelistirici`/`mimar` ile iş kalemi açılmalı:

| Kod | Fikir | Neden bugün olmaz | Büyüklük |
|---|---|---|---|
| **B1** | Sayfalama/imleç, tarih aralığı ve `limit>100` randevu listesi; takvim için hafif "özet" ucu | §0-1, §0-9 | orta |
| **B2** | Doğru saat dilimi (İstanbul günü) ve tam ISO (`Z`'li) slot kimliği | §0-10 | küçük-orta |
| **B3** | **Unvan/izne göre özel yetki** (rol-izin matrisi, `manager` oluşturma, personele müşteri alanı kısıtı), kullanıcı yönetimi ekranı, personel için ayrı giriş daveti (bugün şifreyi sahibi belirliyor) | §0-7, §0-8 | büyük (veri modeli + her uçta kontrol) |
| **B4** | Dosya/kamera ile fotoğraf, logo, kapak yükleme (depolama + boyut/tür doğrulama + silme) | §0-11 | orta-büyük |
| **B5** | Online randevuda fiyat gösterme, personel fotoğrafı, randevu sorgula/iptal (referans kodu + telefon doğrulaması), e-posta onayı, takvime ekle | §0-12 | orta |
| **B6** | Müşteri listesinde segment/etiket/toplam harcama; gelişmiş filtre; toplu işlem; içe aktarma | K6 | orta |
| **B7** | Bildirim merkezi, "randevu yaklaşıyor" hatırlatma ayarları ekranı (hatırlatma kuyruğu var — `remindersQueue` — ama yönetim arayüzü/ayarı yok), SMS bakiyesi | K8 | orta |
| **B8** | Dashboard grafikleri: gelir serisi, hizmet/personel bazlı kırılım, iptal/gelmeme oranı | K4 | küçük-orta |
| **B9** | Ödeme/abonelik: plan seçimi, faturalar, kart kaydı | K11 | büyük + kurucu kararı |
| **B10** | KVKK hakları: müşteri verisi dışa aktarma/silme, onay (rıza) kayıtları, kayıtta aydınlatma/şart onayı sürümü, İYS | denetim #2 + hukuk-uyum | orta |
| **B11** | Stok miktarının ondalık olması (ml/gr), birim dönüşümü | `quantity` `int` (`stock.route.ts`) | orta (veri modeli) |
| **B12** | Ödeme yöntemi çeşitliliği (havale, paket bakiyesinden düşme, karışık) randevu kapanışında | `paymentMethod: cash|card` | küçük-orta |
| **B14** | **API hata sözleşmesi iyileştirmesi** (kaynak: `metin-rehberi.md` §4, teknik-yazar önerisi; kodlama aşamasında `gelistirici` ile): (a) `VALIDATION_ERROR` yanıtına **alan adı** eklenmesi (K2: bugün satır içi alan hatası sunucudan çıkamaz); (b) her hata yanıtına **istek no** (referans) eklenmesi, böylece "Referans: [istek no]" metni gösterilebilir; (c) `SLOT_CONFLICT` ve `APPOINTMENT_CONFLICT` tek koda indirilmesi; (d) webhook ve telefon doğrulama zarflarının `{ error: { code, message } }` biçimine tekleştirilmesi (webhook şu an düz İngilizce `{ error: 'Unauthorized' }`); (e) istemcide ortak `hataMetni(code, bağlam)` işlevi (benim işim: ~45 `toast(err.message,'error')` yeri ve `apiFetch` ağ hatası §4.7 metniyle bu işleve bağlanır; `book/[slug]` mesaj metni arama kalıbı `code`'a geçer). | küçük-orta |
| **B13** | Çok şubeli işletme / birden çok salon, kullanıcı birden çok kiracıda | tek `tenantId` | büyük |

### 7.3 Frontend tarafında çözülebilecek, API gerektirmeyen düzeltmeler (yeni tasarımın kapsamında)
Takvim sorgusu aralığa bağlanır (§0-1); `error.code`'a göre hata metni/eylem; ortak `QueryState`; ortak yetkilendirme sarmalayıcısı; `customerId` olmadığı için randevudan müşteriye bağ yerine ad+telefon araması; müşteri seçicide arama (`search`) kullanımı; iş türü listesi tek kaynak; 401/402 router tabanlı yönlendirme.

---

## 8. Bugünkü rol / görünürlük durumu (`urun-analisti` karşılaştırması için)

| Konu | Davranış (doğrulandı) |
|---|---|
| Roller | `owner`, `manager`, `staff`, `superadmin`; personel oluşturulurken daima `staff` |
| Menüden gizlenenler (`staff`) | `/staff`, `/staff-payouts`, `/finance`, `/settings` (yalnız bu 4; `endsWith` eşlemesi ile) |
| Menüde `staff` için görünen, ama API'de **yazma yasak** olanlar | Banka & Kasa, Cari Hesap, Alış Faturaları (okuma serbest; yazma `owner|manager`), Tedarikçiler/Stok (yazma yasak, `stock.route.ts:77`), Paketler (yazma yasak) |
| Sayfa düzeyi istemci denetimi | Finans: `staff` ise yönlendirilir; Stok: rol denetimi var (`inventory/page.tsx:26`); diğerleri yok |
| Randevu silme / ayar değiştirme / personel ekleme | API: yalnız `owner|manager`; çekmecede "Sil" düğmesi `isManager`'a bağlı |
| `staff` randevu listesi | API yalnız kendi randevularını döndürür; müşteri/hizmet/personel listeleri tam açık |
| `staff` gösterge paneli | yalnız "Randevular" kartı |
| Süper yönetici | ayrı giriş ve token; salonlar üzerinde plan/deneme/aktiflik |

Bu tablo, `roller-ve-akislar.md` ile uyuşmazlık çıkarsa kod tarafı doğru kabul edilmelidir (bugünkü davranış); ürün kararı ise farklı olabilir ve §7.2-B3 kapsamındadır.

---

## 9. Tasarımcıya somut istekler / açık sorular

1. **Yazı tipi:** `latin-ext` destekli tek aile (Inter korunabilir ya da değişir). Kararınızı bildirin, `next/font/local` ile yerleştiririm.
2. **Koyu tema anahtarı** yeni prototipte gösterilecek mi? Öneri: tokenlar hazır, anahtar yok.
3. **Takvim:** FullCalendar'ı koruyup markaya çekmek mi (öneri), yoksa özel mi? Mobilde gün/3 gün görünümü ve araç çubuğu konumu.
4. **Menü yapısı:** brif #7 "Muhasebe/Yönetim" grubu — hangi öğeler (Kasa, Banka & Kasa, Cari, Alış Faturaları, Tedarikçi, Stok, Personel Ödemeleri, Bahşiş?) bu gruba girer; `MODULE_REGISTRY.category` ile aynı sınıflama kullanılacak mı?
5. **Mobil kabuk:** 5'li alt çubuk (Bugün, Randevu, Müşteri, Bekleme, Tümü) korunuyor mu? Personel görünümünde ne olur?
6. **Slug alanı** kayıtta kullanıcıya gösterilecek mi (adres önizlemesi: `…/book/salon-adi`) yoksa gizlenip arka planda mı üretilecek?
7. **Foto/logo yükleme** için §0-11/B4: prototip "yakında" mı gösterir, yoksa URL alanı mı?
8. **Dashboard grafikleri** (B8) çizilecekse "yakında" işareti.
9. Marka varlıkları: logo (SVG, açık/koyu), favicon seti, OG görseli ölçüleri (1200×630) tasarımın çıktısı olarak istenir.

## 10. Kabul ölçütleri: uyum (hukuk-uyum, taslaktır, avukat görüşü değildir)

Kaynak: `inceleme-hukuk-uyum.md` U5 ve U7. Kodlama görevlerinde kabul ölçütüdür; denetçi kontrol eder.

- **U7 (üçüncü taraf isteği yok).** Üretimde Google Fonts, CDN, analitik ya da başka üçüncü taraf alan adına istek gitmez. Hanken Grotesk ve Inter (yalnız ₺ glifi) `next/font` ile derleme zamanında indirilip kendi alan adımızdan sunulur (ağ kapalı derlemede `next/font/local`). Prototipteki Google Fonts `<link>` yalnız prototipe aittir. **İstisna (hukuk-uyum görüşü, taslak):** Cloudflare Turnstile (`challenges.cloudflare.com`) kalır, zorunlu güvenlik önlemidir. Yalnız randevu (ve gerekiyorsa kayıt) sayfasında yüklenir, diğer sayfalarda yüklenmez; çerez politikasında "zorunlu" kategoride, alt işleyen listesinde ve salon aydınlatma şablonunda yer alır; rıza bannerı gerekmez. Tasarımda randevu-al'a bot doğrulama adımı/alanı çizilmeli (Turnstile yönetilen/görünmez mod). Kod incelemesinde `fonts.googleapis.com`, `fonts.gstatic.com`, `challenges.cloudflare.com`, `cdn.` dizgeleri aranır; CSP ile doğrulanır.
- **Takvimde sürükle-bırak (müdür kararı, kurucu brif #3 "işlev kaybolmaz").** İlk sürümde vardır. Takvim bileşeni kararı kurucuda; müdür önerisi ve tasarım varsayımı kendi CSS Grid takvimimiz. Kabul ölçütü: (1) yalnız sahip ve müdür sürükleyebilir; (2) yalnız gelecekteki ve sonlanmamış (tamamlandı/iptal/gelmedi olmayan) randevu taşınır; (3) bırakınca `PATCH /appointments/:id/reschedule`, başarısızlıkta (`SLOT_CONFLICT`, `PAST_TIME`, `STAFF_NOT_SKILLED`) randevu eski yerine döner ve Türkçe hata gösterilir; (4) klavye ve dokunmatik alternatifi "Saati değiştir" katmanıdır, her taşıma onunla da yapılabilir; sürükleme yalnız hızlandırıcıdır; (5) dokunmatikte uzun basma ile başlar, normal kaydırmayı bozmaz; sürüklerken hedef personel sütunu ve 15 dk dilim vurgulanır, boş olmayan dilim reddedilir; (6) `prefers-reduced-motion` ve ekran okuyucu için taşıma sonucu `role="status"` ile duyurulur. **Tahmini ek süre:** kendi takvimimizde sürükle-bırak yaklaşık 2-3 gün ek (işaretçi olayları, dokunmatik/kaydırma çakışması, çakışma ve geri alma testleri); takvim gövdesi (CSS Grid, sütunlar, şimdi çizgisi, 15 dk dilim, kısa randevu düzeni) için önceki tahmin 2-3 gün aynen kalır, toplam yaklaşık 4-6 gün. FullCalendar korunursa (personel sütunu için ücretli eklenti gerekir, lisans doğrulanmadı) sürükleme hazır gelir ama lisans ve tasarım uyumu riski vardır.
- **U5 (müşteri randevu yönetim sayfası).** Değiştirme/iptal sayfası referans koduyla açılmaz; yalnız tahmin edilemeyen, süreli, tek amaçlı bağlantı (imzalı belirteç) ya da telefon doğrulama koduyla açılır. Telefon kodu doğrulandıktan hemen sonra aynı oturumda onay ekranından açmak sorun değildir (hukuk-uyum); ölçüt sonraki erişimler içindir (SMS/e-posta bağlantısı, sayfa yeniden açılması). Bugünkü API'de bu uç yok (`public.route.ts`); yeni uç gerekir (§7.2 B5/B10 kapsamı genişler). `randevu-al.html#degistir` prototipte doğrulamasızdır, üretimde öyle olmaz. Ayrıntı mimar ile netleştirilecek.

Bu belgedeki "doğrulandı/olası" ayrımı Aşama 3 incelemesinde prototiple karşılaştırılacak; tasarım bir bulguyu çelişkili bulursa kodun ilgili satırını bana bildirin, yeniden kontrol ederim.
