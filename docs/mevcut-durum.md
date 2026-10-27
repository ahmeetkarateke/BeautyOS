# BeautyOS — Mevcut Durum (taşıma öncesi inceleme)

- **Tarih:** 2026-10-27 · **Hazırlayan:** mimar · **Dal:** `tasima/sunucu` (inceleme `master` @ `bbd71c6` üzerinde yapıldı)
- **Kapsam:** Yalnız depo incelemesi. Canlı panellere (Supabase, Railway, Vercel, Upstash), veritabanına ve `.env*` dosyalarına bakılmadı. Panel ya da veritabanı gerektiren her bilgi **VARSAYIM** olarak işaretlendi ve doğrulaması `docs/tasima-plani.md` ile `docs/gorevler.md` içinde bir adıma bağlandı.

## 1. Bileşenler

| Bileşen | Teknoloji | Şu an nerede | Not |
|---|---|---|---|
| `apps/api` | Node 20, Express 4, TypeScript, Prisma 5.22, pino, zod, bcryptjs, jsonwebtoken, express-rate-limit | Railway (kökteki `Dockerfile` ile, `railway.json`) | Giriş noktası `src/index.ts` → `dist/index.js`, port 3001 |
| Kuyruk işçisi | BullMQ 5.75 + ioredis | **API sürecinin içinde** (`startReminderWorker()`, `src/lib/queue.ts`) | Ayrı bir worker servisi yok |
| `apps/web` | Next.js 14.2.35 (App Router), React 18, Tailwind, React Query, Zustand | Vercel (`apps/web/vercel.json`) | Tamamen istemci tarafı API çağrısı yapıyor; Vercel'e özgü özellik yok (aşağıda) |
| Veritabanı | PostgreSQL (Supabase, README'ye göre AB bölgesi) | Supabase prod + ayrı staging projesi | 37 model, 19 migration, Prisma `directUrl` kullanıyor |
| Redis | Upstash (TLS, `rediss://`) | Upstash | Yalnız BullMQ kuyruğu (`reminders`) |
| Bot | Telegram (+ WhatsApp/360dialog kodu, büyük olasılıkla kapalı) + Gemini 2.5 Flash | API içinde | Webhook adresi API açılırken `PUBLIC_URL` ile Telegram'a kaydediliyor |
| CI | GitHub Actions `ci.yml` (type-check, lint, vitest) | GitHub | `master`/`staging` push ve PR'da çalışır; dağıtım yapmaz |
| Dağıtım | Vercel ve Railway'in GitHub entegrasyonu | — | **`master` push = prod, `staging` push = staging canlıya alma** (README) |

Monorepo: kökte npm workspaces (`apps/*`), tek `package-lock.json`.

## 2. Dış servisler

| Servis | Kullanım | Taşımada etkisi |
|---|---|---|
| Supabase | Yalnız PostgreSQL (aşağıdaki kanıta göre) | Veri `pg_dump` ile taşınır; sonra kapatılır |
| Railway | API barındırma (prod + staging) | Kapatılır. **Otomatik dağıtım kapatılmazsa** `master` push'u eski API'yi yeniden ayağa kaldırır (Risk R1) |
| Vercel | Web barındırma (prod + preview/staging) | Kapatılır; alan adları Cloudflare DNS'te Vercel'i gösteriyor (VARSAYIM) |
| Upstash | Redis (BullMQ) | Veri taşınmaz (ADR-0005); kapatılır |
| Cloudflare | DNS (kurucu bilgisi), Turnstile CAPTCHA (`TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) | DNS kaydı geçiş günü değişir; Turnstile widget host listesi kontrol edilir |
| Telegram Bot API | Bot mesajları, webhook `/webhook/telegram` | Webhook adresi yeni API'ye taşınır (API açılışta kendisi kaydeder) |
| 360dialog / WhatsApp | Kod var, `WHATSAPP_360DIALOG_API_KEY` yoksa devre dışı | VARSAYIM: kullanılmıyor |
| Google Gemini | Bot niyet çözümleme | Değişiklik yok |
| NetGSM | SMS (telefon doğrulama, hatırlatma, no-show) | **API IP kısıtı varsa sunucu IP'si eklenmeli** (Soru S6) |
| Resend | Şifre sıfırlama ve hoş geldin e-postası (`noreply@beautyossapp.com`) | Değişiklik yok; Cloudflare'deki SPF/DKIM kayıtlarına dokunulmaz |
| Sentry | Hata takibi (`src/instrument.ts`, `SENTRY_DSN` varsa) | Değişiklik yok |
| UptimeRobot | README'de `/health` izlemesi | Yeni adrese çevrilir |

## 3. Supabase'e bağımlılık kontrolü

Koddaki kanıt:
- `@supabase/*`, `@vercel/*`, `@upstash/*` paketi yok (`package-lock.json`).
- Migration'larda `CREATE EXTENSION`, `CREATE SCHEMA`, `CREATE POLICY`, `ENABLE ROW LEVEL SECURITY`, `GRANT`, rol, trigger, fonksiyon, `auth.`/`storage.` başvurusu **yok**.
- `gen_random_uuid()` kullanılıyor; PostgreSQL 13+ çekirdeğinde var, `pgcrypto` gerekmez. Prisma `uuid()` değerleri zaten istemcide üretiliyor.
- Supabase Auth kullanılmıyor: kimlik doğrulama uygulamanın kendi `users` tablosu + bcrypt + JWT (erişim 15 dk, yenileme 30 gün, `refreshToken` httpOnly çerezi, yol `/api/v1/auth`).
- Supabase Storage kullanılmıyor: müşteri fotoğrafları yalnız **dış https URL** olarak saklanıyor (`customer_photos.url`); dosya yükleme yok. Taşınacak dosya yok.
- Realtime yok.
- Supabase'in tek izi: `DATABASE_URL` (pooler) + `DIRECT_URL` (doğrudan) ayrımı ve test yardımcısındaki "Supabase'e test koşma" koruması (`src/__tests__/helpers/setup.ts`).

Panelde doğrulanması gerekenler (VARSAYIM; 2026-10-28'den beri veri taşınmıyor, ADR-0017. Kontrol `sema-karsilastir.sh kaynak` adımında bilgi amaçlı yapılıyor):
- `public` şemasında panelden elle açılmış RLS veya politika var mı. Varsa ve politika `auth.uid()` kullanıyorsa geri yükleme bozulur ya da uygulama rolü satır göremez.
- `public` tablolarında `extensions.` şemasına bağlı varsayılan değer, fonksiyon veya trigger var mı.
- Supabase PostgreSQL ana sürümü (hedef sürüm kaynaktan düşük olamaz; ADR-0003).

## 4. Veritabanı özellikleri

- 37 model, 28 enum. Kimlikler `uuid`. Para alanları `numeric(10,2)`/`(12,2)`/`(14,2)`, zaman alanları Prisma `DateTime` → `timestamp(3)` (saat dilimsiz, UTC değer). Tarih alanları `date`.
- Çok kiracılık **yalnız uygulama katmanında**: her rotada `tenantId` filtresi elle yazılıyor (`requireTenantAccess` JWT'deki `tenantSlug`/`tenantId`'yi kullanıyor). **RLS yok**, bileşik `(tenant_id, id)` yabancı anahtarları yok. Şirket standardından (`coklu-kiraci-veritabani`) sapma; taşıma kapsamı dışında, teknik borç T-B1.
- `users.tenantId` boş olabilir (superadmin). Kullanıcı tek kiracıya bağlı (üyelik tablosu yok).
- Prisma `binaryTargets = ["native", "debian-openssl-1.1.x"]`: mevcut imaj Debian 11 (bullseye) tabanlı.
- Migration sırası notu: `20260501_add_superadmin_role` ile `20260501024113_add_superadmin_role` adları benzer ama içerikleri farklı; sözlük sırasıyla doğru uygulanıyor. `_prisma_migrations` tablosu `public` şemasında olduğu için dökümle birlikte taşınır; hedefte `prisma migrate status` "güncel" demelidir.
- Kişisel veri: müşteri adı, telefon, doğum tarihi, notlar, **anamnez cevapları (alerji/sağlık bilgisi = özel nitelikli kişisel veri)**, bot konuşma geçmişi, SMS içerikleri. Yedekleme ve yurt dışı aktarım kararları `hukuk-uyum` onayına bağlı (`docs/tasima-plani.md` §9).

## 5. Redis kullanımı

- Tek kuyruk: `reminders`. İş türleri:
  - `reminder_24h` ve `reminder_2h`: randevu oluşturulurken **gecikmeli iş** olarak eklenir. jobId belirlenimci: `reminder-24h-<randevuId>`, `reminder-2h-<randevuId>`.
  - `nightly_noshow`: tekrarlı iş, cron `30 20 * * *`, jobId `nightly-noshow-recurring`. API her açılışta yeniden ekler.
- Cron, süreç saat dilimine göre yorumlanır. Railway konteyneri UTC olduğu için 20:30 UTC = 23:30 TR. `processNightlyNoShow` da "bugün" sınırını süreç saatine göre hesaplıyor. **Konteyner `TZ=UTC` kalmalı** (ADR-0006).
- `express-rate-limit` bellek içi depo kullanıyor, Redis değil. Tek API kopyasında doğru çalışır.
- README'deki `REDIS_KEY_PREFIX` kodda kullanılmıyor (eski belge).

## 6. Ortam değişkeni adları (koddan çıkarıldı; değerlere bakılmadı)

**API (çalışma anı):** `NODE_ENV`, `PORT`, `LOG_LEVEL`, `DATABASE_URL`, `DIRECT_URL` (Prisma şeması istiyor), `REDIS_URL`, `JWT_SECRET` (en az 32 karakter, kod zorluyor), `ALLOWED_ORIGINS` (üretimde zorunlu; yoksa API başlamaz), `CORS_ORIGIN` (yalnız `app.ts`, bkz. R4), `PUBLIC_URL`, `FRONTEND_URL` (şifre sıfırlama bağlantısı), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET_TOKEN`, `TELEGRAM_TENANT_ID`, `WHATSAPP_360DIALOG_API_KEY`, `WHATSAPP_SANDBOX`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `GEMINI_API_KEY`, `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER`, `SMS_COST_PER_PART`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY` (üretimde yoksa herkese açık randevu reddedilir), `SENTRY_DSN`, `ADMIN_SEED_SECRET`.

**Web (derleme anı, `NEXT_PUBLIC_*` imaja gömülür):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_BOT_FEATURES_ENABLED`.

**Belgede olup kodda olmayan:** `API_BASE_URL`, `REDIS_KEY_PREFIX` (README). **Kodda olup `apps/api/.env.example`'da olmayan:** `ALLOWED_ORIGINS`, `FRONTEND_URL`, `NETGSM_*`, `SMS_COST_PER_PART`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_SEED_SECRET`, `WHATSAPP_360DIALOG_API_KEY`, `WHATSAPP_SANDBOX`, `TELEGRAM_TENANT_ID`, `CORS_ORIGIN`. Kökteki yeni `.env.example` hepsini sunucu düzenine göre listeler.

## 7. Platforma özgü bağımlılıklar

| Platform | Bağımlılık | Taşımada ne olur |
|---|---|---|
| Vercel | `apps/web/vercel.json` (yalnız build komutları). `next/image`, middleware, ISR, Edge, `@vercel/*` **yok** | Next.js `output: 'standalone'` ile Docker'da sorunsuz çalışır |
| Vercel | `index.ts` CORS varsayılanında `beauty-os*.vercel.app` deseni | Üretimde `ALLOWED_ORIGINS` kullanıldığı için etkisiz; temizlenir |
| Railway | Kök `Dockerfile`, `railway.json` (healthcheck `/`), `nixpacks.toml` (Node 24 diyor ama Dockerfile kullanıldığı için etkisiz) | **Geri dönüş için kapatma gününe kadar dokunulmaz**; yeni Dockerfile'lar `apps/*/Dockerfile` yolunda |
| Railway | Web'de 4 yerde yedek API adresi `https://beautyosapi-production.up.railway.app` sabit yazılı | Kaldırılır; `NEXT_PUBLIC_API_URL` yoksa derleme durur |
| Supabase | pooler (`DATABASE_URL`) + doğrudan (`DIRECT_URL`) ayrımı, `pgbouncer=true` parametresi (VARSAYIM) | Kendi Postgres'imizde pooler yok; ikisi aynı sunucuya, farklı rollerle |
| Upstash | `rediss://` TLS | İç ağda `redis://` + parola |

**2026-10-28 ek bulgular (canlı gözlem):**
- Railway canlı API'sinin özel alan adı **`api.beautyossapp.com`**. README'deki `*.up.railway.app` adresi de çalışıyor olabilir, ama web büyük olasılıkla bu özel adı kullanıyor (Vercel `NEXT_PUBLIC_API_URL`, VARSAYIM).
- Railway servisi "watch paths" ile yalnız `apps/api/**` değişikliğinde dağıtım yapıyor. Kök dosya değişikliği (`Dockerfile`, `railway.json`) SKIPPED olur ve **elle Redeploy** ister.
- Canlı Supabase projesi `beautyos-dev` (eu-west-1); staging `beautyos-staging`.

## 8. Riskler ve teknik borç (kısa)

> **Kurucu yanıtlarından sonra (2026-10-27):**
> - NetGSM SMS kapalı, Telegram yalnız testte. R2 "Düşük"e indi.
> - R3 (`/debug`) ayrı hotfix ile canlıda kapatılıyor (G4a).
> - R10 (log'da telefon) KVKK değerlendirmesine göre geçişten önce düzeltilmesi önerilen madde.
> - Ek bulgu (hukuk-uyum): Sentry `beforeSend` istek gövdesini tümden temizlemiyor; sağlık verisi Sentry'ye gidebilir. G5-K5 ile düzeltilir; o zamana kadar `SENTRY_DSN` boş.
> - Ayrıntı: `docs/kvkk-tasima-degerlendirmesi.md`.

| No | Önem | Bulgu | Ne zaman ele alınır |
|---|---|---|---|
| R1 | Kritik | `master`/`staging` push'u Vercel ve Railway'de otomatik dağıtım yapıyor. Geçişten sonra eski API yeniden açılırsa Telegram webhook'unu geri alır, gece no-show işini ve SMS hatırlatmalarını eski veriyle **ikinci kez** çalıştırır | Geçişten önce: kurucu Railway/Vercel Git bağlantısını keser (Aşama 4 adım 0) |
| R2 | Kritik | Kuru provada yeni API gerçek `TELEGRAM_BOT_TOKEN` + `PUBLIC_URL` ile açılırsa canlı webhook'u çalar. Kopyalanmış veriyle gerçek SMS gönderir | Prova "güvenli kip"te yapılır: SMS, Telegram ve Resend anahtarları boş (§ tasima-plani 6) |
| R3 | Önemli | `GET /debug` kimlik doğrulamasız. Her çağrıda Gemini'ye ücretli istek atıyor ve `PUBLIC_URL` ile yapılandırma bilgisi döndürüyor | G4: kaldırılır. O zamana kadar Caddy `/debug*` için 404 döner |
| R4 | Önemli | İki ayrı CORS uygulaması var. Üretim `index.ts` + `ALLOWED_ORIGINS` kullanıyor; `9614458` commit'indeki apex + alt alan düzeltmesi yalnız `app.ts`'te (testlerde) etkili | G4: tek modülde birleştirilir. Taşımada `ALLOWED_ORIGINS` apex + `app` + `www` içerir |
| R5 | Önemli | CI testleri `secrets.DATABASE_URL` ile dış bir veritabanına bağlanıyor (Supabase'e bağlanmayı kod engelliyor; hangi DB olduğu bilinmiyor) | G1: geçici Postgres servis konteyneri. Soru S5 |
| R6 | Önemli | Node 20 Nisan 2026'da destek dışı kaldı. Temel imaj Debian 11 (bullseye) da destek sonunda | Taşıma Node 20 + bookworm ile yapılır (bir seferde tek değişiklik); Node 22/24 yükseltmesi taşıma sonrası (G18) |
| R7 | Önemli | Kök `Dockerfile` kilit dosyası olmadan `npm install` yapıyor: üretim bağımlılık sürümleri tekrarlanabilir değil. Root kullanıcıyla çalışıyor, çok aşamalı değil | G2: yeni `apps/api/Dockerfile` |
| R8 | Önemli | Çok kiracılık yalnız uygulama filtresine dayanıyor (RLS yok). Bir rotada filtre unutulursa kiracı verisi sızar | Taşıma kapsamı dışında. T-B1: ayrı RLS projesi (ADR gerekir) |
| R9 | Orta | SIGTERM yakalanmıyor. `docker stop` sırasında BullMQ işi yarıda kalabilir, Prisma bağlantısı düzgün kapanmaz | G5 |
| R10 | Orta | Log'a telefon numarası yazılıyor (`queue.ts`, "Telefon normalize edilemedi" uyarısı). KVKK ve şirket log kuralına aykırı | G5 |
| R11 | Orta | `trust proxy 1`. Cloudflare + Caddy arkasında istemci IP'si doğru gelmezse hız sınırları tüm kullanıcıları tek IP sayar | ADR-0010: Caddy `X-Forwarded-For`'u gerçek IP ile yeniden yazar. Test T14 doğrular |
| R12 | Düşük | Next.js 14 hattı eski; `apps/web/tsconfig.tsbuildinfo` depoda; README ve `apps/api/.env.example` güncel değil; `Sentry.setupExpressErrorHandler` rotalardan önce çağrılıyor (hatalar Sentry'ye düşmeyebilir) | Taşıma sonrası (G18) |
| R13 | Düşük | `.gitignore` `docs/` klasörünü yok sayıyordu ve `.env.*` dosyalarını korumuyordu | Bu dalda düzeltildi |
| R14 | Bilgi | Supabase Data API (PostgREST) açıksa ve `public` tablolarında RLS yoksa `anon` anahtarına sahip biri tabloları okuyabilir. Anahtar kodda/istemcide görünmüyor, risk düşük | Kurucu taşıma süresince Supabase panelinden Data API'yi kapatabilir (Soru S9) |
