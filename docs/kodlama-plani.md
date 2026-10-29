# BeautyOS — Yeni Arayüz ve Güvenlik Kodlama Planı

- **Tarih:** 2026-10-29 · **Hazırlayan:** mimar · **Sürüm:** 1
- **Dayanak:** kurucu kararları `docs/tasarim-brief.md`. Kurucunun 2026-10-29 kalıcı izinleri 4–6 (şirket `CLAUDE.md`): görev sırası, teknik kararlar ve staging yayınları kurucuya sorulmaz. TEST GEÇTİ almış güvenlik düzeltmeleri canlıya alınabilir. SMS yokken online randevu, zorunlu salon onayıyla çalışır.
- **Girdiler:** `docs/tasarim.md` (0.9), prototip `docs/tasarim/prototip/`, `docs/tasarim-girdisi/` (`ekran-envanteri.md`, `roller-ve-akislar.md`, `metin-rehberi.md`, `yasal-ekran-gereksinimleri.md`), inceleme `raporlar/inceleme/beautyos-2026-10-28/` ve denetim raporu `raporlar/denetim/beautyos-2026-10-28-inceleme.md`.
- **Kod tabanı:** `tasima/docker` @ `e27e880` (staging). Canlıda `71ee311` çalışıyor.
- **Değişmeyen kural:** denetim döngüsü zorunludur (denetçi ONAY → test mühendisi TEST GEÇTİ). Hız için yalnız onay beklemesi kalkar, kalite kapısı kalkmaz.

---

## 0. Bugünkü durum (planı etkileyen gerçekler)

| Konu | Durum | Kaynak |
|---|---|---|
| DNS geçişi | 10-29 04:47'de yapıldı. Canlı trafik sunucuda | `tasima-plani.md` §10 |
| Railway/Vercel Git bağlantısı | **Kesildi** (G17-K0). `master` push'u artık hiçbir yere yayın yapmaz | `gorevler.md` G17 |
| Proje `CLAUDE.md` push uyarısı | **Eskidi.** "master/staging push = canlıya alma" bölümü G17-K0'dan önce yazıldı. Mimar `tasima/sunucu`'da güncelleyecek (bu görevin kapsamı dışında) | — |
| Push | Kurucu onayına bağlı. Canlı kodun tek kopyası bu bilgisayarda ve sunucudaki paketlerde | Şirket `CLAUDE.md` |
| Bu makinede `node`, `npm`, `docker` | **Yok** (mimar kontrolü, 10-29). Test, derleme ve E2E'nin nerede koşacağı T1'in ilk işi | — |
| Tailwind | Fiilen v4.2.3 çalışıyor (`@tailwindcss/postcss`). `tailwindcss@3.4.19` ve `tailwind.config.ts` ölü kalıntı | `package-lock.json` |
| Next | 14.2.35. **14.x desteği bitti**, 15.x'in iki yıllık bakım süresi 2026-10-21'de doldu. Desteklenen sürüm 16.x | nextjs.org/support-policy |
| Derleme | Her commit'ten 3 imaj çıkar: `api`, `web-prod`, `web-staging`. Web imajları birbirinden yalnız `derleme.conf` değerleriyle ayrılır | `derle.sh`, ADR-0018 |
| Sürüm etiketi | `.env`'de tutuluyor. Ajanlar `.env`'e dokunamadığı için her yayında kurucu gerekiyor. **Darboğaz.** Bkz. D1 | Kurucu kararı 3 |
| Online randevu | `e27e880`'de sağlayıcı yokken `/verify/send` 503 döner, yani online randevu fiilen kapalı. Kurucu kararı 5 bu akışı değiştirir (S2) | — |

---

## 1. Dal ve yayın stratejisi

### 1.1 Dallar
- **`gelistirme`**: bu işin tek ana hattı, `tasima/docker@e27e880`'den açılır. Bu dalın her commit'i hem canlıya hem staging'e derlenebilir olmalıdır.
  - Yeni arayüz canlıda bayrakla kapalı durur (§1.3).
  - `tasima/docker` bu andan sonra dondurulur. Canlıdaki `71ee311` bu dalın atasıdır.
- **Görev dalları:** `gorev/<no>-<kisa-ad>` (ör. `gorev/S1-finans-yetki`), `gelistirme`'den açılır.
  - Her ajan kendi `git worktree`'sinde çalışır. Ortak ağaçta (`tasima/sunucu`) dal değiştirilmez.
- **Birleştirme (müdür yapar, yereldir):** denetçinin ONAY verdiği dal `git merge --no-ff` ile `gelistirme`'ye alınır.
  - Çakışma çıkarsa birleştirme durur. Dal sahibi `gelistirme` üzerine rebase eder ve dalı "kısa kontrol" için denetçiye yeniden gönderir.
  - Çakışmasız birleştirme yeniden incelemeye girmez. Dosya sahipliği (§3.9) çakışmayı zaten önler.
- **`master`'a dokunulmaz.** `gelistirme`'nin `master`'a birleştirilmesi ve GitHub'a push'u kurucu kararıdır (§4, madde 1). Plan bu karara bağlı değildir: sunucu GitHub'dan çekmez.
- **`package-lock.json` sırayla değişir.** Kilit dosyasını değiştiren iki görev dalı aynı anda açık olmaz. Bu planda kilidi değiştiren görevler: S0, W1. Sonradan gelecek bağımlılık istekleri müdüre gider, müdür sıraya koyar.

### 1.2 Yayın
1. ONAY'lı dal `gelistirme`'ye birleşince müdür, `gelistirme` ucunu ADR-0019'daki yolla aktarır: `git -c core.autocrlf=false archive` → `certutil` → `scp`.
2. devops `derle.sh <tam-sha>` çalıştırır.
3. **Staging:** devops `surum.conf`'ta (D1) `BEAUTYOS_STAGING_VERSION`'ı değiştirir ve `docker compose up -d api-staging web-staging` çalıştırır. Kurucuya sorulmaz (kalıcı izin 4).
   - Sunucu belleği canlıyla ortak olduğu için staging yayınları toplu yapılır: günde en çok 2 derleme, yoğun olmayan saatte.
4. test-muhendisi staging'de kabul testini koşar.
5. **Canlı:** yalnız TEST GEÇTİ almış **güvenlik düzeltmeleri** kurucuya sorulmadan canlıya çıkar (kalıcı izin 4).
   - API ve web aynı etiketle birlikte yayınlanır, önce API. Geri alma da birlikte yapılır (denetim `beautyos-turnstile-tasarim-2` "Önemli 1").
   - Canlı web imajında yeni arayüz bayrağı kapalıdır. Kullanıcı eski arayüzü görür.
6. **Yeni arayüzün canlıda açılması** (yüzey yüzey bayrak) kurucu kararıdır (§4, madde 2).

### 1.3 Eski ve yeni arayüz bir arada: yüzey bayrağı (ADR-UI-02)
- Derleme anında okunan `NEXT_PUBLIC_UI_V2` değişkeni, açık yüzeyleri virgülle ayrılmış liste olarak taşır: `site,auth,panel,book,admin`.
  - `derleme.conf`'ta iki satır var: `NEXT_PUBLIC_UI_V2_PROD=` (boş) ve `NEXT_PUBLIC_UI_V2_STAGING=site,auth,panel,book,admin`.
  - Aynı commit staging'de yeni arayüzü, canlıda eskisini gösterir.
- **İki kök düzen.** Eski rotalar `app/(legacy)/` grubuna taşınır (URL değişmez; kendi `layout.tsx`'i ve eski CSS'i olur). Yeni rotalar `app/(v2)/` grubunda durur (yeni CSS, tokenlar ve yazı tipi).
  - Tailwind v4 temaları çakışmaz, çünkü her kök düzen yalnız kendi CSS'ini yükler.
  - Gruplar arası geçiş tam sayfa yüklemesidir. Bu kabul edilmiştir.
- **Yol eşlemesi** Next 16 `proxy.ts`'te yapılır (eski adı middleware):
  - Panel yeni adreste: `/panel/[slug]/…`. Bayrak açıksa `/tenant/[slug]/*` → `/panel/[slug]/<karşılığı>` (307). Bayrak kapalıysa `/panel/*` → 404.
  - Herkese açık sözleşme olan yollar değişmez: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/book/[slug]`, `/admin/*`. Bayrak açıksa bu yollar iç yola yeniden yazılır (`/v2/login` gibi; adres çubuğu değişmez). Bayrak kapalıysa `/v2/*` → 404.
  - Yeni tanıtım alt sayfaları (`/ozellikler`, `/fiyat`, `/sss`, `/iletisim`, `/kvkk`, `/gizlilik`, `/sartlar`, `/cerez`, sektör sayfaları) yalnız `site` bayrağıyla görünür.
- **Henüz yazılmamış ekran:** yeni kabukta "Bu ekran yeni arayüzde hazırlanıyor" bilgisi ve "Eski ekranda açın" bağlantısı gösterilir (eski rota aynı imajda durur). Böylece staging baştan sona kullanılabilir.
- **Yalıtım:** v2 kodu eski klasörlerden (`components/`, `lib/api.ts`, `store/`, `hooks/`) içe aktarma yapamaz. Bunu ESLint `no-restricted-imports` zorlar. Geçişte eski kod tek hamlede silinir.
- **Geçiş (Faz 7):**
  1. Kurucu onayıyla canlıda bayrak açılır.
  2. Bir sonraki sürümde `(legacy)`, bayrak kodu, FullCalendar, framer-motion ve geist kaldırılır.
  3. `/tenant/*` → `/panel/*` yönlendirmesi kalıcı (308) olur.

### 1.4 Railway/Vercel bağlantısının kesilmesi neyi açtı (G17-K0, yapıldı)
- `master` ya da `staging`'e push artık eski API'yi ya da Vercel'i yeniden dağıtmaz. Push'un tek etkisi GitHub'da yedek ve CI çalışmasıdır (`ci.yml` `master`/`staging` push'unda tetiklenir).
- Böylece şunlar mümkün oldu:
  - (a) Canlı kodu GitHub'a yedeklemek (inceleme A1).
  - (b) `gelistirme`'yi `master`'a birleştirip CI'ı gerçek ana dalda çalıştırmak.
  - (c) G18 temizliği: kök `Dockerfile`, `railway.json`, `nixpacks.toml`, `apps/web/vercel.json` silinir.
- Kalan tek risk: Railway servisleri hâlâ çalışıyor (G17-K2). Telegram token'ı paylaşılıyorsa webhook'u geri alabilir (S4). Bu, arayüz işini etkilemez.
- İlk push'tan önce doğrulama: kurucu paneldeki "Git bağlantısı yok" görüntüsünü verir **ya da** push sonrası GitHub "Deployments" sekmesinde yeni kayıt olmadığı görülür.

---

## 2. Teknik temel kararları (ADR taslakları)

**Kabul edildi (müdür, 2026-10-29).** Bağlayıcı metin `docs/kararlar.md`'dedir: ADR-UI-01…14 = ADR-0022…0035 (aynı sırayla). Uygulama denetimle doğrulanır. Aşağıdaki özet bilgi içindir; çelişkide kararlar.md geçerlidir.

**ADR-UI-01 · Entegrasyon dalı `gelistirme`, yerel birleştirme, push yok.**
- Bağlam: Push kurucuya bağlı. Sunucu yayını push'tan bağımsız (ADR-0019). Paralel üç ajan çalışacak.
- Karar: §1.1.
- Sonuç: CI GitHub'da koşmaz. Eşdeğer kontroller (tip, lint, birim, E2E) birleştirmeden sonra T-hattında koşar (§3.4). Push kararı gelince `gelistirme` → `master`.

**ADR-UI-02 · Bir arada çalışma: iki kök düzen + derleme anı yüzey bayrağı + `proxy.ts` eşlemesi.**
- Karar: §1.3.
- Elenen 1, uzun ömürlü ayrı dal: canlıya giden güvenlik düzeltmeleri ile arayüz dalı sürekli ayrışırdı, staging her derlemede elle birleştirme isterdi.
- Elenen 2, çalışma anı bayrağı (kiracı başına): gerek yok. Gerçek kullanıcı yok, ayrıca ölü kod canlı pakete girerdi.
- Sonuç: geçişe kadar bir route group taşıması (yalnız `git mv`) ve iki CSS girişi var. Bayrak değişimi yeni derleme ister. Bunu derleme betiği zaten yapıyor.

**ADR-UI-03 · Next 16 + React 19 yükseltmesi, Node 22.**
- Bağlam: Next 14 ve 15 destek dışında, canlı web herkese açık. Yeni kodu eski çatıda yazıp sonra taşımak iki kez iş demek.
- Karar:
  - Next 16'nın güncel yamasına çıkılır (görev başında `npm view next version`), React 19.x ile birlikte.
  - Eski sayfalar çalışır kalır. Async `params` ve `proxy.ts` dönüşümü resmî codemod'larla yapılır.
  - Web ve API imajları Node 22 LTS'e geçer (Node 20 Nisan 2026'da destek dışı kaldı).
- Risk: FullCalendar, framer-motion ve Radix'in React 19 uyumu W1'de doğrulanır. Uyumsuzluk çıkarsa ilgili eski ekran W1'de onarılır, iş Faz 2'ye ertelenmez.

**ADR-UI-04 · Tailwind v4 tek sürüm, tokenlar üç katman.**
- Karar:
  - `tailwindcss@3`, `tailwind.config.ts` ve `@tailwindcss/forms` v2'den çıkar (eski CSS'te kalabilir; geçişte silinir).
  - `docs/tasarim/prototip/tokens.css` → `apps/web/src/styles/tokens.css`. Ham (`--ref-*`) ve anlamsal (`--color-*`, `--status-*`, `--person-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--duration-*`) katman adları **birebir** taşınır. Türkçe takma adlar (`--renk-*`) **taşınmaz**.
  - `styles/app.css` içinde `@import "tailwindcss" source(none)`, yalnız v2 klasörleri `@source` ile taranır, eşleme `@theme inline` ile yapılır.
- Koyu tema: kodda `[data-theme="dark"]` bloğu boş kalır. Belgedeki `data-tema="koyu"` kodda İngilizce yazılır. Tema anahtarı v2'de yok.
- Zorlama: v2 klasörlerinde hex, `bg-white`, `text-gray-*`, `dark:` ve 12 px altı yazı yok. Bunu bir lint betiği (`scripts/ui-lint`) denetler.
- Animasyon eklentisi yok; kendi `@keyframes`'imiz kullanılır, `prefers-reduced-motion`'da süre 0.

**ADR-UI-05 · Bileşenler: kendi tasarım sistemimiz, davranış için Radix Primitives.**
- Karar:
  - Odak tuzağı ve klavye davranışı gereken öğeler Radix'ten gelir: Dialog (diyalog ve alt sayfa varyantı), DropdownMenu, Tabs, Popover, Switch, Checkbox, RadioGroup, Toast, VisuallyHidden.
  - Görünüm tamamen bizim: `src/ui/*`, `cva` korunur.
- Elenen: shadcn CLI (kendi token adlarını ve `tailwindcss-animate`'i getirir; tasarım sistemimizle çakışır) ve vaul (bakımı durdu; alt sayfa Radix Dialog ile yapılır, tutamaç görseldir).
- Bileşen adları İngilizce; prototip sınıf adı ile eşlemesi `src/ui/README.md`'de (ör. `.dugme` → `Button`, `.alan` → `Field`, `.katman` → `Sheet`).

**ADR-UI-06 · Yazı tipi depodan, `next/font/local`.**
- Karar:
  - Hanken Grotesk değişken woff2, `latin` + `latin-ext` alt kümesi, ağırlık 400–600.
  - ₺ (U+20BA) için yalnız o glifi içeren küçük bir Inter dosyası (`declarations: unicode-range: U+20BA`).
  - Dosyalar ve `OFL.txt` `apps/web/src/fonts/` altında durur.
- Gerekçe: Derleme Google'a ağ isteği atmaz, çıktı belirlenimcidir ve üçüncü taraf istek yoktur (hukuk-uyum U7). Lisans OFL (ücretsiz).
- Kabul: `İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü ₺` sistem yazı tipine düşmez. Bu, Playwright'ta `document.fonts` ve ekran görüntüsüyle doğrulanır.

**ADR-UI-07 · İkon seti: lucide-react.**
- Prototip lucide çizgi diliyle çizildi (1,6 çizgi, 24'lük kutu).
- Tek `Icon` sarmalayıcısı boyutları 20 ve 24 px ile sınırlar. Dekoratif ikon `aria-hidden` taşır, yalnız ikondan oluşan düğmede `aria-label` zorunludur. Emoji yok.

**ADR-UI-08 · Takvim: kendi CSS Grid bileşenimiz + `@dnd-kit/core`, zaman `date-fns` + `@date-fns/tz`.**
- Karar:
  - Gün ızgarası personel sütunlu ve CSS Grid ile çizilir: saat başına 72 px, 15 dk'lık boş dilim, örtüşen randevular sütun içinde yan yana yerleşir.
  - Sürükle-bırak yalnız masaüstünde, işaretçiyle çalışır: `@dnd-kit/core`, 15 dk'ya yaslama.
  - Dokunmatik ekranda ve klavyede aynı iş "Saati değiştir" ile yapılır (tasarım §4).
  - Tüm gün ve saat hesapları `Europe/Istanbul` ile yapılır.
- Elenen: FullCalendar (ücretli paket gerektiriyor, kurucu T1) ve elle yazılmış işaretçi kodu (erişilebilirlik ve kenar durumlarında bakım yükü).
- FullCalendar geçişe kadar yalnız eski arayüzde kalır.

**ADR-UI-09 · Yetki: tek izin tablosu, sunucu zorlar, ön yüz gösterir.**
- Roller: `owner` (Salon/Klinik sahibi), `manager` (Müdür), `receptionist` (Resepsiyon, yeni), `staff` (arayüzde "Uzman"; veritabanı değeri değişmez, gereksiz migration olmasın). Klinik modunda `doctor` ve `health_staff` eklenir (Faz 6).
- Kiracı başına özel izin seti yok. Unvan (`title`) serbest metindir ve yetki taşımaz. Kurucu kararı R1'deki "seti yalnız sahip verir" ilkesi, rolü yalnız sahibin atamasıyla karşılanır.
- **Tek kaynak:** `packages/shared/src/permissions.ts` (`rol → izin[]`).
  - İzin anahtarı `alan.eylem[.kapsam]` biçimindedir.
  - Her anahtar `roller-ve-akislar.md` §1.4 matris satırına bağlanır ve dosyadaki yorum satır numarasını taşır. Örnekler: `finance.close_day` ↔ 37, `customer.phone.full` ↔ 16, `health.view` ↔ 17.
- **Sunucu:** her rotada `requirePermission(key)` ara katmanı kullanılır. "Kendi kaydı" kapsamı servis sorgusunda uygulanır (`staffId = me`).
- **Ön yüz:**
  - `GET /auth/me` etkin izin listesini döndürür (A1). Web izinleri kendisi hesaplamaz.
  - `useCan(key)`, rota koruması `RequirePermission` ve `navConfig` (tek menü kaynağı) aynı anahtarları kullanır.
  - Rol dışı öğe gizlenir. Adres çubuğundan girilirse "Yetkisiz" ekranı çıkar.
- Test: API'de rol × uç tablo testi (her matris satırı için en az bir izinli ve bir izinsiz rol). Web'de `navConfig` anlık görüntü testi (rol başına menü).

**ADR-UI-10 · Terim setleri.**
- Kiracıda `termSet` (`salon | clinic_client | clinic_patient`) ve `termOverrides` (jsonb, zod ile doğrulanır) tutulur.
- **Terimler:** `packages/shared/src/terms.ts`, yalnız isimler. Her terim beş biçim taşır: yalın, çoğul, belirtme, yönelme ve tamlayan hâli (ör. hasta / hastalar / hastayı / hastaya / hastanın).
- **Cümleler:**
  - `apps/web/src/content/tr.ts` set başına tam cümle tutar. Parça birleştirme yapılmaz (`metin-rehberi.md` §2b).
  - Özel terim girildiğinde cümleler biçim yer tutucusuyla kurulur (`{client.dat}`). Ayarlar ekranı ünlü uyumuna göre ek önerir, sahip düzeltir ve önizler.
- İşletme türü listesi tek kaynaktır (kurucu K3, 6 tür → mevcut enum değerleri) ve `packages/shared/src/business-types.ts`'te durur.

**ADR-UI-11 · API istemcisi (v2).**
- Tek `apiClient` kullanılır. Erişim token'ı **yalnız bellekte** tutulur; sayfa açılışında `/auth/refresh` çağrılır.
- Eşzamanlı 401'ler tek `refreshPromise`'i bekler.
- 401 olunca `?next=` ile giriş sayfasına yönlendirilir ve "Oturumunuzun süresi doldu" bilgisi gösterilir.
- 402 ve 429 `error.code` ile ayrılır; 429'da `retryAfterSec` kullanılır.
- Hata kodları `content/errors.ts` ile Türkçeye çevrilir (`metin-rehberi.md` §6). Sunucu mesajı kullanıcıya gösterilmez.
- React Query'nin genel `onError`'u yalnız beklenmeyen hatada bildirim gösterir.
- Eski istemci (`lib/api.ts`) geçişe kadar dokunulmadan kalır. S6 sunucu tarafını iki istemciyle de uyumlu yazar.

**ADR-UI-12 · Web testleri.**
- **Birim:** Vitest + React Testing Library + jsdom, testler dosyanın yanında (`*.test.tsx`). Kapsamı:
  - izin ve terim yardımcıları,
  - para ve tarih biçimleri, Türk I'sı vakaları dahil,
  - `apiClient` yenileme yarışı,
  - form doğrulamaları,
  - takvim yerleşim algoritması.
- **E2E:** Playwright + `@axe-core/playwright`. Yeri `apps/web/e2e/`, hedefi staging (basic auth `httpCredentials`) ya da yerel yığın.
  - Ekran başına mutlu yol, bir hata yolu ve bir yetki yolu yazılır.
  - axe'ta "serious" ve "critical" düzeyinde ihlal 0 olmalı.
  - Ekran görüntüleri 390, 768 ve 1440 px'te alınır; kurucuya ve denetçiye **artefakttır, doğrulama değildir**.
- Seçiciler tasarımın `data-testid`'leri ile rol/ad sorgularıdır.
- API: mevcut Vitest + gerçek PostgreSQL korunur.

**ADR-UI-13 · SMS'siz online randevu (kurucu kararı 5).**
- **Mod:**
  - API açılışta sağlayıcı durumunu belirler ve log'a tek satır yazar: `phoneVerification = 'sms' | 'none'`.
  - `GET /public/tenants/:slug` `bookingMode` döndürür: `verified` ya da `approval_required`. Web akışı baştan buna göre çizilir, ret son adımda gelmez.
- **`none` iken:**
  - Kod adımı yok.
  - Randevu, T3 ayarı ne olursa olsun `pending` düşer ve `phoneVerified=false` işaretlenir.
  - Bekleyen talep slotu tutar.
- **Kötüye kullanım sınırları:**
  - Turnstile zorunlu. Üretimde gizli anahtar yoksa `/book` 503 döner (kapalı başarısızlık).
  - IP başına saatte 3 talep.
  - Aynı kiracıda, normalize edilmiş aynı telefonla en çok 1 bekleyen talep.
  - Kiracı başına günde en çok 20 bekleyen talep. Aşılınca sayfada "Online randevu şu an alınamıyor, lütfen salonu arayın" yazar.
- **Süre dolumu:**
  - Onaylanmayan talep, talepten 24 saat sonra ya da randevudan 2 saat önce (hangisi önceyse) "süresi doldu" ile iptal olur.
  - Belirlenimci iş kimliği kullanılır: `online-expire-<id>`.
- **Salon tarafı:**
  - Onaylar ya da reddeder (`appointment.approve`: sahip, müdür, resepsiyon).
  - Ret, `rejected` nedeniyle iptal kaydıdır.
  - Panelde "Telefon doğrulanmadı" işareti görünür.
  - Müşteriye otomatik bildirim gitmez. Ekrandaki metni teknik-yazar yazar ve dürüst olmalı (ör. "Talebiniz salona iletildi. Salon onayladığında kesinleşir.").
- **`sms` olunca:** doğrulama kendiliğinden devreye girer ve T3 ayarı uygulanır. Salonda otomatik onay ancak doğrulanmış telefonla mümkündür. Tavanlar her iki modda da geçerli kalır.
- Kod sağlamlaştırması (sağlayıcı açıldığında kullanılacak yol): `crypto.randomInt`, kodun hash'i, atomik deneme sayacı, `/verify/*` için telefon + IP sınırı (denetim #11).

**ADR-UI-14 · Sürüm etiketleri `.env` dışında (kurucu kararı 3, ayrıntı devops'ta).**
- `BEAUTYOS_VERSION` ve `BEAUTYOS_STAGING_VERSION`, gizli olmayan `/srv/beautyos/surum.conf` dosyasına taşınır. Compose bu dosyayı ek env dosyası olarak okur. Yöntem ve Compose sürüm uyumu D1'de doğrulanır.
- Çakışmada `surum.conf` kazanır. `.env`'deki eski satırları kurucu uygun olduğunda tek seferde siler.

---

## 3. Fazlar ve görevler

### 3.1 Ortak kabul ölçütleri (her görevde geçerli, tabloda tekrar edilmez)
- **API-DoD:**
  - Test önce yazılır (`kod-standartlari`). Her yeni ya da değişen uç için mutlu yol + hata yolu + **rol** testi + **kiracı izolasyonu** testi.
  - Eski arayüz kırılmaz (geriye uyum). Kırılacaksa eski arayüz düzeltmesi aynı görevde yapılır ve E2E dumanı geçer.
  - Log'da kişisel veri yok.
- **UI-DoD:**
  - 390, 768 ve 1440 px'te prototiple görsel eşdeğerlik.
  - Beş durum (yükleniyor, boş, hata, başarı, yetkisiz) çizili.
  - `data-testid`'ler `tasarim.md` ile aynı. Metinler `metin-rehberi.md`'den ve terim setinden geliyor.
  - axe'ta ciddi ihlal 0. Klavyeyle tamamlanabilir; odak görünür.
  - `ui-lint` temiz (hex, gri, `dark:` yok). v2 kodu eski klasörlerden içe aktarma yapmıyor.
  - Mantık birim testleri var. Rol görünürlüğü `useCan` üzerinden.
  - Eski arayüzdeki işlevlerden hiçbiri kaybolmaz: görev, `roller-ve-akislar.md` §2 işlev numaralarını listeler ve test-muhendisi kabulde tek tek işaretler.
- **Etiketler:** `[API: X]` ekranın X görevine bağlı olduğunu gösterir. API hazır değilse ekran sahte veriyle değil, mevcut uçla çalışır; eksik kısım "Yakında" etiketiyle çizilir.

### 3.2 Faz 0 — Hazırlık (1–2 gün, hepsi paralel)

| No | Görev | Sahibi | Bağımlı | Dosyalar | Kabul |
|---|---|---|---|---|---|
| D1 | Sürüm etiketlerini `surum.conf`'a taşı (ADR-UI-14) | devops | — | sunucuda `/srv/beautyos/surum.conf`; `deploy/compose.yml` (yalnız yorum ve env dosyası düzeni), `deploy/README.md`, `docker-yayinlama` notu | K1: staging yayını `.env`'e dokunmadan yapılır, kurucu adımı yoktur. K2: `docker compose config` iki etiketi doğru çözer; değişken boşsa yine hata verir (G11-K8 korunur). K3: geri alma = dosyada önceki etiket. K4: Compose sürümünün çoklu env dosyasını desteklediği kanıtlanır |
| D2 | Yüzey bayrağını derlemeye ekle | devops | — | `deploy/betikler/derle.sh`, `deploy/derleme.conf` | K1: `NEXT_PUBLIC_UI_V2_PROD` ve `NEXT_PUBLIC_UI_V2_STAGING` ilgili web imajına `NEXT_PUBLIC_UI_V2` olarak geçer. K2: tanımsız değer boş sayılır, yani v2 kapalı (kapalı başarısızlık). K3: değer yalnız `[a-z,]` karakterlerinden oluşur, aksi halde derleme durur. K4: `bash -n` ve `shellcheck` temiz |
| D3 | Staging'i arama motorlarına kapat | devops | — | `deploy/caddy/beautyos.caddy` | `yeni.` ve `yeni-api.` yanıtlarında `X-Robots-Tag: noindex, nofollow` başlığı var |
| S0 | Paylaşılan paket iskeleti + bayrak argümanı | gelistirici | — | `packages/shared/**` (yeni), kök `package.json` (workspaces), `package-lock.json`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, iki `tsconfig.json` | K1: `@beautyos/shared` iki uygulamadan da içe aktarılır, iki imaj da derlenir. K2: web Dockerfile `ARG NEXT_PUBLIC_UI_V2` alır. K3: paketin dışa açık API'si tam liste olarak yazılı ve `Object.keys` testiyle kilitli |
| T1 | Test ortamı kararı + E2E iskeleti | test-muhendisi | — | `apps/web/e2e/**`, `apps/web/playwright.config.ts` | K1: API Vitest'in, web Vitest'in ve Playwright'ın **nerede** koşacağı yazılır ve bir kez uçtan uca çalıştırılır (bu makinede node yok). Sunucuda çalışacaksa bellek etkisi ölçülür. K2: eski arayüzde duman testi yeşil: giriş, panel açılışı, randevu oluşturma, `/book` sayfası açılışı. K3: axe yardımcısı ve 390/768/1440 ekran görüntüsü betiği var |
| T2 | API test tabanını yeşile çek | test-muhendisi | — | `apps/api/src/__tests__/helpers/**` ve mevcut test dosyaları (yeni test dosyaları değil) | 21 kırmızı test sınıflandırılır: eskimiş test düzeltilir; gerçek hata gelistirici'ye `[BULGU]` olarak gider (atlama ya da silme yok). `admin.test.ts` ön ek temizliği yapılır, `cleanupTenant` hata yutmaz |
| T3 | Staging demo verisi | test-muhendisi | T1 | `apps/web/e2e/seed/**` | "Defne Güzellik Salonu" verisi **API üzerinden** kurulur: 4 rol, hizmetler, personel, müşteriler ve 2 haftalık randevu (prototip `veri.js` ile tutarlı). Tekrar çalıştırılabilir. E2E fikstürü olarak da kullanılır |
| W1 | Next 16 + React 19 yükseltmesi + v2 bağımlılıkları (tek kilit değişikliği) | frontend-gelistirici | S0 (kilit sırası) | `apps/web/package.json`, `package-lock.json`, `apps/web/next.config.mjs`, codemod'un dokunduğu eski dosyalar | K1: eski arayüz T1 dumanından geçer. K2: `tsc`, lint ve derleme temiz. K3: v2 için gereken her paket bu görevde eklenir: Radix ilkelleri, `@dnd-kit/core`, `date-fns` + `@date-fns/tz`, Vitest, RTL, jsdom, Playwright, axe. Paket listesi test-muhendisi ile mesajlaşarak kesinleşir. K4: `tailwindcss@3` ve `tailwind.config.ts` silinir; eski CSS v4 ile aynı görünür (T1 ekran görüntüleriyle karşılaştırılır) |

### 3.3 Faz 1 — Güvenlik ∥ tasarım sistemi ve kabuk ∥ test altyapısı (5–8 gün)

**gelistirici (API).** Sıra yukarıdan aşağıya. Her biri TEST GEÇTİ alınca canlıya çıkabilir.

| No | Görev | Bağımlı | Dosyalar (başlıca) | Kabul |
|---|---|---|---|---|
| S1 | `requirePermission` + izin tablosu; AÇIK 1–3'ün kapatılması | S0 | `packages/shared/src/permissions.ts`, `apps/api/src/middleware/permission.ts` (yeni), finans, rapor, cari, fatura, tedarikçi, müşteri ve anamnez rotaları | K1: `close-day`, `reports/daily`, `reports/staff-commissions` ve `revenues` uçlarında `staff` → 403 (denetim #2). K2: dashboard ciro alanı izinsiz role dönmez. K3: `staff` finans, cari ve fatura okuyamaz; tedarikçi listesini göremez. K4: `staff` yalnız kendi müşterilerini listeler, anamnez ve fotoğrafa yalnız kendi müşterisinde erişir. K5: matris satırlarının hepsi için rol × uç tablo testi |
| S2 | SMS'siz online randevu (ADR-UI-13) + onay ve ret uçları | S1 | `public.route.ts`, `lib/phone-verification.ts`, `lib/turnstile.ts`, `lib/queue.ts`, randevu rotaları, yeni migration (`phoneVerified`, iptal nedeni), **eski** `app/(legacy)/book/[slug]/page.tsx` | K1: `none` modunda kodsuz talep `pending` düşer. K2: her tavan ayrı negatif testle sınanır. K3: süre dolumu işi belirlenimci kimlikle çalışır ve iki kez kurulmaz. K4: Turnstile yoksa üretimde 503 döner; Turnstile'da zaman aşımı 5 sn. K5: `sms` modunda doğrulama ve T3 devrede (sahte sağlayıcıyla). K6: eski `/book` sayfası `bookingMode`'a göre kod adımını atlar ve dürüst metni gösterir (W0'dan sonra). K7: OTP sağlamlaştırması (denetim #11) |
| S3 | Çift randevuya veritabanı kısıtı | S2 | yeni migration (`btree_gist`, `EXCLUDE … WHERE status NOT IN ('cancelled','no_show') AND NOT is_deleted`), randevu yazan dört yol | K1: eşzamanlı iki istekten biri 409 `SLOT_TAKEN` alır (gerçek PG testi). K2: 23P01 her yolda aynı koda çevrilir. K3: migration'ın geri alma adımı yazılı. K4: mevcut veride çakışma taraması önce yapılır |
| S4 | Log ve kişisel veri + G5 | — (S1 ile paralel olabilir, dosyalar ayrı) | `lib/logger.ts`, `lib/sms/mock-provider.ts`, `channels/*`, `bot/flow.handler.ts`, `lib/queue.ts`, `lib/email.ts`, `lib/env.ts`, `index.ts` | K1: `redact` kuralları; axios hatası yalnız `{status, code, message}` olarak log'lanır (denetim #5, #22). K2: e-posta hatası yutulmaz, adres olmadan `error` düzeyinde yazılır. K3: G5-K1…K5 |
| S5 | Bot sahte onay ve test kalıntıları | S4 | `bot/booking.service.ts`, `bot/flow.handler.ts`, `lib/salon.context.ts`, `lib/tenant.registry.ts` | K1: `mockSlots`, `TEST_SALON` ve sahte `RDV-` yok. K2: hizmet bulunamazsa netleştirme sorusu sorulur. K3: WhatsApp'ta eşleşme yoksa mesaj düşer, "ilk kiracı"ya gitmez (denetim #9). K4: iptal sahiplik ister (denetim #10) |
| S6 | Durumlu oturum | S1 | yeni `sessions` tablosu, `auth.route.ts`, `auth.middleware.ts` | K1: yenileme token'ı hash'li saklanır, her kullanımda döner, yeniden kullanılırsa aile iptal edilir. K2: çıkış, şifre değişimi, sıfırlama ve pasifleştirme tüm oturumları kapatır. K3: `isActive` her istekte kontrol edilir. K4: `SameSite=Lax`, çerez yolu `/api/v1/auth`. K5: süper yönetici erişimi 15 dk. K6: eski ve v2 istemcisi ikisi de çalışır |
| S7 | Kimlik sızıntıları | S6 | `auth.route.ts`, `admin.route.ts`, personel ekleme | K1: geçerli sahte hash kullanılır, kayıtlı/kayıtsız e-posta yanıt süresi ölçülür (denetim #7). K2: e-posta küçük harfle saklanır ve personel eklerken küresel kontrol edilir (#8). K3: `/admin/seed` kaldırılır, yerine CLI betiği. K4: güçlü şifre kuralı her yerde (#14). Kayıtta tek tip yanıt e-posta doğrulamasına bağlıdır, A10'a bırakılır |
| S8 | Tek `createApp` + tek CORS (G4b genişletilmiş) | S4 | `index.ts`, `app.ts`, `lib/cors.ts` | G4b-K1…K4. Testler canlıdaki uygulama kurulumunu sınar. `GET /` `env` döndürmez, 404 JSON döner, Sentry işleyicisi doğru yerde (#16, #18) |
| S9 | Node 22 (API + web imajı) | W1 | iki Dockerfile, `ci.yml` | İki imaj derlenir, API test takımı Node 22'de yeşil |

**frontend-gelistirici (web, v2).** Sıra yukarıdan aşağıya.

| No | Görev | Bağımlı | Dosyalar | Kabul |
|---|---|---|---|---|
| W0 | İki kök düzen + bayrak + `proxy.ts` (ADR-UI-02) | W1, D2 | `app/(legacy)/**` (yalnız `git mv`), `app/(v2)/layout.tsx`, `src/proxy.ts`, `src/lib/v2/flags.ts`, `src/lib/v2/routes.ts`, ESLint yalıtım kuralı | K1: bayrak kapalıyken eski arayüz bayt bayt aynı yollarla çalışır (T1 dumanı). K2: bayrak açıkken §1.3 eşlemesi çalışır, her eşleme için test var. K3: `git mv` dışında eski dosyada değişiklik yok |
| W2 | Tokenlar, yazı tipi, temel CSS (ADR-UI-04, 06) | W0 | `src/styles/**`, `src/fonts/**`, `scripts/ui-lint` | K1: `tokens.css` tasarım belgesiyle birebir; kontrast tablosu (§3.1) birim testinde hesaplanır. K2: Türkçe karakterler ve ₺ doğru yazı tipinden gelir. K3: `:focus-visible` ve `prefers-reduced-motion` genel kuralları var |
| W3 | Bileşenler A: form ve geri bildirim | W2 | `src/ui/**` | `Button`, `Field` (Input, Select, Textarea, telefon +90), `Checkbox`/`Radio`/`Switch` (seçenek), `SegmentedControl`, `SelectionCard`, `Chip`, `StatusBadge` (6 durum + "Yakında"), `Avatar` (kişi tonu), `Banner` (şerit), `EmptyState`/`ErrorState`/`Forbidden`, `Skeleton`, `Toast` (geri al dahil). Her biri tasarım §4 kuralını testle taşır (ör. birincil düğme işlem sürerken `aria-busy` ve tekrar basılamaz) |
| W4 | Bileşenler B: katman ve veri | W3 | `src/ui/**` | `Sheet`/`Dialog` (telefonda alt sayfa, 768 px üstünde diyalog, odak iadesi), `ConfirmDialog` (eylem adlı), `DropdownMenu`, `Tabs`, `Card`, `ListRow`, `DataTable` (640 px altında satıra döner), `SummaryStrip`, `DayStrip`, `TimeSlots`, `Money`, `DateTime`. Bayrak açıkken `/v2/tasarim-sistemi` vitrin sayfası (yalnız staging) |
| W5 | `apiClient`, oturum, izin, terim (ADR-UI-09, 10, 11) | W3; [API: A1] | `src/lib/v2/**`, `src/content/**` | K1: eşzamanlı 5 adet 401 → tek yenileme (birim testi). K2: token `localStorage`'a yazılmaz. K3: `useCan` ve `useTerm` A1 yanıtından okur; A1 bitene kadar rolden türeten geçici bağdaştırıcı var, A1 gelince silinir. K4: hata kodu → metin eşlemesi `metin-rehberi.md` §6'nın tamamını kapsar |
| W6 | Uygulama kabuğu + sistem ekranları | W4, W5 | `src/features/shell/**`, `app/(v2)/panel/[slug]/layout.tsx`, `app/(v2)/**/error.tsx`, `not-found.tsx` | K1: üst bar, alt menü (rol başına 5 öğe; uzmanda Günüm dizilimi), masaüstü yan menü, Yönetim grubu (açık/kapalı durumu hatırlanır), Menü ekranı. K2: `navConfig` tek kaynak; rol başına menü anlık görüntü testi. K3: kapalı modül menüde görünmez. K4: başka salonun slug'ı → kendi paneline yönlendirme. K5: 404, genel hata, oturum doldu, hesap aktif değil, çevrimdışı şeridi markalı. K6: hazır olmayan ekranlar "Eski ekranda açın" bilgisini gösterir |

**gelistirici, arayüz için API (Faz 1 sonu – Faz 2):**

| No | Görev | Bağımlı | Kabul |
|---|---|---|---|
| A1 | `GET /auth/me` genişletmesi | S1 | Yanıt: `role`, `permissions[]`, `tenant {slug, name, businessType, termSet, terms, activeModules, bookingMode, timezone}`, `staffId`. Kullanıcı başka kiracıya ait bilgi göremez |
| A2 | Rol modeli R1–R9 | S1 | `receptionist` rolü. `POST /staff` rol alır (yalnız sahip). Resepsiyona taşıma, bekleme listesi silme, bahşiş kaydı, gün sonu. Müdüre gider, hizmet atama, izin. Uzman (R3): `priceCharged` yok sayılır. R4: maskeli telefon, arama en az 3 karakter ve en çok 10 sonuç, liste yok. R9: resepsiyon sağlık verisini göremez. Matris testleri S1 tablosuna eklenir |
| A3 | Davet akışı (R8) | A2, S6 | `invitations` tablosu, tek kullanımlık süreli token (hash'li). Bağlantı kopyalanabilir, e-posta gönderimi isteğe bağlı. Kabulde kişi kendi şifresini belirler. Hesap varlığı sızmaz |
| A4 | Takvim ve randevu sözleşmesi | S3 | `dateFrom`/`dateTo` aralığı, aralıkta sınırsız (en çok 31 gün). Liste öğesine `customerId`, `serviceId`, `durationMinutes` eklenir. Slot kimliği `Z`'li ISO olur (eski `slot-select` aynı görevde uyarlanır). `lib/time.ts` İstanbul gün sınırlarını hesaplar. Hata sözleşmesi B14: alan hataları, istek numarası, her 429'da `retryAfterSec` |
| A5 | Terim setleri + işletme türleri | A1 | `termSet` ve `termOverrides` migration'ı, zod doğrulaması, ayar ucu (yalnız sahip). Kayıt ve ayarlar aynı tür listesini kullanır (`aesthetic` hatası giderilir) |
| A6 | Tamamla/ödeme tek işlemde + düzeltme kaydı (R5) + günü yeniden aç | S1 | Koşullu güncelleme (`count === 1`), `Decimal` hesap (M4). `corrections` tablosu (kim, ne zaman, eski → yeni, gerekçe). Sahip ve müdür yapabilir. Kapatılmış gün yeniden açılabilir ve kayıt tutulur |

**test-muhendisi (Faz 1):** T1–T3'ü bitirir. Ardından her ONAY'lı birleştirmeden sonra staging'de "yeşil kapı" koşar: tip + lint + API testleri + web birim + E2E dumanı, sonuç `raporlar/test/`'e yazılır. S1–S8 için kabul testi yapar ve güvenlik düzeltmeleri için canlı TEST GEÇTİ kararını verir.

### 3.4 Faz 2 — Panel çekirdeği (8–14 gün)
Sahibi: frontend-gelistirici. Ekranlar `src/features/<alan>/**` ve `app/(v2)/panel/[slug]/<rota>/**` altında.

| No | Ekran | Bağımlı |
|---|---|---|
| W10 | Bugün (sahip, müdür, resepsiyon): Personelin günü doluluk şeridi, "Şu an boş", özet şeridi, bugünkü kasa, bekleyen online onay şeridi + Onayla/Reddet, ilk kurulum listesi | W6 · [API: A1, A4, S2] |
| W11 | Günüm (uzman): Sıradaki kartı, günün sırası, izinlerim | W6 · [API: A2] |
| W12 | Takvim görünümleri: telefonda saat çizelgesi, masaüstünde personel sütunlu gün ızgarası, hafta özeti, ay | W6 · [API: A4] |
| W13 | Randevu oluştur katmanı: müşteri ara/ekle, hizmet, personel, 14 günlük şerit, boş saatler, 409'da saatlerin yenilenmesi | W12 · [API: A4, S3] |
| W14 | Randevu ayrıntısı + durum eylemleri + Saati değiştir / İptal / Gelmedi / Sil | W13 · [API: A2] |
| W15 | Sürükle-bırak (masaüstü) + Geri al | W12, W14 |
| W16 | Tamamla ve ödeme al + randevusuz işlem. Paketten düşme ve "Karma" ödeme "Yakında" (B12) | W14 · [API: A6, A2-R3] |
| W17 | Müşteriler: liste (sonsuz kaydırma), yeni, düzenle; uzmanda arama kipi | W6 · [API: A2-R4] |
| W18 | Müşteri kartı sekmeleri: Genel, Randevular, Sağlık bilgileri (mevcut anamnez, rol sınırıyla; rıza kapısı L2'de), Fotoğraflar (URL yerine yükleme V3'e kadar "Yakında"), Paketler, Cari | W17 · [API: A2] |
| W19 | Kasa + gün sonu + kasa sayımı (beklenen nakit ve fark) + Günü yeniden aç | W6 · [API: A6, A2-R2/R6] |

**gelistirici (Faz 2):** A2–A6'yı bitirir. W-ekranlarından gelen sözleşme sorularını yanıtlar. G1 (CI'da Postgres) push kararına kadar bekler.

### 3.5 Faz 3 — Panelin geri kalanı (7–12 gün)

| No | Ekran | Bağımlı |
|---|---|---|
| W20 | Hizmetler (kategori kartları, form) | W6 |
| W21 | Personel liste + ayrıntı (profil, hizmetleri, çalışma saatleri, izinler, ödemeler) + davet | W6 · [API: A2, A3] |
| W22 | Bekleme listesi | W6 · [API: A2] |
| W23 | Raporlar (kasa, prim; yazdırma) + Primim | W6 · [API: S1] |
| W24 | Yönetim 1: Hesaplar + virman, Cari hesap, Tedarikçiler | W6 |
| W25 | Yönetim 2: Alış faturaları (+ yeni, faturayı işle), Stok (ürün, hareket, reçete, kritik uyarı) | W6 |
| W26 | Yönetim 3: Paketler, Personel ödemeleri, Bahşiş | W6 |
| W27 | Ayarlar: tüm bölümler + Online randevu onay ayarı (T3) + Terimler + Modüller (yalnız sahip) | W6 · [API: A5, S2] |
| W28 | Hesabım + Mesaj asistanı (bayrak `NEXT_PUBLIC_BOT_FEATURES_ENABLED`) | W6 |

### 3.6 Faz 4 — Giriş/kurulum, online randevu, süper yönetici + hatırlatma (6–10 gün)

| No | İş | Sahibi | Bağımlı |
|---|---|---|---|
| L1 | Sözleşme ve aydınlatma kabul kaydı (sürüm + zaman), yeniden kabul ucu | gelistirici | S7 |
| A7 | Online randevu: fiyat (klinikte gizli), değiştir/iptal için süreli imzalı bağlantı (2 saat kuralı, M1), `.ics` | gelistirici | S2, A4 |
| A8 | Hatırlatma işinin düzeltilmesi: başarısızlıkta yeniden deneme, `isDeleted` kontrolü, İstanbul sınırları, koşullu no-show. E-posta yedeği (M2) Resend çalışıyorsa | gelistirici | S4, A4 |
| W30 | Giriş, kayıt (2 adım, 6 tür, K1/K3), şifremi unuttum, sıfırla, davet kabul | frontend-gelistirici | W5 · [API: L1, A3, A5] |
| W31 | Kurulum sihirbazı (çalışma saatleri dahil) | frontend-gelistirici | W30 |
| W32 | Online randevu sayfası v2 (`bookingMode`'a göre iki akış, tüm durumlar, salon rengi) | frontend-gelistirici | W4 · [API: S2, A7] |
| W33 | Süper yönetici (genel bakış, salonlar, ayrıntı, yasal belge sürümü) | frontend-gelistirici | W4 · [API: L1; not/elle tahsilat alanı için küçük uç gelistirici'de] |

### 3.7 Faz 5 — Tanıtım sitesi + yasal (6–10 gün; tanıtım sitesi Faz 2'den itibaren paralel yürüyebilir)
- **W40–W43, tanıtım sitesi (Persuade):**
  - W40: kabuk, cam menü ve ana sayfa.
  - W41: hareket katmanı (A1).
  - W42: görsel derinlik (A2) + alt sayfalar ve sektör sayfaları.
  - W43: yasal sayfa şablonu, SEO (`robots`, `sitemap`, OG, canonical; panel, book ve admin için `noindex`).
  - Kural: sunucu bileşeni öncelikli; hareket küçük istemci adacıklarında; yalnız CSS ve kütüphanesiz (prototipteki gibi).
  - Dosyalar: `src/features/site/**`, `app/(v2)/(site)/**`, `src/styles/site.css`. Panel dosyalarıyla kesişmez.
  - **Öneri:** müdür hız için ikinci bir frontend üyesi kurarsa bu blok ona verilir. Kesişen tek dosya `proxy.ts`'tir ve W0'dan sonra değişmez.
- **L2–L4, yasal API (gelistirici):**
  - L2: sağlık rıza kapısı + erişim kaydı, müşteri silme ve veri talebi, rıza kayıtları.
  - L3: ticari ileti izni alanları (kanal + kaynak).
  - L4: saklama ve temizlik işleri (`phone_verification`, `message_delivery`, bot oturum ve konuşmaları; süreler hukuk-uyum'dan).
  - Ekran karşılıkları W18, W27 ve W17'ye küçük eklerdir. W-sahibi aynıdır.
- **Faz sonu (kalıcı izin 6):**
  - Kontrol: beş yüzey staging'de tamam, işlev envanteri %100 işaretli ve TEST GEÇTİ alınmış.
  - Bunun üzerine müdür kurucuya Telegram'dan "test sitesi tamamlandı" bildirimini gönderir.

### 3.8 Faz 6 — Klinik modu (10–15 gün) · Faz 7 — Canlıya geçiş (2–3 gün)
- **Faz 6:**
  - API: `doctor` ve `health_staff` rolleri, iki adımlı doğrulama ve oturum kilidi, onamlar, klinik notu + düzeltme geçmişi, erişim geçmişi, "Hasta kaydını kapat", klinik kurulum adımları (sağlık kuruluşu bilgileri, HBYS ekranı), dosya yükleme altyapısı (V3, klinik görüntüleri için ön koşul).
  - Ekranlar `tasarim.md` §7.2'ye göre yapılır.
  - Ayrıntılı görev listesini mimar Faz 5 başlarken yazar. Depolama yeri ve yurt dışı aktarım kararı hukuk-uyum'la birlikte verilir.
- **Faz 7:**
  1. Kurucu onayıyla canlıda bayrak yüzey yüzey açılır. Önerilen sıra: site → auth → book → panel → admin.
  2. Bir sonraki sürümde eski kod silinir (§1.3).

### 3.9 Dosya sahipliği (aynı anda tek sahip)

| Yol | Sahibi | Not |
|---|---|---|
| `apps/api/src/**` (testler dahil, `__tests__/helpers/**` hariç), `apps/api/prisma/**` | gelistirici | |
| `apps/api/src/__tests__/helpers/**` + T2 sırasında mevcut test dosyaları | test-muhendisi | T2 bitince mevcut testler gelistirici'ye geri döner |
| `packages/shared/permissions.ts`, `business-types.ts`, paket kökü | gelistirici | |
| `packages/shared/terms.ts` | frontend-gelistirici | Metinleri teknik-yazar onaylar |
| `apps/web/src/(v2 klasörleri)`: `ui`, `styles`, `fonts`, `features`, `content`, `lib/v2`, `app/(v2)`, `proxy.ts` | frontend-gelistirici | |
| `app/(legacy)/book/[slug]/page.tsx`, `components/appointments/slot-select.tsx` | gelistirici | Yalnız S2-K6 ve A4 için, W0'dan sonra |
| `app/(legacy)/**` (diğerleri) | frontend-gelistirici | Yalnız W0/W1 |
| `apps/web/package.json`, kök `package.json`, `package-lock.json` | sırayla: S0 → W1, sonra müdür sıraya koyar | |
| `apps/web/e2e/**`, `playwright.config.ts`, `vitest.config.ts`, web test kurulum dosyası | test-muhendisi | |
| `apps/*/Dockerfile` | S0'da gelistirici; S9'da gelistirici | |
| `deploy/**` | devops (Faz 0) | Sonra gelistirici'ye döner |
| `.github/workflows/**` | gelistirici | Push kararına kadar donuk |
| `docs/**`, proje `CLAUDE.md`, kök `.env.example` | mimar | Dal `tasima/sunucu` |

---

## 4. Kurucudan gerekenler (yalnız kalıcı izin dışındakiler)

1. **Push (yedek):** `gelistirme`, `tasima/docker` ve `tasima/sunucu` GitHub özel depoya push edilsin mi? `gelistirme` uygun bir anda `master`'a birleştirilsin mi?
   - Öneri: hemen evet. Canlı kodun tek kopyası bu bilgisayarda. Push artık hiçbir şeyi dağıtmaz (§1.4).
   - Plan bu karara bağlı değildir.
2. **Yeni arayüzün canlıya alınması:** Faz 5 sonunda (ya da yüzey yüzey) canlıda bayrağın açılması. Gerekli girdi: staging'de gezinti ve geri bildirim.
3. **İçerik** (site, kayıt ve süper yönetici yüzeyleri canlıya çıkmadan önce şart, staging'i engellemez):
   - fiyat ve paketler,
   - künye (unvan, VKN, adres, MERSİS/KEP),
   - destek e-postası,
   - logo: prototipteki geçici işaret kullanılabilir mi, yoksa yeni logo mu,
   - yasal metin gövdeleri (avukat).
4. **DNS (gerekirse):** davet ve şifre e-postaları için Resend alan adı doğrulama kayıtları (SPF/DKIM). E-posta çalışmazsa davet bağlantısı kopyalanarak iletilir, iş durmaz.
5. **Para (bilgi):** bu planın para isteyen kalemi yok (yazı tipi OFL, kütüphaneler MIT/Apache). SMS'in açılması (NetGSM) ayrı karardır ve planı engellemez.

---

## 5. Süre ve riskler

### 5.1 Kaba süre (üç hat paralel, ajan iş günü; takvim süresi denetim döngüsü dahil)

| Faz | Süre |
|---|---|
| 0 Hazırlık | 1–2 gün |
| 1 Güvenlik ∥ tasarım sistemi + kabuk ∥ test | 5–8 gün |
| 2 Panel çekirdeği | 8–14 gün |
| 3 Panelin geri kalanı | 7–12 gün |
| 4 Giriş, kurulum, online randevu, yönetici, hatırlatma | 6–10 gün |
| 5 Tanıtım sitesi + yasal | 6–10 gün (ikinci frontend üyesiyle Faz 2–3'e gömülür) |
| **Staging'de "test sitesi tamamlandı" (salon modu, beş yüzey)** | **~5–8 hafta** (ikinci frontend üyesiyle ~4–6 hafta) |
| 6 Klinik modu | +2–3 hafta |
| 7 Canlıya geçiş | 2–3 gün |

### 5.2 Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Bu makinede node/docker yok; test ve derlemenin yeri belirsiz | Denetim döngüsü yavaşlar | T1 ilk gün; çalıştırma yeri yazılı ve bir kez kanıtlanmış olmalı |
| Sunucuda sık derleme canlı Postgres ile belleği paylaşıyor (4 GB) | Canlı yavaşlar | Günde en çok 2 staging derlemesi, yoğun olmayan saat, D14 sınırlı builder |
| Next 16 / React 19 eski ekranları kırar | Canlı web bozulur | W1 ayrı görev, T1 dumanı kabul ölçütü, canlıya yalnız TEST GEÇTİ ile |
| API değişikliği eski arayüzü kırar (canlı eski arayüzde) | Canlıda hata | API-DoD geriye uyum kuralı. Yeni roller canlıdaki eski menüde yanlış görünebilir; gerçek kullanıcı yok ve yeni roller yalnız yeni arayüzden atanır. Bu, kabul edilmiş risktir |
| SMS'siz online randevuya sahte talep | Takvim dolar, salon yorulur | ADR-UI-13 tavanları, Turnstile, süre dolumu, "Telefon doğrulanmadı" işareti |
| Paralel dallarda çakışma | Yeniden inceleme döngüsü | §3.9 sahiplik, kilit dosyası sırası, küçük görevler, `--no-ff` + rebase kuralı |
| "İşlevler aynı kalır" kuralında kayıp | Kurucu kararı #3 ihlali | Her UI görevi §2 işlev numaralarını listeler; Faz 7 öncesi %100 kontrol listesi |
| Takvim karmaşıklığı (örtüşme yerleşimi, sürükle-bırak, saat dilimi) | Faz 2 uzar | Yerleşim algoritması saf fonksiyon olarak birim testli; W12/W13/W15 ayrı görevler |
| Tasarım belgesi 0.9; "Terimler" ve "Güvenlik" ekranları planlandı ama çizilmedi | Belirsizlik | ui-ux-tasarimci soru için açık kalır; W27 ve Faz 6 başında çizim istenir |
| Push yapılmazsa tek kopya | Kod kaybı | §4 madde 1 |
| Kimlik modeli (küresel kullanıcı + üyelik), RLS (T-B1), bileşik FK bu planda yok | İlk gerçek müşteriden önce açık | Ayrı "veri bütünlüğü" planı; Faz 3'ten sonra gelistirici hattına eklenir |
